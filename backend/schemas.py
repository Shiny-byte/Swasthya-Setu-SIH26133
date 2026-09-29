from pydantic import BaseModel
from typing import Optional, List
import datetime

class UserAuth(BaseModel):
    username: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str
    role: str
    full_name: Optional[str] = None
    facility_name: Optional[str] = None

class ConsultationResolve(BaseModel):
    ticket_id: int
    doctor_notes: str
    prescription: List[dict]
    referral_facility: Optional[str] = None

class StockItem(BaseModel):
    drug_name: str
    dosage: str
    quantity_available: int
    unit: str
    reorder_level: int

class StockReorderRequest(BaseModel):
    stock_id: int
    add_quantity: int

class FacilityResourceItem(BaseModel):
    facility_name: str
    facility_type: str
    total_beds: int
    available_beds: int
    icu_available: int
    oxygen_cylinders: int
    ventilators: int
    blood_units_available: int
    contact_number: str    

class TriageInput(BaseModel):
    patient_name: str
    age: int
    gender: str
    phone: str
    village: str
    abha_id: Optional[str] = None
    systolic_bp: int
    diastolic_bp: int
    pulse: int
    spo2: int
    blood_glucose: float
    symptoms: str
    photo_base64: Optional[str] = None
    audio_base64: Optional[str] = None    

# -------------------------------------------------------------
# NEW: Tele-OPD Call Trigger Payload Schema
# -------------------------------------------------------------
class CallTriggerRequest(BaseModel):
    patient_id: int
    asha_worker_id: int
    urgency_level: str