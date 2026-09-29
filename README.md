<div align="center">

  <img src="https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=200&h=200&q=80" alt="Swasthya Setu Logo" width="100" style="border-radius: 50%;"/>

  # 🌐 Swasthya Setu (स्वास्थ्य सेतु)
  ### *A 2G-Resilient, Offline-First Rural Health Triage & Specialist Tele-Consultation Platform*

  [![Live Demo](https://img.shields.io/badge/🚀_Live_App-Vercel-000000?style=for-the-badge&logo=vercel)](https://swasthya-setu-beryl.vercel.app)
  [![Smart India Hackathon](https://img.shields.io/badge/SIH-2026-blue?style=for-the-badge&logo=gov.in)](https://sih.gov.in)
  [![Team Arogya 360](https://img.shields.io/badge/Team-Arogya%20360-emerald?style=for-the-badge)](https://github.com)
  [![Python FastAPI](https://img.shields.io/badge/Backend-FastAPI-005571?style=for-the-badge&logo=fastapi)](https://fastapi.tiangolo.com)
  [![React PWA](https://img.shields.io/badge/Frontend-React%20%2F%20PWA-61DAFB?style=for-the-badge&logo=react)](https://react.dev)
  [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)

</div>

---

## 🚀 **Access the Live Platform**
> **Experience the app live in action:** [https://swasthya-setu-beryl.vercel.app](https://swasthya-setu-beryl.vercel.app)

---

## 🎯 **The Problem Statement**
Rural healthcare delivery across remote Indian villages continues to suffer from a critical **'delay-to-diagnosis' loop**, heavy reliance on error-prone paper logs, and severe bottlenecks in specialist referrals. Frontline ASHA workers are frequently constrained by erratic 2G connectivity, risking data loss during critical patient evaluations and emergency dispatches.

---

## 💡 **Our Solution: Swasthya Setu**
**Swasthya Setu** transforms primary health sub-centres and village doorsteps into smart telehealth hubs. By blending offline-first architecture, automated clinical triage, and direct multi-specialist routing, our platform bridges grassroots workers directly with district medical experts in seconds.

---

## ✨ **Key Features & Innovations**

| Feature | Description |
| :--- | :--- |
| 🔴 **Automated Vital Triage** | Instantly sorts incoming cases into **RED**, **YELLOW**, and **GREEN** priority queues based on real-time vitals (BP, SpO2, Temperature, Blood Glucose). |
| 🩺 **Specialist Queue Routing** | Dynamically routes patients into dedicated doctor queues (**OB-GYN**, **Cardiology**, **Pediatrics**, **General Physician**) via smart symptom matching. |
| 📶 **2G-Optimized Offline Sync** | Built using local store-and-forward outbox caching. Forms submitted offline auto-sync when network connectivity returns—**guaranteeing zero data loss**. |
| 🪪 **ABDM & ABHA Integration** | Seamlessly provisions Ayushman Bharat Health Account (ABHA) IDs and generates FHIR-compliant QR referral passes for complete interoperability. |
| 🚑 **Geospatial 102/108 Dispatch** | One-tap emergency GPS coordination that locks live driver coordinates and updates district fleet statuses instantly. |
| 🦠 **Outbreak Cluster Heatmapping** | Real-time syndromic surveillance detecting waterborne disease clusters (e.g., Acute Watery Diarrhea) across villages before outbreaks spread. |

---

## 🏗️ **System Architecture**

```text
 📱 Frontend PWA (React + Tailwind CSS) [Hosted on Vercel]
       │  (Offline-First Local Storage & Outbox Sync)
       ▼
 ⚙️ Backend Engine (Python FastAPI + Uvicorn)
       │  (Async Request Handling, REST APIs, WebRTC Signaling)
       ▼
 🗄️ Database Layer (SQLite / SQLAlchemy ORM)
       │  (Patient Records, Consultation Tickets, Medicine Inventory)
       ▼
 🌐 External Gateway Integrations (ABDM ABHA, 102/108 Ambulance Dispatch, SMS Gateway)
```
📂 Project Directory Structure
```text
swasthya-setu/
├── backend/
│   ├── main.py            # FastAPI entry point & API endpoints
│   ├── models.py          # SQLAlchemy database schema definition
│   ├── schemas.py         # Pydantic data validation models
│   ├── auth.py            # JWT security & user authentication
│   └── database.py        # SQLite database session manager
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── AshaTriage.jsx         # Frontline ASHA worker intake form
│   │   │   ├── PatientPortal.jsx      # Patient self-intake & GPS tracking
│   │   │   ├── DoctorQueue.jsx        # Multi-specialist tele-OPD queue & e-Rx desk
│   │   │   ├── DistrictAdminDashboard.jsx # DHO analytics, heatmaps & fleet view
│   │   │   ├── VideoCallModal.jsx     # Secure WebRTC video consultation
│   │   │   └── offlinesync.js         # 2G compression & outbox synchronization
│   │   ├── translations.js            # Multilingual support (English, Marathi, Hindi)
│   │   └── App.jsx
└── README.md
```
🛠️ Getting Started & Local Installation
1. Clone the Repository
git clone [https://github.com/Shiny-byte/Swasthya-Setu-SIH26133.git](https://github.com/Shiny-byte/Swasthya-Setu-SIH26133.git)
cd Swasthya-Setu-SIH26133
2. Set Up & Run the Backend (FastAPI)
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
3. Set Up & Run the Frontend (React Vite)
cd frontend
npm install
npm run dev
Open your browser and navigate to http://localhost:5173.

👥 Team Arogya 360
Developed with ❤️ for Smart India Hackathon 2026.

🛡️ License
This project is licensed under the terms of the MIT License.


---

### **2. `backend/models.py` (Save in backend folder as `models.py`)**

```python
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
    facility_type = Column(String) 
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
    
    photo_base64 = Column(Text, nullable=True)
    audio_base64 = Column(Text, nullable=True)
    referral_dept = Column(String, default="General Physician")
    
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    patient = relationship("Patient")
  
