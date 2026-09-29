from fastapi import FastAPI, Depends, HTTPException, status, WebSocket, WebSocketDisconnect, Form, Query
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import Dict, Optional
import json, random, datetime
import models, schemas, auth
from database import engine, get_db

# Create database tables automatically
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Swasthya Setu Rural Health Engine - SIH26133")

# CORS middleware for React Vite frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# -------------------------------------------------------------
# Utility: SMS Notification for Rural Patients (Feature Phones)
# -------------------------------------------------------------
def send_patient_sms(phone: str, message: str, language: str = "mr") -> bool:
    """
    Simulates sending an SMS via National/State SMS Gateway (MSDG/NIC/Twilio).
    Logs directly to the terminal for verification during hackathon judging.
    """
    print("\n" + "=" * 55)
    print(f" [SMS GATEWAY DISPATCH] To: +91-{phone} | Lang: {language.upper()}")
    print(f" Message: {message}")
    print("=" * 55 + "\n")
    return True


# -------------------------------------------------------------
# Clinical Rule Engine for Smart Field Triage
# -------------------------------------------------------------
def calculate_triage(data: schemas.TriageInput) -> str:
    """
    Classifies vital signs and blood sugar parameters:
    - RED: Hypertensive emergency, severe hypoxemia, or critical sugar levels
    - YELLOW: High-risk hypertension, elevated blood sugar, tachycardia/bradycardia
    - GREEN: Stable baseline
    """
    if (
        data.systolic_bp >= 160
        or data.diastolic_bp >= 105
        or data.spo2 < 92
        or data.blood_glucose > 350
    ):
        return "RED"
    if (
        data.systolic_bp >= 140
        or data.diastolic_bp >= 90
        or data.blood_glucose >= 200
        or data.pulse > 110
        or data.pulse < 50
    ):
        return "YELLOW"
    return "GREEN"


