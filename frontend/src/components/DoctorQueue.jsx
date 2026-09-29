import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  CheckCircle2, 
  AlertTriangle, 
  FileText, 
  Building2, 
  Pill, 
  Printer, 
  Check, 
  Camera, 
  Volume2, 
  RefreshCw, 
  ArrowDownUp, 
  MessageSquare, 
  Smartphone, 
  X, 
  Stethoscope, 
  ClipboardList, 
  Video,
  Users
} from 'lucide-react';
import ReferralPrintSlip from './ReferralPrintSlip';
import PrescriptionPrintSlip from './PrescriptionPrintSlip';
import VideoCallModal from './VideoCallModal';
import { PATIENT_STORAGE_KEY } from './offlinesync';
import { getStoredPatients } from './AshaTriage';
import { translations } from '../translations';

const PRIORITY_RANKS = {
  RED: 1,
  YELLOW: 2,
  GREEN: 3
};

const DEFAULT_PHARMACY_STOCK = [
  { id: 1, drug_name: 'Paracetamol', quantity_available: 430, unit: 'tablets', status: 'OK' },
  { id: 2, drug_name: 'Amlodipine', quantity_available: 180, unit: 'tablets', status: 'OK' },
  { id: 3, drug_name: 'Oral Rehydration Salts (ORS)', quantity_available: 188, unit: 'packets', status: 'OK' },
  { id: 4, drug_name: 'Iron & Folic Acid', quantity_available: 385, unit: 'tablets', status: 'OK' },
  { id: 5, drug_name: 'Amoxicillin', quantity_available: 210, unit: 'capsules', status: 'OK' },
  { id: 6, drug_name: 'Metformin', quantity_available: 140, unit: 'tablets', status: 'OK' }
];

