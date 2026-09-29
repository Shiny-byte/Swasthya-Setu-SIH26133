from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text, Float
from sqlalchemy.orm import relationship
import datetime
from database import Base

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    full_name = Column(String)
    hashed_password = Column(String)
    role = Column(String) # ASHA, DOCTOR, PHARMACIST, ADMIN
    facility_name = Column(String, default="PHC Shirsuphal")

class Patient(Base):
    __tablename__ = "patients"
    id = Column(Integer, primary_key=True, index=True)
    abha_id = Column(String, unique=True, index=True)
    name = Column(String)
    age = Column(Integer)
    gender = Column(String)
    phone = Column(String)
    village = Column(String)

class MedicineStock(Base):
    __tablename__ = "medicine_stock"
    id = Column(Integer, primary_key=True, index=True)
    facility_name = Column(String, index=True)
    drug_name = Column(String, index=True)
    dosage = Column(String)
    quantity_available = Column(Integer)
    unit = Column(String)
    reorder_level = Column(Integer, default=50)

class FacilityResource(Base):
    __tablename__ = "facility_resources"
    id = Column(Integer, primary_key=True, index=True)
    facility_name = Column(String, unique=True, index=True)
    facility_type = Column(String)  # District Hospital, Sub-District Hospital, CHC
    total_beds = Column(Integer)
    available_beds = Column(Integer)
    icu_available = Column(Integer)
    oxygen_cylinders = Column(Integer)
    ventilators = Column(Integer)
    blood_units_available = Column(Integer)
    contact_number = Column(String)

class ConsultationTicket(Base):
    __tablename__ = "tickets"
    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"))
    asha_id = Column(Integer, ForeignKey("users.id"))
    systolic_bp = Column(Integer)
    diastolic_bp = Column(Integer)
    pulse = Column(Integer)
    spo2 = Column(Integer)
    blood_glucose = Column(Float)
    symptoms = Column(Text)
    triage_priority = Column(String)
    status = Column(String, default="QUEUED")
    doctor_notes = Column(Text, nullable=True)
    prescription_json = Column(Text, nullable=True)
    referral_facility = Column(String, nullable=True)
    
    # NEW FIELDS:
    photo_base64 = Column(Text, nullable=True)
    audio_base64 = Column(Text, nullable=True)
    referral_dept = Column(String, default="General Physician") # <-- Added for Department Specialist Queue Routing
    
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    patient = relationship("Patient")