# -------------------------------------------------------------
# Authentication Endpoint
# -------------------------------------------------------------
@app.post("/api/login", response_model=schemas.Token)
def login(creds: schemas.UserAuth, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.username == creds.username).first()
    if not user or not auth.verify_password(creds.password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Invalid username or password")
    
    token = auth.create_access_token(data={"sub": user.username, "role": user.role})
    return {
            "access_token": token,
            "token_type": "bearer",
            "role": user.role,
            "full_name": user.full_name or "Test User",
            "facility_name": user.facility_name or "Test Facility",
        }


# -------------------------------------------------------------
# ASHA Field Triage Submission Endpoint
# -------------------------------------------------------------
@app.post("/api/triage/submit")
def submit_triage(
    data: schemas.TriageInput,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    if current_user.role != "ASHA":
        raise HTTPException(status_code=403, detail="Only ASHA workers submit field triage")

    # Generate or retain ABDM-compliant ABHA ID
    abha = data.abha_id or f"91-{random.randint(1000,9999)}-{random.randint(1000,9999)}-{random.randint(1000,9999)}"
    
    patient = db.query(models.Patient).filter(models.Patient.phone == data.phone).first()
    if not patient:
        patient = models.Patient(
            abha_id=abha,
            name=data.patient_name,
            age=data.age,
            gender=data.gender,
            phone=data.phone,
            village=data.village
        )
        db.add(patient)
        db.commit()
        db.refresh(patient)

    priority = calculate_triage(data)
    
    # Use target_department from input if available, else fallback based on triage or default
    dept = getattr(data, 'target_department', None) or ("Emergency / ICU" if priority == "RED" else "General Physician")

    ticket = models.ConsultationTicket(
        patient_id=patient.id,
        asha_id=current_user.id,
        systolic_bp=data.systolic_bp,
        diastolic_bp=data.diastolic_bp,
        pulse=data.pulse,
        spo2=data.spo2,
        blood_glucose=data.blood_glucose,
        symptoms=data.symptoms,
        triage_priority=priority,
        status="QUEUED",
        photo_base64=data.photo_base64,
        audio_base64=data.audio_base64,
        referral_dept=dept  # Storing chosen specialist queue department
    )
    db.add(ticket)
    db.commit()
    db.refresh(ticket)

    # Dispatch bilingual SMS notification to the patient
    sms_body = (
        f"नमस्कार {patient.name}, आपले आरोग्य टोकन #{ticket.id} नोंदवले आहे. "
        f"प्राधान्य: {priority}. विभाग: {dept}. लवकरच प्राथमिक आरोग्य केंद्रातील डॉक्टर संपर्क साधतील. "
        f"आपला आभा क्र: {patient.abha_id}."
    )
    send_patient_sms(patient.phone, sms_body, language="mr")

    return {
        "status": "success",
        "ticket_id": ticket.id,
        "priority": priority,
        "abha_id": patient.abha_id,
        "patient_name": patient.name,
        "target_department": dept,
        "sms_sent": True,
        "sms_preview": sms_body
    }


# -------------------------------------------------------------
# Doctor Tele-OPD Queue Endpoint (Filtered by Department)
# -------------------------------------------------------------
@app.get("/api/doctor/queue")
def get_doctor_queue(
    department: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    if current_user.role not in ["DOCTOR", "ADMIN"]:
        raise HTTPException(status_code=403, detail="Unauthorized")
    
    query = db.query(models.ConsultationTicket).filter(models.ConsultationTicket.status == "QUEUED")
    
    if department:
        query = query.filter(models.ConsultationTicket.referral_dept == department)

    tickets = query.all()
    priority_order = {"RED": 1, "YELLOW": 2, "GREEN": 3}
    sorted_tickets = sorted(tickets, key=lambda x: priority_order.get(x.triage_priority, 4))
    
    result = []
    for t in sorted_tickets:
        result.append({
            "ticket_id": t.id,
            "patient_name": t.patient.name,
            "age": t.patient.age,
            "gender": t.patient.gender,
            "village": t.patient.village,
            "target_department": t.referral_dept or "General Physician",
            "vitals": f"BP: {t.systolic_bp}/{t.diastolic_bp} | SpO2: {t.spo2}% | Pulse: {t.pulse} | Sugar: {t.blood_glucose} mg/dL",
            "symptoms": t.symptoms,
            "priority": t.triage_priority,
            "photo_base64": t.photo_base64,
            "audio_base64": t.audio_base64,
            "created_at": t.created_at.strftime("%H:%M:%S")
        })
    return result


# -------------------------------------------------------------
# Tele-OPD Call Trigger & Polling Endpoints (Bulletproof for Demo)
# -------------------------------------------------------------
class CallTriggerRequest(schemas.BaseModel):
    patient_id: int
    asha_worker_id: int
    urgency_level: str

active_calls_store = {}

@app.post("/api/tele-opd/trigger-call")
def trigger_doctor_call(payload: CallTriggerRequest):
    call_id = f"CALL-{payload.patient_id}-{int(datetime.datetime.utcnow().timestamp())}"
    
    call_data = {
        "call_id": call_id,
        "patient_id": payload.patient_id,
        "doctor_id": 1,
        "doctor_name": "Dr. R. Kulkarni",
        "status": "ACTIVE",
        "urgency": payload.urgency_level,
        "timestamp": datetime.datetime.utcnow().isoformat()
    }
    
    active_calls_store["1"] = call_data
    active_calls_store["2"] = call_data
    active_calls_store["3"] = call_data
    active_calls_store["4"] = call_data
    active_calls_store[str(payload.asha_worker_id)] = call_data

    return {
        "status": "success",
        "message": "Call triggered successfully",
        "call_id": call_id,
        "webrtc_room_url": f"/ws/call/{payload.patient_id}"
    }

@app.get("/api/tele-opd/check-status/{asha_worker_id}")
def poll_call_status(asha_worker_id: str):
    call_data = active_calls_store.get(asha_worker_id) or (list(active_calls_store.values())[0] if active_calls_store else None)
    
    if not call_data:
        return {"status": "IDLE", "active_call": False}
    return {
        "status": "ACTIVE",
        "active_call": True,
        "details": call_data
    }

@app.post("/api/tele-opd/clear-call/{asha_worker_id}")
def clear_doctor_call(asha_worker_id: str):
    """Clears active call state so the incoming banner stops showing after hangup."""
    active_calls_store.clear()
    return {"status": "success", "message": "Call state cleared"}


# -------------------------------------------------------------
# Doctor Consultation Resolution & e-Rx Endpoint
# -------------------------------------------------------------
@app.post("/api/doctor/resolve")
def resolve_ticket(
    payload: schemas.ConsultationResolve,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    if current_user.role != "DOCTOR":
        raise HTTPException(status_code=403, detail="Doctor access required")

    ticket = db.query(models.ConsultationTicket).filter(models.ConsultationTicket.id == payload.ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    ticket.doctor_notes = payload.doctor_notes
    ticket.prescription_json = json.dumps(payload.prescription)
    ticket.referral_facility = payload.referral_facility
    ticket.status = "REFERRED" if payload.referral_facility else "COMPLETED"

    for item in payload.prescription:
        drug = db.query(models.MedicineStock).filter(
            models.MedicineStock.drug_name == item.get("drug_name")
        ).first()
        if drug and drug.quantity_available >= item.get("quantity", 0):
            drug.quantity_available -= item.get("quantity", 0)

    db.commit()

    presc_summary = ", ".join([f"{d['drug_name']} (Qty: {d['quantity']})" for d in payload.prescription])
    
    patient_sms = f"नमस्कार {ticket.patient.name}, डॉक्टरांनी औषधे दिली आहेत: {presc_summary}."
    if payload.referral_facility:
        patient_sms += f" पुढील उपचारासाठी {payload.referral_facility} येथे जाण्याचा सल्ला दिला आहे."
    send_patient_sms(ticket.patient.phone, patient_sms, language="mr")

    asha_phone = "9823011223"
    asha_sms = (
        f"[ASHA Alert] रुग्ण {ticket.patient.name} ({ticket.patient.village}) यांच्यासाठी "
        f"डॉक्टरांनी औषधोपचार लिहिला आहे: {presc_summary}. "
        f"कृपया रुग्णाला औषध वाटप व तपासणीत मदत करा."
    )
    if payload.referral_facility:
        asha_sms += f" रेफरल: {payload.referral_facility}."
    send_patient_sms(asha_phone, asha_sms, language="mr")

    return {
        "message": "Consultation saved, dual SMS sent to patient & ASHA.",
        "patient_sms": patient_sms,
        "asha_sms": asha_sms
    }

# -------------------------------------------------------------
# Inventory & Essential Drug List (EDL) Endpoints
# -------------------------------------------------------------
@app.get("/api/inventory")
def get_inventory(facility: str = "PHC Shirsuphal", db: Session = Depends(get_db)):
    stocks = db.query(models.MedicineStock).filter(
        models.MedicineStock.facility_name == facility
    ).all()
    
    result = []
    for s in stocks:
        result.append({
            "id": s.id,
            "drug_name": s.drug_name,
            "dosage": s.dosage,
            "quantity_available": s.quantity_available,
            "unit": s.unit,
            "status": "CRITICAL" if s.quantity_available <= s.reorder_level else "OK"
        })
    return result


# -------------------------------------------------------------
# District Health Command & Analytics Endpoints (DHO / Admin)
# -------------------------------------------------------------
@app.get("/api/admin/metrics")
def get_district_metrics(db: Session = Depends(get_db)):
    total_patients = db.query(models.Patient).count()
    tickets = db.query(models.ConsultationTicket).all()
    
    total_tickets = len(tickets)
    red_tickets = len([t for t in tickets if t.triage_priority == "RED"])
    yellow_tickets = len([t for t in tickets if t.triage_priority == "YELLOW"])
    completed = len([t for t in tickets if t.status in ["COMPLETED", "REFERRED"]])
    referred = len([t for t in tickets if t.status == "REFERRED"])

    low_stocks = db.query(models.MedicineStock).filter(
        models.MedicineStock.quantity_available <= models.MedicineStock.reorder_level
    ).count()

    return {
        "total_patients_registered": total_patients,
        "total_consultations": total_tickets,
        "completed_treated": completed,
        "emergency_escalations_red": red_tickets,
        "moderate_risk_yellow": yellow_tickets,
        "active_referrals": referred,
        "critical_stockouts": low_stocks,
    }


@app.get("/api/admin/facilities")
def get_facilities(db: Session = Depends(get_db)):
    return db.query(models.FacilityResource).all()


@app.post("/api/admin/stock/reorder")
def reorder_stock(payload: schemas.StockReorderRequest, db: Session = Depends(get_db)):
    stock = db.query(models.MedicineStock).filter(models.MedicineStock.id == payload.stock_id).first()
    if not stock:
        raise HTTPException(status_code=404, detail="Stock item not found")
    stock.quantity_available += payload.add_quantity
    db.commit()
    return {"message": f"Successfully replenished {payload.add_quantity} units to {stock.drug_name}."}


# -------------------------------------------------------------
# WebRTC Signaling Hub (WebSocket)
# -------------------------------------------------------------
class SignalingManager:
    def __init__(self):
        self.rooms: Dict[str, list[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, room_id: str):
        await websocket.accept()
        if room_id not in self.rooms:
            self.rooms[room_id] = []
        self.rooms[room_id].append(websocket)

    def disconnect(self, websocket: WebSocket, room_id: str):
        if room_id in self.rooms:
            if websocket in self.rooms[room_id]:
                self.rooms[room_id].remove(websocket)
            if not self.rooms[room_id]:
                del self.rooms[room_id]

    async def broadcast_to_peer(self, message: str, sender_ws: WebSocket, room_id: str):
        if room_id in self.rooms:
            for connection in self.rooms[room_id]:
                if connection != sender_ws:
                    await connection.send_text(message)

signaling_hub = SignalingManager()

@app.websocket("/ws/call/{ticket_id}")
async def websocket_call_endpoint(websocket: WebSocket, ticket_id: str):
    await signaling_hub.connect(websocket, ticket_id)
    try:
        while True:
            data = await websocket.receive_text()
            await signaling_hub.broadcast_to_peer(data, websocket, ticket_id)
    except WebSocketDisconnect:
        signaling_hub.disconnect(websocket, ticket_id)

# -------------------------------------------------------------
# 1. ABDM FHIR Referral Pass Generator
# -------------------------------------------------------------
@app.get("/api/referral/{ticket_id}")
def get_referral_pass(
    ticket_id: int, 
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(auth.get_current_user)
):
    ticket = db.query(models.ConsultationTicket).filter(models.ConsultationTicket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Referral record not found")

    doctor = db.query(models.User).filter(models.User.id == current_user.id).first()
    
    fhir_payload = {
        "resourceType": "ServiceRequest",
        "id": f"SR-{ticket.id}-{random.randint(1000, 9999)}",
        "status": "active",
        "intent": "order",
        "priority": "stat" if ticket.triage_priority == "RED" else "routine",
        "subject": {
            "reference": f"Patient/{ticket.patient.abha_id}",
            "display": ticket.patient.name,
            "gender": ticket.patient.gender,
            "age": ticket.patient.age
        },
        "requester": {
            "display": doctor.full_name if doctor else "Medical Officer",
            "facility": doctor.facility_name if doctor else "PHC Shirsuphal"
        },
        "performer": {
            "display": ticket.referral_facility or "District Hospital"
        },
        "authoredOn": ticket.created_at.strftime("%Y-%m-%d %H:%M:%S")
    }

    return {
        "ticket_id": ticket.id,
        "patient": {
            "name": ticket.patient.name,
            "age": ticket.patient.age,
            "gender": ticket.patient.gender,
            "phone": ticket.patient.phone,
            "village": ticket.patient.village,
            "abha_id": ticket.patient.abha_id
        },
        "clinical": {
            "vitals": f"BP: {ticket.systolic_bp}/{ticket.diastolic_bp} | SpO2: {ticket.spo2}% | Pulse: {ticket.pulse} | Sugar: {ticket.blood_glucose} mg/dL",
            "symptoms": ticket.symptoms,
            "doctor_notes": ticket.doctor_notes,
            "prescription": json.loads(ticket.prescription_json) if ticket.prescription_json else [],
            "referral_facility": ticket.referral_facility,
            "target_department": ticket.referral_dept,
            "priority": ticket.triage_priority
        },
        "fhir_json": fhir_payload
    }

# -------------------------------------------------------------
# 2. Instant 102/108 Rural Emergency Ambulance Dispatch
# -------------------------------------------------------------
class Emergency102Request(schemas.BaseModel):
    patient_name: str
    phone: str
    village: str
    latitude: float = None
    longitude: float = None
    emergency_reason: str

@app.post("/api/emergency/102")
def trigger_102_emergency(
    req: Emergency102Request, 
    current_user: models.User = Depends(auth.get_current_user)
):
    coords_text = f"GPS: ({req.latitude}, {req.longitude})" if req.latitude else "GPS: Pending"
    sms_alert = (
        f"[102/108 DISPATCH ALERT] Urgent ambulance requested by ASHA {current_user.full_name} "
        f"for {req.patient_name} at {req.village}. {coords_text}. Condition: {req.emergency_reason}."
    )
    send_patient_sms("102-DISPATCH", sms_alert, language="en")
    
    return {
        "status": "DISPATCHED",
        "dispatch_id": f"AMB-{random.randint(10000, 99999)}",
        "ambulance_assigned": "MH-12-EM-4421 (ALS Unit)",
        "eta_minutes": 18,
        "contact_control_room": "102 / 108"
    }