export default function DoctorQueue({ lang = 'en' }) {
  const t = translations[lang] || translations.en;

  const [patients, setPatients] = useState(getStoredPatients);
  const [pharmacyInventory, setPharmacyInventory] = useState(DEFAULT_PHARMACY_STOCK);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [activeTab, setActiveTab] = useState('pending');
  
  // Multi-Doctor Specialism Switcher (Mapped to Department Names)
  const [activeDoctor, setActiveDoctor] = useState('OB-GYN');
  const doctorSpecialists = [
    { label: 'Dr. R. Kulkarni (OB-GYN Specialist / Shirsuphal PHC)', dept: 'OB-GYN' },
    { label: 'Dr. A. Jagtap (General Medicine / Baramati CHC)', dept: 'General Physician' },
    { label: 'Dr. S. Patil (Pediatrician Specialist / Pune Apex Hub)', dept: 'Pediatrics' },
    { label: 'Dr. M. Kadam (Cardiology / Emergency Hub)', dept: 'Cardiology / Emergency' }
  ];
  
  const [diagnosis, setDiagnosis] = useState('');
  const [clinicalAdvice, setClinicalAdvice] = useState('');
  const [selectedMedicines, setSelectedMedicines] = useState([]);
  const [actionType, setActionType] = useState('Prescribe');
  
  const [referralFacility, setReferralFacility] = useState('Baramati Sub-District Hospital');
  const [referralDept, setReferralDept] = useState('High-Risk OB-GYN / ICU');
  const [referralReason, setReferralReason] = useState('');

  const [showPrintSlip, setShowPrintSlip] = useState(false);
  const [slipPatient, setSlipPatient] = useState(null);
  const [slipReferralData, setSlipReferralData] = useState(null);

  // State for Prescription Print Slip Modal
  const [showRxSlip, setShowRxSlip] = useState(false);
  const [rxSlipData, setRxSlipData] = useState(null);

  const [activeCallSession, setActiveCallSession] = useState(null);
  const [smsAlerts, setSmsAlerts] = useState([]);
  const [successBanner, setSuccessBanner] = useState(null);

  const referralFacilities = [
    { name: 'Baramati Sub-District Hospital', type: 'Secondary', distance: '18 km' },
    { name: 'Pune District Civil Hospital (Aundh)', type: 'Tertiary', distance: '64 km' },
    { name: 'Sassoon General Hospital / BJMC Pune', type: 'Super-Speciality', distance: '68 km' }
  ];

  const loadAndSortPatients = () => {
    const rawList = getStoredPatients();

    const sortedList = [...rawList].sort((a, b) => {
      // 1. Completed cases go to the bottom of the table
      const aDone = a.status === 'Completed' ? 1 : 0;
      const bDone = b.status === 'Completed' ? 1 : 0;
      if (aDone !== bDone) return aDone - bDone;

      // 2. Sort strictly by Priority (RED -> YELLOW -> GREEN)
      const rankA = PRIORITY_RANKS[a.priority?.toUpperCase()] || 4;
      const rankB = PRIORITY_RANKS[b.priority?.toUpperCase()] || 4;
      if (rankA !== rankB) return rankA - rankB;

      // 3. Tie-breaker: Time of input / Sequential Ticket ID (FIFO - Earlier inputs first)
      return (a.ticket_id || 0) - (b.ticket_id || 0);
    });

    setPatients(sortedList);

    setSelectedPatient((prev) => {
      // Filter current department queue for initial selection fallback
      const currentDeptPatients = sortedList.filter(p => {
        const dept = p.target_department || p.referral_dept || 'General Physician';
        return dept === activeDoctor;
      });

      if (!prev) {
        const firstPending = currentDeptPatients.find(p => p.status !== 'Completed');
        return firstPending || currentDeptPatients[0] || sortedList[0] || null;
      }
      const match = sortedList.find((p) => p.ticket_id === prev.ticket_id);
      return match || currentDeptPatients[0] || sortedList[0] || null;
    });
  };

  // Fetch live inventory from backend FastAPI endpoint with robust fallback
  const fetchInventory = async () => {
    const isPublicUrl = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
    if (isPublicUrl) {
      return; // Keep default mock stock on Vercel deployment
    }

    try {
      const res = await fetch('http://localhost:8000/api/inventory');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setPharmacyInventory(prev => {
            return data.map(serverItem => {
              const existing = prev.find(p => p.id === serverItem.id);
              if (existing && existing.quantity_available > 0 && serverItem.quantity_available === 0) {
                return existing; 
              }
              return serverItem;
            });
          });
        }
      }
    } catch (err) {
      console.error("Failed to fetch inventory from backend, using local state stock:", err);
    }
  };

  useEffect(() => {
    loadAndSortPatients();
    fetchInventory();
    const interval = setInterval(() => {
      loadAndSortPatients();
      fetchInventory();
    }, 3000);
    window.addEventListener('storage', loadAndSortPatients);

    // Cross-device / Cross-tab listener for live call trigger synchronization
    const handleStorageChange = (e) => {
      if (e.key === 'swasthya_active_call' && e.newValue) {
        try {
          const callData = JSON.parse(e.newValue);
          if (callData && callData.patient_id) {
            const rawList = getStoredPatients();
            const matchingPatient = rawList.find(p => p.ticket_id === callData.patient_id);
            if (matchingPatient) {
              setActiveCallSession(matchingPatient);
            }
          }
        } catch (err) {
          console.error("Failed to parse active call storage event:", err);
        }
      }
    };
    window.addEventListener('storage', handleStorageChange);

    return () => {
      clearInterval(interval);
      window.removeEventListener('storage', loadAndSortPatients);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const handleRestockMedicine = async (stockId) => {
    setPharmacyInventory(prev =>
      prev.map(item =>
        item.id === stockId
          ? { ...item, quantity_available: 150, status: 'OK' }
          : item
      )
    );

    const isPublicUrl = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
    if (isPublicUrl) return;

    try {
      await fetch('http://localhost:8000/api/admin/stock/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stock_id: stockId, add_quantity: 150 })
      });
    } catch (err) {
      console.error("Failed to restock item on backend:", err);
    }
  };

  useEffect(() => {
    if (selectedPatient) {
      setDiagnosis(selectedPatient.diagnosis || '');
      setClinicalAdvice(selectedPatient.clinical_advice || '');
      setSelectedMedicines(selectedPatient.prescriptions || []);
    }
  }, [selectedPatient?.ticket_id]);

  const handleSelectMedicine = (medName) => {
    if (!selectedMedicines.includes(medName)) {
      setSelectedMedicines([...selectedMedicines, medName]);
    }
  };

  const handleRemoveMedicine = (medName) => {
    setSelectedMedicines(selectedMedicines.filter((m) => m !== medName));
  };

  const removeSmsAlert = (id) => {
    setSmsAlerts((prev) => prev.filter((a) => a.id !== id));
  };

  const handleLaunchVideoCall = async (patient) => {
    let ashaId = 1; 
    const ashaNameStr = patient.asha_name || '';
    if (ashaNameStr.includes('Sunita Pawar')) ashaId = 2;
    else if (ashaNameStr.includes('Priyanka Kale')) ashaId = 3;
    else if (ashaNameStr.includes('Rekha Deshmukh')) ashaId = 4;

    const isPublicUrl = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';

    if (isPublicUrl) {
      localStorage.setItem('swasthya_active_call', JSON.stringify({
        asha_worker_id: ashaId,
        patient_id: patient.ticket_id,
        doctor_name: activeDoctor,
        urgency: patient.priority || 'GREEN',
        timestamp: Date.now()
      }));
      setActiveCallSession(patient);
      return;
    }

    try {
      await fetch('http://localhost:8000/api/tele-opd/trigger-call', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          patient_id: patient.ticket_id,
          asha_worker_id: ashaId, 
          urgency_level: patient.priority || 'GREEN'
        })
      });
    } catch (err) {
      console.error("Failed to trigger remote call notification on backend:", err);
    }
    setActiveCallSession(patient);
  };

  const handleCompleteConsultation = async () => {
    if (!selectedPatient) return;

    const finalDiagnosis = diagnosis.trim() || selectedPatient.symptoms || 'General OPD Teleconsultation';
    const adviceString = clinicalAdvice.trim() || 'Take medicines as directed. Visit PHC if symptoms persist.';
    
    const formattedPrescription = selectedMedicines.map(med => ({
      drug_name: med,
      quantity: 1,
      dosage: '1 OD / BD'
    }));

    const medString = selectedMedicines.length > 0 
      ? selectedMedicines.join(', ') 
      : 'Oral rehydration & rest recommended';

    const isPublicUrl = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';

    if (!isPublicUrl) {
      try {
        await fetch('http://localhost:8000/api/doctor/resolve', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({
            ticket_id: selectedPatient.ticket_id,
            doctor_notes: adviceString,
            prescription: formattedPrescription,
            referral_facility: actionType === 'Refer' ? referralFacility : null
          })
        });
      } catch (err) {
        console.error("Failed to sync consultation resolution with backend:", err);
      }
    }

    const finalizedPatient = {
      ...selectedPatient,
      status: 'Completed',
      diagnosis: finalDiagnosis,
      clinical_advice: adviceString,
      prescriptions: selectedMedicines,
      action_type: actionType,
      referral_facility: actionType === 'Refer' ? referralFacility : null,
      referral_dept: actionType === 'Refer' ? referralDept : null,
      referral_reason: actionType === 'Refer' ? referralReason : null,
      resolved_at: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    const updated = patients.map((p) =>
      p.ticket_id === selectedPatient.ticket_id ? finalizedPatient : p
    );

    setPatients(updated);
    localStorage.setItem(PATIENT_STORAGE_KEY, JSON.stringify(updated));
    localStorage.setItem('swasthya_unified_patients', JSON.stringify(updated));
    localStorage.setItem('swasthya_queue', JSON.stringify(updated));

    if (actionType === 'Refer') {
      setSlipPatient(finalizedPatient);
      setSlipReferralData({
        facility: referralFacility,
        department: referralDept,
        diagnosis: finalDiagnosis,
        reason: referralReason || 'Critical vital threshold crossed requiring tertiary escalation.'
      });
      setShowPrintSlip(true);
    } else {
      setSlipPatient(finalizedPatient);
      setRxSlipData({
        medicines: selectedMedicines,
        diagnosis: finalDiagnosis,
        advice: adviceString
      });
      setShowRxSlip(true);
    }

    const docShortName = activeDoctor;

    const patientSms = {
      id: Date.now() + 1,
      recipient: 'Patient Mobile',
      phone: selectedPatient.phone || '+91 98XXXXXXXX',
      message: actionType === 'Refer'
        ? `EMERGENCY REFERRAL: Namaskar ${selectedPatient.patient_name}, you have been referred to ${referralFacility} (${referralDept}). Ticket #${selectedPatient.ticket_id}. Carry your QR Slip. Ambulance 108 notified.`
        : `Namaskar ${selectedPatient.patient_name}, Dr. ${docShortName} has finalized your tele-prescription. Rx: ${medString}. Advice: ${adviceString}.`
    };

    const ashaSms = {
      id: Date.now() + 2,
      recipient: selectedPatient.asha_name || 'ASHA Field Worker',
      phone: '+91 9823019201',
      message: actionType === 'Refer'
        ? `URGENT REFERRAL: Ticket #${selectedPatient.ticket_id} (${selectedPatient.patient_name}) escalated to ${referralFacility}. Priority: RED. Coordinate immediate transport.`
        : `[ASHA Alert] Tele-OPD Rx for ${selectedPatient.patient_name}: ${medString}. Advice: ${adviceString}. Coordinate drug distribution.`
    };

    setSmsAlerts([patientSms, ashaSms]);

    setSuccessBanner({
      ticket_id: selectedPatient.ticket_id,
      patient_name: selectedPatient.patient_name,
      prescriptions: actionType === 'Refer' ? `Referred to ${referralFacility}` : medString
    });

    if (actionType !== 'Refer') {
      const departmentFilteredQueue = updated.filter(p => {
        const dept = p.target_department || p.referral_dept || 'General Physician';
        return dept === activeDoctor;
      });
      const nextPending = departmentFilteredQueue.find((p) => p.status !== 'Completed' && p.ticket_id !== selectedPatient.ticket_id);
      if (nextPending) {
        setSelectedPatient(nextPending);
      }
    }
  };

  // Filter patients based on the selected doctor's department queue
  const departmentFilteredPatients = patients.filter((p) => {
    const patientDept = p.target_department || p.referral_dept || 'General Physician';
    return patientDept === activeDoctor;
  });

  const pendingPatients = departmentFilteredPatients.filter((p) => p.status !== 'Completed');
  const resolvedPatients = departmentFilteredPatients.filter((p) => p.status === 'Completed');
  const displayedPatients = activeTab === 'pending' ? pendingPatients : resolvedPatients;

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12 relative">
      
      {smsAlerts.length > 0 && (
        <div className="fixed bottom-6 right-6 z-50 space-y-3 max-w-sm w-full">
          {smsAlerts.map((alert) => (
            <div
              key={alert.id}
              className="bg-slate-900 text-white p-4 rounded-2xl shadow-2xl border border-slate-700 flex items-start justify-between gap-3 animate-slide-in"
            >
              <div className="flex items-start gap-3">
                <div className="p-2 bg-emerald-600 rounded-xl mt-0.5 shrink-0">
                  <Smartphone size={18} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">
                      SMS Sent • {alert.recipient}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">{alert.phone}</span>
                  </div>
                  <p className="text-xs text-slate-200 mt-1 font-sans leading-relaxed">
                    {alert.message}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => removeSmsAlert(alert.id)}
                className="text-slate-400 hover:text-white transition p-1"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Header with Multi-Doctor Specialism Switcher */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
            <Activity className="text-emerald-600" size={22} />
            {t.doctor_queue || 'Doctor Tele-OPD Queue & Clinical Consultation'}
          </h2>
          <p className="text-xs text-slate-500">
            Multi-Specialist Tele-Triage Hub • Sorted strictly by Priority (RED → YELLOW → GREEN) & Time of Input
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl flex items-center gap-2">
            <Stethoscope size={15} className="text-emerald-700" />
            <select
              value={activeDoctor}
              onChange={(e) => {
                const newDept = e.target.value;
                setActiveDoctor(newDept);
                const matchingQueue = patients.filter(p => (p.target_department || p.referral_dept || 'General Physician') === newDept);
                const firstPending = matchingQueue.find(p => p.status !== 'Completed');
                setSelectedPatient(firstPending || matchingQueue[0] || null);
              }}
              className="bg-transparent text-xs font-bold text-emerald-900 outline-none cursor-pointer"
            >
              {doctorSpecialists.map((doc, idx) => (
                <option key={idx} value={doc.dept}>{doc.label}</option>
              ))}
            </select>
          </div>

          <button
            onClick={loadAndSortPatients}
            className="flex items-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold px-3 py-2 rounded-xl transition"
          >
            <RefreshCw size={13} /> Refresh
          </button>
        </div>
      </div>

      {successBanner && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 p-4 rounded-2xl flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <CheckCircle2 size={22} className="text-emerald-600 shrink-0" />
            <div>
              <span className="font-bold text-sm block">
                Consultation Finalized for {successBanner.patient_name} (Ticket #{successBanner.ticket_id})
              </span>
              <p className="text-xs text-emerald-700 mt-0.5">
                Prescription & Care Solution saved. SMS alerts successfully dispatched to Patient and ASHA worker.
              </p>
            </div>
          </div>
          <button
            onClick={() => setSuccessBanner(null)}
            className="text-emerald-700 hover:text-emerald-900 text-xs font-bold px-2 py-1"
          >
            ✕
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        <div className="lg:col-span-4 space-y-3">
          <div className="flex bg-slate-100 p-1 rounded-xl gap-1 text-xs font-bold">
            <button
              onClick={() => setActiveTab('pending')}
              className={`flex-1 py-1.5 rounded-lg transition flex items-center justify-center gap-1.5 ${
                activeTab === 'pending'
                  ? 'bg-white text-emerald-800 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ClipboardList size={13} /> Pending Queue ({pendingPatients.length})
            </button>
            <button
              onClick={() => setActiveTab('resolved')}
              className={`flex-1 py-1.5 rounded-lg transition flex items-center justify-center gap-1.5 ${
                activeTab === 'resolved'
                  ? 'bg-white text-emerald-800 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CheckCircle2 size={13} /> Resolved ({resolvedPatients.length})
            </button>
          </div>

          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              {activeTab === 'pending' ? `${activeDoctor} Queue` : 'Resolved Log'}
            </span>
            {activeTab === 'pending' && (
              <span className="text-[10px] text-emerald-700 font-bold flex items-center gap-1">
                <ArrowDownUp size={11} /> Red → Yellow → Green
              </span>
            )}
          </div>

          {displayedPatients.length === 0 ? (
            <div className="p-8 bg-white border border-slate-200 rounded-2xl text-center text-xs text-slate-400">
              {activeTab === 'pending' 
                ? `No pending triage slips in ${activeDoctor} queue.` 
                : 'No consultations finalized yet in this queue.'}
            </div>
          ) : (
            displayedPatients.map((p) => {
              const isSelected = selectedPatient?.ticket_id === p.ticket_id;
              const isRed = p.priority === 'RED';
              const isYellow = p.priority === 'YELLOW';
              const isCompleted = p.status === 'Completed';

              return (
                <div
                  key={p.ticket_id}
                  onClick={() => setSelectedPatient(p)}
                  className={`p-4 rounded-2xl border transition cursor-pointer relative ${
                    isSelected
                      ? 'border-emerald-600 bg-white shadow-md ring-2 ring-emerald-500/20'
                      : isRed && !isCompleted
                      ? 'border-red-300 bg-red-50/40 hover:bg-red-50'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <div className="flex justify-between items-start mb-1.5">
                    <div className="flex items-center gap-1.5">
                      {isRed && !isCompleted && (
                        <span className="w-2 h-2 rounded-full bg-red-600 animate-ping"></span>
                      )}
                      <span className="font-bold text-sm text-slate-800">{p.patient_name}</span>
                    </div>

                    <span
                      className={`text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wide border ${
                        isRed
                          ? 'bg-red-100 text-red-700 border-red-300'
                          : isYellow
                          ? 'bg-amber-100 text-amber-800 border-amber-300'
                          : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                      }`}
                    >
                      {p.priority || 'GREEN'}
                    </span>
                  </div>

                  <div className="text-xs text-slate-500 mb-1">
                    {p.age}y • {p.gender} • Village: {p.village || 'Shirsuphal'}
                  </div>

                  {p.live_address && (
                    <div className="text-[10px] text-emerald-800 font-medium mb-1 truncate">
                      📍 {p.live_address}
                    </div>
                  )}

                  <div className="text-[11px] font-medium text-emerald-800 mb-2 flex items-center gap-1">
                    <Users size={12} /> {p.asha_name || 'Anita Shinde (ASHA)'}
                  </div>

                  <div className="text-[11px] text-slate-600 line-clamp-2 italic mb-3">
                    "{p.symptoms || 'No symptoms reported'}"
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[10px] font-mono">
                    <span className="text-slate-500">Ticket #{p.ticket_id} • {p.date || 'Today'}</span>
                    <span className={`font-bold ${isCompleted ? 'text-emerald-600' : isRed ? 'text-red-600' : 'text-amber-600'}`}>
                      ● {p.status || 'Waiting'}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {selectedPatient ? (
          <div className="lg:col-span-8 space-y-6">
            
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-black text-slate-800">{selectedPatient.patient_name}</h3>
                    <span
                      className={`text-[10px] font-black px-2 py-0.5 rounded uppercase border ${
                        selectedPatient.priority === 'RED'
                          ? 'bg-red-100 text-red-800 border-red-300'
                          : selectedPatient.priority === 'YELLOW'
                          ? 'bg-amber-100 text-amber-800 border-amber-300'
                          : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                      }`}
                    >
                      {selectedPatient.priority} Priority
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    ABHA: <span className="font-mono text-emerald-700 font-bold">{selectedPatient.abha_id || '91-4421-8890-1204'}</span> • {selectedPatient.age} yrs, {selectedPatient.gender}
                  </p>
                  {selectedPatient.live_address && (
                    <p className="text-xs text-emerald-900 font-medium mt-1">
                      📍 <strong>Live Address:</strong> {selectedPatient.live_address}
                    </p>
                  )}
                  <p className="text-xs text-emerald-800 font-semibold mt-1 flex items-center gap-1">
                    <Users size={13} /> Reported by: {selectedPatient.asha_name || 'Anita Shinde'}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleLaunchVideoCall(selectedPatient)}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3.5 py-2 rounded-xl flex items-center gap-1.5 shadow-sm transition hover:scale-105 active:scale-95"
                  >
                    <Video size={15} /> {t.connect_video || 'Launch Live Video Tele-OPD'}
                  </button>
                  <span className="text-xs bg-slate-100 text-slate-700 px-3 py-2 rounded-xl font-mono">
                    {selectedPatient.village || 'Shirsuphal'}
                  </span>
                </div>
              </div>

              <div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">
                  Field Vitals Recorded
                </span>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5">
                  <div className={`p-2.5 rounded-xl border text-center ${Number(selectedPatient.systolic_bp) >= 140 ? 'bg-red-50 border-red-200 text-red-900' : 'bg-slate-50 border-slate-200'}`}>
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">BP</span>
                    <span className="text-sm font-black font-mono">
                      {selectedPatient.systolic_bp || 120}/{selectedPatient.diastolic_bp || 80}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-center">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Pulse</span>
                    <span className="text-sm font-black font-mono">{selectedPatient.pulse || 72} bpm</span>
                  </div>
                  <div className={`p-2.5 rounded-xl border text-center ${Number(selectedPatient.spo2) < 94 ? 'bg-red-50 border-red-200 text-red-900' : 'bg-slate-50 border-slate-200'}`}>
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">SpO2</span>
                    <span className="text-sm font-black font-mono">{selectedPatient.spo2 || 98}%</span>
                  </div>
                  <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-center">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Temp</span>
                    <span className="text-sm font-black font-mono">{selectedPatient.temperature || 98.6}°F</span>
                  </div>
                  <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-center">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Glucose</span>
                    <span className="text-sm font-black font-mono">{selectedPatient.blood_glucose || 110}</span>
                  </div>
                  <div className={`p-2.5 rounded-xl border text-center ${selectedPatient.priority === 'RED' ? 'bg-red-100 border-red-300' : 'bg-emerald-50 border-emerald-200'}`}>
                    <span className="text-[10px] uppercase font-bold text-slate-600 block">Triage</span>
                    <span className="text-xs font-black text-slate-900">{selectedPatient.priority || 'GREEN'}</span>
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5 uppercase tracking-wider">
                  <Camera size={15} className="text-emerald-600" /> Patient / ASHA Field Media Capture
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                  <div className="bg-white p-3 rounded-xl border border-slate-200 flex flex-col justify-between">
                    <span className="text-[11px] font-bold text-slate-600 block mb-2">Clinical Site Photo</span>
                    {selectedPatient.photo_base64 ? (
                      <div className="rounded-lg overflow-hidden border border-slate-200">
                        <img
                          src={selectedPatient.photo_base64}
                          alt="Clinical capture"
                          className="w-full h-36 object-cover cursor-pointer hover:scale-105 transition duration-150"
                          onClick={() => {
                            const newWin = window.open();
                            newWin.document.write(`<img src="${selectedPatient.photo_base64}" style="max-width:100%;" />`);
                          }}
                        />
                      </div>
                    ) : (
                      <div className="h-32 bg-slate-50 border border-dashed border-slate-200 rounded-lg flex flex-col items-center justify-center text-xs text-slate-400">
                        <Camera size={20} className="mb-1 opacity-40" />
                        No photo attached
                      </div>
                    )}
                  </div>

                  <div className="bg-white p-3 rounded-xl border border-slate-200 flex flex-col justify-between">
                    <span className="text-[11px] font-bold text-slate-600 block mb-2 flex items-center gap-1">
                      <Volume2 size={13} className="text-emerald-600" /> Voice Recording Note
                    </span>
                    {selectedPatient.audio_base64 ? (
                      <div className="space-y-3 my-auto p-2 bg-slate-50 rounded-lg border border-slate-200">
                        <audio controls className="w-full h-9">
                          <source src={selectedPatient.audio_base64} type="audio/webm" />
                        </audio>
                        <span className="text-[10px] text-emerald-700 font-mono block text-center font-bold">
                          ● Audio Note Available
                        </span>
                      </div>
                    ) : (
                      <div className="h-32 bg-slate-50 border border-dashed border-slate-200 rounded-lg flex flex-col items-center justify-center text-xs text-slate-400">
                        <Volume2 size={20} className="mb-1 opacity-40" />
                        No voice clip recorded
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
              
              <div className="flex border-b border-slate-200 pb-3 gap-4">
                <button
                  type="button"
                  onClick={() => setActionType('Prescribe')}
                  className={`text-xs font-bold pb-1 flex items-center gap-1.5 transition ${
                    actionType === 'Prescribe'
                      ? 'border-b-2 border-emerald-600 text-emerald-800'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Pill size={16} /> {t.dispense_phc || 'Treat & Dispense at PHC'}
                </button>
                <button
                  type="button"
                  onClick={() => setActionType('Refer')}
                  className={`text-xs font-bold pb-1 flex items-center gap-1.5 transition ${
                    actionType === 'Refer'
                      ? 'border-b-2 border-red-600 text-red-800'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Building2 size={16} /> {t.refer_hospital || 'Refer to Sub-District Hospital'}
                </button>
              </div>

              <div>
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
                  Provisional Clinical Diagnosis
                </span>
                <input
                  type="text"
                  value={diagnosis}
                  onChange={(e) => setDiagnosis(e.target.value)}
                  placeholder="e.g. Acute Gastroenteritis with Mild Dehydration"
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1 flex items-center gap-1.5">
                  <Stethoscope size={15} className="text-emerald-600" /> {t.doctor_solution || "Doctor's Clinical Solution & Patient Care Advice"}
                </label>
                <textarea
                  rows="3"
                  value={clinicalAdvice}
                  onChange={(e) => setClinicalAdvice(e.target.value)}
                  placeholder="Provide clinical solution, patient instructions, hydration guidance..."
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                ></textarea>
              </div>

              {actionType === 'Prescribe' ? (
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                      PHC Essential Drug Stock (Click to Add)
                    </label>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {pharmacyInventory.map((item, idx) => {
                      const isAdded = selectedMedicines.includes(item.drug_name);
                      return (
                        <div
                          key={item.id || idx}
                          className={`p-2.5 rounded-xl border text-xs transition flex flex-col justify-between ${
                            isAdded
                              ? 'bg-emerald-50 border-emerald-500 text-emerald-900 font-bold'
                              : 'bg-white border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex justify-between items-start">
                            <button
                              type="button"
                              onClick={() => handleSelectMedicine(item.drug_name)}
                              className="text-left truncate flex-1 font-semibold"
                            >
                              {item.drug_name}
                            </button>
                            {isAdded && <Check size={12} className="text-emerald-600 shrink-0 ml-1" />}
                          </div>
                          
                          <div className="flex justify-between items-center mt-2 pt-2 border-t border-slate-100">
                            <span className="text-[10px] font-mono font-bold text-emerald-700">
                              {item.quantity_available} {item.unit}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {selectedMedicines.length > 0 && (
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                      <span className="text-[11px] font-bold text-slate-500 uppercase block mb-1.5">
                        Prescription to Dispense & Send via SMS:
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {selectedMedicines.map((m) => (
                          <span
                            key={m}
                            className="bg-white border border-slate-300 text-slate-800 text-xs px-2.5 py-1 rounded-lg flex items-center gap-1.5 shadow-sm"
                          >
                            {m}
                            <button
                              type="button"
                              onClick={() => handleRemoveMedicine(m)}
                              className="text-slate-400 hover:text-red-600 font-bold"
                            >
                              ✕
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4 bg-red-50/50 p-4 rounded-xl border border-red-200">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 uppercase block mb-1">Target Facility</label>
                      <select
                        value={referralFacility}
                        onChange={(e) => setReferralFacility(e.target.value)}
                        className="w-full p-2 text-xs border border-slate-300 rounded-xl bg-white"
                      >
                        {referralFacilities.map((f, idx) => (
                          <option key={idx} value={f.name}>{f.name} ({f.distance})</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 uppercase block mb-1">Department</label>
                      <select
                        value={referralDept}
                        onChange={(e) => setReferralDept(e.target.value)}
                        className="w-full p-2 text-xs border border-slate-300 rounded-xl bg-white"
                      >
                        <option value="High-Risk OB-GYN / ICU">High-Risk OB-GYN / ICU</option>
                        <option value="Cardiology & CCU">Cardiology & CCU</option>
                        <option value="Pediatrics & NICU">Pediatrics & NICU</option>
                        <option value="General Medicine">General Medicine</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 uppercase block mb-1">Referral Reason</label>
                    <textarea
                      rows="2"
                      value={referralReason}
                      onChange={(e) => setReferralReason(e.target.value)}
                      placeholder="Clinical reason for escalation..."
                      className="w-full p-2 text-xs border border-slate-300 rounded-xl bg-white"
                    ></textarea>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                <span className="text-xs text-slate-500 flex items-center gap-1">
                  <MessageSquare size={13} className="text-emerald-600" />
                  Finalizing will automatically notify Patient & ASHA via SMS
                </span>

                <button
                  type="button"
                  onClick={handleCompleteConsultation}
                  className={`px-6 py-2.5 rounded-xl font-bold text-xs text-white shadow-md flex items-center gap-2 transition hover:scale-[1.02] active:scale-[0.98] ${
                    actionType === 'Refer' ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'
                  }`}
                >
                  {actionType === 'Refer' ? (
                    <>
                      <Printer size={15} /> {t.print_qr_slip || 'Authorize Referral & Print QR Slip'}
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={16} /> {t.finalize_consultation || 'Finalize PHC Consultation & Dispatch SMS'}
                    </>
                  )}
                </button>
              </div>

            </div>
          </div>
        ) : (
          <div className="lg:col-span-8 bg-white p-12 rounded-2xl border border-slate-200 text-center text-slate-400">
            Select a patient from the queue to start tele-consultation.
          </div>
        )}
      </div>

      {activeCallSession && (
        <VideoCallModal
          ticketId={activeCallSession.ticket_id}
          isInitiator={true}
          callerRole={activeDoctor}
          patient={activeCallSession}
          onClose={() => {
            setActiveCallSession(null);
            localStorage.removeItem('swasthya_active_call');
          }}
        />
      )}

      {showPrintSlip && slipPatient && (
        <ReferralPrintSlip
          ticket={slipPatient}
          referralData={slipReferralData}
          onClose={() => {
            setShowPrintSlip(false);
            setSlipPatient(null);
            setSlipReferralData(null);
          }}
        />
      )}

      {showRxSlip && slipPatient && (
        <PrescriptionPrintSlip
          ticket={slipPatient}
          prescriptionData={rxSlipData}
          onClose={() => {
            setShowRxSlip(false);
            setSlipPatient(null);
            setRxSlipData(null);
          }}
        />
      )}
    </div>
  );
}