import React, { useState, useRef, useEffect } from 'react';
import { 
  Activity, 
  CheckCircle2, 
  UserPlus, 
  Heart, 
  Camera, 
  Mic, 
  Square, 
  PhoneCall, 
  Siren, 
  CreditCard, 
  History, 
  Search, 
  CheckCircle, 
  FileText, 
  MessageSquare, 
  X, 
  Smartphone,
  Video,
  WifiOff,
  SignalLow,
  SignalHigh,
  UploadCloud,
  Check,
  Users,
  MapPin,
  Truck,
  Building2,
  Bell
} from 'lucide-react';
import VideoCallModal from './VideoCallModal';
import { 
  compressImageFor2G, 
  saveToOutbox, 
  syncOutbox, 
  getOutboxCount, 
  getNetworkQuality,
  PATIENT_STORAGE_KEY 
} from './offlinesync';
import { translations } from '../translations';

const DEFAULT_SEED_PATIENTS = [
  {
    ticket_id: 1001,
    patient_name: 'Sunita Shinde',
    age: 26,
    gender: 'Female',
    village: 'Shirsuphal',
    asha_name: 'Anita Shinde (ASHA - Shirsuphal)',
    phone: '9822104590',
    priority: 'RED',
    abha_id: '91-4421-8890-1204',
    systolic_bp: 168,
    diastolic_bp: 108,
    pulse: 98,
    spo2: 93,
    temperature: 99.2,
    blood_glucose: 142,
    symptoms: 'Sudden severe headache, visual blurring in 3rd trimester.',
    live_address: 'Near Gram Panchayat Office, Shirsuphal, Baramati, Pune - 413133',
    status: 'Waiting',
    diagnosis: 'Severe Preeclampsia / Impending Eclampsia',
    referral_dept: 'OB-GYN / High-Risk ICU',
    sync_status: 'SYNCED_ONLINE',
    date: 'Today, 09:15 AM'
  },
  {
    ticket_id: 1002,
    patient_name: 'Prakash Jadhav',
    age: 32,
    gender: 'Male',
    village: 'Baramati Rural',
    asha_name: 'Sunita Pawar (ASHA - Baramati Rural)',
    phone: '9850123488',
    priority: 'GREEN',
    abha_id: '91-1029-3847-5610',
    systolic_bp: 122,
    diastolic_bp: 78,
    pulse: 74,
    spo2: 98,
    temperature: 100.2,
    blood_glucose: 110,
    symptoms: 'Mild dry cough, low-grade fever for 2 days.',
    live_address: 'Main Road Ward 3, Baramati Rural, Pune - 413102',
    status: 'Waiting',
    diagnosis: 'Acute Viral Nasopharyngitis',
    referral_dept: 'General OPD (Home Care)',
    sync_status: 'SYNCED_ONLINE',
    date: 'Today, 08:40 AM'
  }
];

export function getStoredPatients() {
  const keys = [
    PATIENT_STORAGE_KEY,
    'swasthya_unified_patients',
    'swasthya_queue',
    'asha_patient_registry'
  ];

  for (const k of keys) {
    try {
      const raw = localStorage.getItem(k);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {}
  }

  localStorage.setItem(PATIENT_STORAGE_KEY, JSON.stringify(DEFAULT_SEED_PATIENTS));
  return DEFAULT_SEED_PATIENTS;
}

export default function AshaTriage({ lang = 'en', currentAsha, setCurrentAsha }) {
  const t = translations[lang] || translations.en;

  const [activeTab, setActiveTab] = useState('new_intake');
  const [searchQuery, setSearchQuery] = useState('');

  const ashaList = [
    { id: 1, name: 'Anita Shinde', village: 'Shirsuphal', fullLabel: 'Anita Shinde (ASHA - Shirsuphal)' },
    { id: 2, name: 'Sunita Pawar', village: 'Baramati Rural', fullLabel: 'Sunita Pawar (ASHA - Baramati Rural)' },
    { id: 3, name: 'Priyanka Kale', village: 'Malegaon', fullLabel: 'Priyanka Kale (ASHA - Malegaon Sub-Centre)' },
    { id: 4, name: 'Rekha Deshmukh', village: 'Gunawadi', fullLabel: 'Rekha Deshmukh (ASHA - Gunawadi)' }
  ];

  const matchedAsha = ashaList.find(a => a.village === currentAsha?.village) || ashaList[0];

  const [formData, setFormData] = useState({
    patient_name: '',
    age: '',
    gender: 'Female',
    phone: '',
    village: matchedAsha.village,
    asha_name: matchedAsha.fullLabel,
    abha_id: '',
    target_department: 'General Physician', // Added specialist routing department state
    systolic_bp: '',
    diastolic_bp: '',
    pulse: '',
    spo2: '',
    temperature: '',
    blood_glucose: '',
    symptoms: '',
  });

  // Live GPS and Live Address State
  const [gpsCoords, setGpsCoords] = useState(null);
  const [liveAddress, setLiveAddress] = useState('');
  const [fetchingGps, setFetchingGps] = useState(false);
  const [nearestAmbulanceDispatched, setNearestAmbulanceDispatched] = useState(false);

  // Incoming Doctor Call Notification & Polling State
  const [incomingCallAlert, setIncomingCallAlert] = useState(null);

  useEffect(() => {
    const checkIncomingCalls = async () => {
      const isPublicUrl = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';

      if (isPublicUrl) {
        try {
          const callData = localStorage.getItem('swasthya_active_call');
          if (callData) {
            const parsed = JSON.parse(callData);
            if (parsed.asha_worker_id === (matchedAsha.id || 1)) {
              setIncomingCallAlert(parsed);
            }
          }
        } catch {}
      } else {
        try {
          const ashaWorkerId = matchedAsha.id || 1;
          const response = await fetch(`http://localhost:8000/api/tele-opd/check-status/${ashaWorkerId}`);
          if (response.ok) {
            const data = await response.json();
            if (data.active_call && data.status === 'ACTIVE') {
              setIncomingCallAlert(data.details);
            }
          }
        } catch (err) {
          console.error("Call status polling error:", err);
        }
      }
    };

    const pollInterval = setInterval(checkIncomingCalls, 1000);
    return () => clearInterval(pollInterval);
  }, [matchedAsha]);

  const handleCaptureGps = async () => {
    setFetchingGps(true);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const lat = position.coords.latitude.toFixed(4);
          const lng = position.coords.longitude.toFixed(4);
          
          setGpsCoords({ lat, lng });

          try {
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
            const data = await res.json();
            const addr = data.display_name || `${formData.village} Sub-Centre Grid Area`;
            setLiveAddress(addr);
          } catch {
            setLiveAddress(`Rural Sector Grid ${lat}, ${lng} (${formData.village})`);
          }
          setFetchingGps(false);
        },
        () => {
          setGpsCoords({ lat: '18.1858', lng: '74.5880' });
          setLiveAddress(`Primary Health Sub-Centre Cluster, ${formData.village}, Maharashtra`);
          setFetchingGps(false);
        }
      );
    } else {
      setGpsCoords({ lat: '18.1858', lng: '74.5880' });
      setLiveAddress(`Primary Health Sub-Centre Cluster, ${formData.village}, Maharashtra`);
      setFetchingGps(false);
    }
  };

  useEffect(() => {
    if (currentAsha) {
      const match = ashaList.find(a => a.village === currentAsha.village) || ashaList[0];
      setFormData(prev => ({
        ...prev,
        village: match.village,
        asha_name: match.fullLabel
      }));
    }
  }, [currentAsha]);

  const [photoBase64, setPhotoBase64] = useState(null);
  const [isCompressingPhoto, setIsCompressingPhoto] = useState(false);
  const [audioBase64, setAudioBase64] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  const [emergencyStatus, setEmergencyStatus] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [smsAlerts, setSmsAlerts] = useState([]);
  const [activeCallPatient, setActiveCallPatient] = useState(null);

  const [netInfo, setNetInfo] = useState(getNetworkQuality());
  const [outboxCount, setOutboxCount] = useState(getOutboxCount());
  const [isSyncingOutbox, setIsSyncingOutbox] = useState(false);

  const [patientRecords, setPatientRecords] = useState(getStoredPatients);

  useEffect(() => {
    const handleNetChange = async () => {
      const q = getNetworkQuality();
      setNetInfo(q);
      if (navigator.onLine) {
        setIsSyncingOutbox(true);
        await syncOutbox();
        setOutboxCount(getOutboxCount());
        setPatientRecords(getStoredPatients());
        setIsSyncingOutbox(false);
      }
    };

    window.addEventListener('online', handleNetChange);
    window.addEventListener('offline', handleNetChange);

    const interval = setInterval(async () => {
      setNetInfo(getNetworkQuality());
      setOutboxCount(getOutboxCount());
      if (navigator.onLine && getOutboxCount() > 0) {
        await syncOutbox();
        setOutboxCount(getOutboxCount());
        setPatientRecords(getStoredPatients());
      }
    }, 4000);

    return () => {
      window.removeEventListener('online', handleNetChange);
      window.removeEventListener('offline', handleNetChange);
      clearInterval(interval);
    };
  }, []);

  const isEmergencyDetected = 
    (formData.systolic_bp && Number(formData.systolic_bp) >= 160) ||
    (formData.diastolic_bp && Number(formData.diastolic_bp) >= 105) ||
    (formData.spo2 && Number(formData.spo2) < 92) ||
    (formData.pulse && (Number(formData.pulse) > 125 || Number(formData.pulse) < 45)) ||
    (formData.temperature && Number(formData.temperature) >= 102.5) ||
    (formData.blood_glucose && Number(formData.blood_glucose) > 350);

  const handlePhotoCapture = async (e) => {
    const file = e.target.files[0];
    if (file) {
      setIsCompressingPhoto(true);
      try {
        const compressedDataUrl = await compressImageFor2G(file, 800, 0.6);
        setPhotoBase64(compressedDataUrl);
      } catch {
        const reader = new FileReader();
        reader.onload = (event) => setPhotoBase64(event.target.result);
        reader.readAsDataURL(file);
      } finally {
        setIsCompressingPhoto(false);
      }
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => audioChunksRef.current.push(e.data);
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = () => setAudioBase64(reader.result);
        reader.readAsDataURL(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch {
      alert('Microphone permission not granted.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const resetForm = () => {
    setFormData({
      patient_name: '',
      age: '',
      gender: 'Female',
      phone: '',
      village: currentAsha?.village || 'Shirsuphal',
      asha_name: currentAsha?.fullLabel || ashaList[0].fullLabel,
      abha_id: '',
      target_department: 'General Physician',
      systolic_bp: '',
      diastolic_bp: '',
      pulse: '',
      spo2: '',
      temperature: '',
      blood_glucose: '',
      symptoms: '',
    });
    setPhotoBase64(null);
    setAudioBase64(null);
    setGpsCoords(null);
    setLiveAddress('');
    setNearestAmbulanceDispatched(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    let priority = 'GREEN';
    if (isEmergencyDetected) {
      priority = 'RED';
    } else if (
      Number(formData.systolic_bp) >= 140 ||
      Number(formData.temperature) >= 100.5 ||
      Number(formData.blood_glucose) >= 200
    ) {
      priority = 'YELLOW';
    }

    const currentList = getStoredPatients();
    const highestTicketId = currentList.reduce((max, p) => {
      const currentId = parseInt(p.ticket_id || p.id || 0, 10);
      return currentId > max ? currentId : max;
    }, 1000);

    const nextSequentialId = highestTicketId + 1;
    const generatedAbha = formData.abha_id.trim() || `91-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}`;

    const isOffline = !navigator.onLine;

    const resolvedAddress = liveAddress || `${formData.village} Rural Sub-Centre Grid Area`;

    const newPatient = {
      ticket_id: nextSequentialId,
      patient_name: formData.patient_name,
      age: parseInt(formData.age, 10) || 0,
      gender: formData.gender,
      phone: formData.phone,
      village: formData.village,
      asha_name: formData.asha_name,
      abha_id: generatedAbha,
      target_department: formData.target_department, // Saves chosen specialist queue
      systolic_bp: formData.systolic_bp ? parseInt(formData.systolic_bp, 10) : 120,
      diastolic_bp: formData.diastolic_bp ? parseInt(formData.diastolic_bp, 10) : 80,
      pulse: formData.pulse ? parseInt(formData.pulse, 10) : 72,
      spo2: formData.spo2 ? parseInt(formData.spo2, 10) : 98,
      temperature: formData.temperature ? parseFloat(formData.temperature) : 98.6,
      blood_glucose: formData.blood_glucose ? parseInt(formData.blood_glucose, 10) : 110,
      symptoms: formData.symptoms,
      live_address: resolvedAddress,
      gps_coords: gpsCoords,
      priority: priority,
      photo_base64: photoBase64,
      audio_base64: audioBase64,
      status: 'Waiting',
      sync_status: isOffline ? 'QUEUED_OFFLINE' : 'SYNCED_ONLINE',
      date: 'Just Now',
      diagnosis: priority === 'RED' ? 'Urgent Emergency Escalation' : 'General Teleconsult OPD',
      referral_dept: formData.target_department,
    };

    saveToOutbox(newPatient);
    setOutboxCount(getOutboxCount());

    const updatedList = getStoredPatients();
    setPatientRecords(updatedList);

    if (!isOffline) {
      syncOutbox();
    }

    const patientSms = {
      id: Date.now() + 1,
      recipient: 'Patient Mobile',
      phone: formData.phone || '+91 98XXXXXXXX',
      message: `Namaskar ${formData.patient_name}, intake complete via ${formData.asha_name}. Routed to ${formData.target_department}. Ticket #${nextSequentialId} [Priority: ${priority}].`
    };

    const ashaSms = {
      id: Date.now() + 2,
      recipient: formData.asha_name,
      phone: '+91 9823019201',
      message: `Intake Logged: ${formData.patient_name} (${formData.village}) -> ${formData.target_department}. Ticket #${nextSequentialId} [${priority}].`
    };

    setSmsAlerts([patientSms, ashaSms]);

    setResult({
      ticket_id: nextSequentialId,
      priority: priority,
      isOffline,
      sms_preview: `Triage Completed for ${newPatient.patient_name}. Ticket #${nextSequentialId} [${priority}]`
    });

    resetForm();
    setLoading(false);
  };

  const removeSmsAlert = (id) => {
    setSmsAlerts((prev) => prev.filter((alert) => alert.id !== id));
  };

  const filteredRecords = patientRecords.filter((p) =>
    p.patient_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.village.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.asha_name && p.asha_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
    String(p.ticket_id).includes(searchQuery)
  );

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-6 relative">
      
      {/* Live Incoming Doctor Call Banner Alert */}
      {incomingCallAlert && (
        <div className="bg-emerald-600 text-white p-4 rounded-2xl shadow-xl flex items-center justify-between gap-4 animate-bounce">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white text-emerald-700 rounded-xl">
              <Bell size={22} className="animate-pulse" />
            </div>
            <div>
              <span className="font-extrabold text-sm block">
                🚨 Incoming Tele-OPD Call from {incomingCallAlert.doctor_name || 'District Specialist'}!
              </span>
              <p className="text-xs opacity-90">
                Patient Ticket #{incomingCallAlert.patient_id} ({incomingCallAlert.urgency} Priority). Doctor is ready for consultation.
              </p>
            </div>
          </div>
          <button
            onClick={async () => {
              const isPublicUrl = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
              if (!isPublicUrl) {
                try {
                  await fetch('http://localhost:8000/api/tele-opd/clear-call/1', {
                    method: 'POST'
                  });
                } catch (err) {
                  console.error("Failed to clear call state:", err);
                }
              } else {
                localStorage.removeItem('swasthya_active_call');
              }
              const matched = patientRecords.find(p => p.ticket_id === incomingCallAlert.patient_id) || patientRecords[0];
              setActiveCallPatient(matched);
              setIncomingCallAlert(null);
            }}
            className="bg-white text-emerald-800 font-bold px-4 py-2 rounded-xl text-xs hover:bg-emerald-50 transition shadow"
          >
            Accept & Join Video
          </button>
        </div>
      )}

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

      {/* Navigation & Network Bar */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('new_intake')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
              activeTab === 'new_intake' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <UserPlus size={14} /> {t.new_intake || 'New Intake'}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('records')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
              activeTab === 'records' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <History size={14} /> {t.records || 'Multi-ASHA Registry'} ({patientRecords.length})
          </button>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className={`px-2.5 py-1 rounded-full font-bold flex items-center gap-1 border ${netInfo.color}`}>
            {netInfo.status === 'OFFLINE' ? <WifiOff size={13} /> : netInfo.status === '2G_LOW' ? <SignalLow size={13} /> : <SignalHigh size={13} />}
            {netInfo.label}
          </span>

          {outboxCount > 0 && (
            <button
              type="button"
              onClick={async () => {
                setIsSyncingOutbox(true);
                await syncOutbox();
                setOutboxCount(getOutboxCount());
                setPatientRecords(getStoredPatients());
                setIsSyncingOutbox(false);
              }}
              className="bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 px-2.5 py-1 rounded-full font-bold flex items-center gap-1 transition"
            >
              <UploadCloud size={13} className={isSyncingOutbox ? 'animate-bounce' : ''} />
              Outbox ({outboxCount})
            </button>
          )}
        </div>
      </div>

      {isEmergencyDetected && activeTab === 'new_intake' && (
        <div className="bg-red-50 border-2 border-red-500 p-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-md">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-red-600 text-white rounded-xl shrink-0">
              <Siren size={20} className="animate-pulse" />
            </div>
            <div>
              <span className="font-extrabold text-xs text-red-950 uppercase tracking-wide block">
                Critical Red Priority Case Detected
              </span>
              <p className="text-[11px] text-red-800">
                Critical vitals recorded. Immediate emergency 102/108 ambulance dispatch recommended.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="tel:102"
              className="bg-white border border-red-300 text-red-700 text-xs font-bold px-3 py-2 rounded-xl flex items-center gap-1.5 shadow-sm"
            >
              <PhoneCall size={14} /> Call 102
            </a>
            <button
              type="button"
              onClick={() => {
                setEmergencyStatus({ eta: 12, vehicle: 'MH-12-EM-1029' });
                try {
                  const ambs = JSON.parse(localStorage.getItem('swasthya_live_ambulances') || '[]');
                  const updated = ambs.map((a, i) => i === 0 ? { ...a, status: 'DISPATCHED (En Route)', eta: '8 mins' } : a);
                  localStorage.setItem('swasthya_live_ambulances', JSON.stringify(updated));
                } catch {}
              }}
              className="bg-red-600 text-white text-xs font-bold px-4 py-2 rounded-xl shadow hover:bg-red-700"
            >
              Dispatch 102
            </button>
          </div>
        </div>
      )}

      {emergencyStatus && (
        <div className="bg-red-700 text-white p-3 rounded-xl text-xs flex justify-between items-center shadow">
          <span>Ambulance ({emergencyStatus.vehicle}) dispatched to {liveAddress || 'patient location'}. ETA: {emergencyStatus.eta} mins.</span>
          <button onClick={() => setEmergencyStatus(null)} className="font-bold px-2">✕</button>
        </div>
      )}

      {result && (
        <div className={`p-4 rounded-xl border flex items-center justify-between ${
          result.priority === 'RED' ? 'bg-red-50 border-red-200 text-red-900' : 'bg-emerald-50 border-emerald-200 text-emerald-900'
        }`}>
          <div className="flex items-center gap-3">
            <CheckCircle2 size={22} className={result.priority === 'RED' ? 'text-red-600' : 'text-emerald-600'} />
            <div>
              <div className="font-bold text-sm">
                Priority: {result.priority} • Ticket #{result.ticket_id}
              </div>
              <div className="text-xs opacity-80 flex items-center gap-1 mt-0.5">
                <MessageSquare size={13} />
                {result.isOffline
                  ? 'Saved offline to Store-and-Forward Outbox.'
                  : 'SMS successfully dispatched with live address geofence.'}
              </div>
            </div>
          </div>
          <span className="text-xs bg-emerald-100 text-emerald-800 font-bold px-2.5 py-1 rounded-full">
            {result.isOffline ? 'Queued Offline' : 'Queued Online'}
          </span>
        </div>
      )}

      {activeTab === 'new_intake' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
            <Activity size={22} className="text-emerald-600" />
            <div>
              <h2 className="text-base font-bold text-slate-800">{t.asha_intake_title || 'Multi-ASHA Field Triage Intake'}</h2>
              <p className="text-xs text-slate-500">Record frontline worker details, patient demographics, live GPS coordinates, and address</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* ASHA Worker Selector */}
            <div className="bg-emerald-50/70 p-3 rounded-xl border border-emerald-200">
              <label className="text-xs font-bold text-emerald-900 flex items-center gap-1.5 mb-1.5">
                <Users size={14} className="text-emerald-600" /> Submitting ASHA Field Worker / Sub-Centre
              </label>
              <select
                value={formData.asha_name}
                onChange={(e) => {
                  const found = ashaList.find(a => a.fullLabel === e.target.value);
                  if (found) {
                    setCurrentAsha(found);
                    setFormData({ ...formData, asha_name: found.fullLabel, village: found.village });
                  }
                }}
                className="w-full px-3 py-2 border rounded-xl text-xs bg-white border-emerald-300 font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {ashaList.map((asha, idx) => (
                  <option key={idx} value={asha.fullLabel}>{asha.fullLabel}</option>
                ))}
              </select>
            </div>

            {/* Live GPS & Live Address Capture Widget */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <MapPin size={15} className="text-emerald-600" /> Live Field GPS & Address Geofencing
                </span>
                <button
                  type="button"
                  onClick={handleCaptureGps}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold px-3 py-1.5 rounded-xl transition shadow-sm"
                >
                  {fetchingGps ? 'Acquiring Satellite Lock...' : gpsCoords ? '✓ GPS & Address Locked' : 'Capture Live GPS & Address'}
                </button>
              </div>

              {liveAddress && (
                <div className="text-xs font-sans text-slate-800 bg-white p-3 rounded-xl border border-slate-200 shadow-sm space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Resolved Live Address:</span>
                  <p className="font-semibold text-emerald-900">📍 {liveAddress}</p>
                  {gpsCoords && (
                    <p className="text-[10px] text-slate-500 font-mono">Lat: {gpsCoords.lat}, Lng: {gpsCoords.lng}</p>
                  )}
                </div>
              )}
              
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pt-2 border-t border-slate-200">
                <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                  📞 National Health Helpline: <strong className="font-mono text-emerald-800">104 / 108</strong>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setNearestAmbulanceDispatched(true);
                    try {
                      const ambs = JSON.parse(localStorage.getItem('swasthya_live_ambulances') || '[]');
                      const updated = ambs.map((a, i) => i === 0 ? { ...a, status: 'DISPATCHED (En Route)', eta: '8 mins' } : a);
                      localStorage.setItem('swasthya_live_ambulances', JSON.stringify(updated));
                    } catch {}
                  }}
                  className="bg-red-600 hover:bg-red-700 text-white text-[11px] font-bold px-3.5 py-1.5 rounded-xl shadow transition flex items-center gap-1"
                >
                  <Truck size={13} /> Dispatch Nearest GPS Ambulance
                </button>
              </div>
              {nearestAmbulanceDispatched && (
                <p className="text-[11px] text-red-700 font-bold bg-red-50 p-2.5 rounded-xl border border-red-200 animate-pulse">
                  🚨 Emergency Ambulance MH-12-EM-8821 dispatched to: <strong>{liveAddress || formData.village}</strong>. ETA 8 mins!
                </p>
              )}
            </div>

            {/* Location-Wise Nearest Hospital Directory */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-2.5">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wide block flex items-center gap-1.5">
                <Building2 size={15} className="text-emerald-600" /> Nearest Referral Hospitals for {formData.village} Follow-Up
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <strong>Baramati Sub-District Hospital</strong>
                  <p className="text-slate-500 text-[11px]">Distance: 14 km • FRU Trauma & OB-GYN</p>
                  <a href="tel:02112224102" className="text-emerald-700 font-bold text-[11px] mt-1 block">📞 02112-224102</a>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <strong>{formData.village} Primary Health Centre (PHC)</strong>
                  <p className="text-slate-500 text-[11px]">Distance: 2.1 km • 24/7 Triage Hub</p>
                  <a href="tel:02112289100" className="text-emerald-700 font-bold text-[11px] mt-1 block">📞 02112-289100</a>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-700">{t.patient_name || 'Patient Full Name'}</label>
                <input
                  type="text"
                  required
                  value={formData.patient_name}
                  onChange={(e) => setFormData({ ...formData, patient_name: e.target.value })}
                  placeholder={t.patient_name_placeholder || 'e.g. Ramesh Patil'}
                  className="w-full mt-1 px-3 py-2 border rounded-xl text-sm border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700">{t.phone_number || 'Phone Number'}</label>
                <input
                  type="tel"
                  required
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder={t.phone_placeholder || '10-digit mobile number'}
                  className="w-full mt-1 px-3 py-2 border rounded-xl text-sm border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-700">{t.age || 'Age'}</label>
                <input
                  type="number"
                  required
                  value={formData.age}
                  onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                  placeholder={t.age_placeholder || 'Age'}
                  className="w-full mt-1 px-3 py-2 border rounded-xl text-sm border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700">{t.gender || 'Gender'}</label>
                <select
                  value={formData.gender}
                  onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border rounded-xl text-sm bg-white border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="Female">{t.female || 'Female'}</option>
                  <option value="Male">{t.male || 'Male'}</option>
                  <option value="Other">{t.other || 'Other'}</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700">{t.village || 'Village'}</label>
                <input
                  type="text"
                  value={formData.village}
                  onChange={(e) => setFormData({ ...formData, village: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border rounded-xl text-sm border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold text-emerald-800 bg-emerald-50/50"
                  readOnly
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                    <CreditCard size={14} className="text-emerald-600" /> {t.abha_id || 'ABHA ID'}
                  </label>
                  <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold">Auto-Provision if Empty</span>
                </div>
                <input
                  type="text"
                  value={formData.abha_id}
                  onChange={(e) => setFormData({ ...formData, abha_id: e.target.value })}
                  placeholder={t.abha_placeholder || 'Leave blank to auto-create ABHA ID'}
                  className="w-full px-3 py-2 border rounded-xl text-sm bg-white border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                />
              </div>

              {/* NEW: Target Department Selector for Specialist Routing */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                    <Users size={14} className="text-emerald-600" /> Target Department / Specialist
                  </label>
                  <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold">Queue Routing</span>
                </div>
                <select
                  value={formData.target_department}
                  onChange={(e) => setFormData({ ...formData, target_department: e.target.value })}
                  className="w-full px-3 py-2 border rounded-xl text-sm bg-white border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-semibold text-slate-800"
                >
                  <option value="General Physician">General Physician (Routine / Fever)</option>
                  <option value="OB-GYN">OB-GYN / Women's Health (Maternity)</option>
                  <option value="Cardiology / Emergency">Cardiology / Emergency (Critical)</option>
                  <option value="Pediatrics">Pediatrics (Child Care)</option>
                </select>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100">
              <span className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1.5 mb-2">
                <Heart size={14} className="text-red-500" /> {t.vitals_title || 'Frontline Field Vitals'}
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
                <div>
                  <label className="text-[11px] text-slate-600">{t.systolic_bp || 'Systolic BP'}</label>
                  <input
                    type="number"
                    value={formData.systolic_bp}
                    onChange={(e) => setFormData({ ...formData, systolic_bp: e.target.value })}
                    placeholder="120"
                    className="w-full mt-1 px-2.5 py-1.5 border rounded-lg text-sm border-slate-200 font-mono"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-600">{t.diastolic_bp || 'Diastolic BP'}</label>
                  <input
                    type="number"
                    value={formData.diastolic_bp}
                    onChange={(e) => setFormData({ ...formData, diastolic_bp: e.target.value })}
                    placeholder="80"
                    className="w-full mt-1 px-2.5 py-1.5 border rounded-lg text-sm border-slate-200 font-mono"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-600">{t.pulse || 'Pulse (bpm)'}</label>
                  <input
                    type="number"
                    value={formData.pulse}
                    onChange={(e) => setFormData({ ...formData, pulse: e.target.value })}
                    placeholder="74"
                    className="w-full mt-1 px-2.5 py-1.5 border rounded-lg text-sm border-slate-200 font-mono"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-600">{t.spo2 || 'SpO2 (%)'}</label>
                  <input
                    type="number"
                    value={formData.spo2}
                    onChange={(e) => setFormData({ ...formData, spo2: e.target.value })}
                    placeholder="98"
                    className="w-full mt-1 px-2.5 py-1.5 border rounded-lg text-sm border-slate-200 font-mono"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-600">{t.temp || 'Temp (°F)'}</label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.temperature}
                    onChange={(e) => setFormData({ ...formData, temperature: e.target.value })}
                    placeholder="98.6"
                    className="w-full mt-1 px-2.5 py-1.5 border rounded-lg text-sm border-slate-200 font-mono"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-600">{t.blood_glucose || 'Blood Glucose'}</label>
                  <input
                    type="number"
                    value={formData.blood_glucose}
                    onChange={(e) => setFormData({ ...formData, blood_glucose: e.target.value })}
                    placeholder="110"
                    className="w-full mt-1 px-2.5 py-1.5 border rounded-lg text-sm border-slate-200 font-mono"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700">{t.symptoms_label || 'Reported Symptoms'}</label>
              <textarea
                rows="2"
                required
                value={formData.symptoms}
                onChange={(e) => setFormData({ ...formData, symptoms: e.target.value })}
                placeholder={t.symptoms_placeholder || 'Describe patient complaints...'}
                className="w-full mt-1 px-3 py-2 border rounded-xl text-sm border-slate-200"
              ></textarea>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <label className="border border-dashed border-slate-300 rounded-xl p-3 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 transition">
                <Camera size={20} className="text-emerald-600 mb-1" />
                <span className="text-xs font-semibold text-slate-700">
                  {isCompressingPhoto
                    ? (t.compressing_photo || 'Compressing (2G Mode)...')
                    : photoBase64
                    ? (t.photo_compressed || '✓ Compressed Photo (~40KB)')
                    : (t.capture_photo || 'Capture Clinical Photo')}
                </span>
                <input type="file" accept="image/*" onChange={handlePhotoCapture} className="hidden" />
              </label>

              <div className="border border-dashed border-slate-300 rounded-xl p-3 flex flex-col items-center justify-center">
                {audioBase64 ? (
                  <span className="text-xs font-semibold text-emerald-600">{t.voice_ready || '✓ OPUS Voice Clip Ready'}</span>
                ) : isRecording ? (
                  <button type="button" onClick={stopRecording} className="text-xs bg-red-600 text-white px-3 py-1 rounded-lg">
                    <Square size={12} className="inline mr-1" /> {t.stop_recording || 'Stop Recording'}
                  </button>
                ) : (
                  <button type="button" onClick={startRecording} className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                    <Mic size={16} className="text-emerald-600" /> {t.record_voice || 'Record Voice Memo'}
                  </button>
                )}
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`w-full py-3 rounded-xl text-white font-bold text-sm transition shadow ${
                isEmergencyDetected ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'
              }`}
            >
              {loading ? (t.submitting || 'Submitting...') : (t.submit_queue || 'Submit & Queue Patient')}
            </button>
          </form>
        </div>
      )}

      {activeTab === 'records' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <History className="text-emerald-600" size={18} />
                Multi-ASHA Sub-Centre Registry
              </h2>
              <p className="text-xs text-slate-500">History of triaged patients submitted across multiple frontline ASHA workers</p>
            </div>
            <div className="relative w-full sm:w-60">
              <Search className="absolute left-3 top-2.5 text-slate-400" size={14} />
              <input
                type="text"
                placeholder="Search patient, asha, village..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs border rounded-xl border-slate-200"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider border-b border-slate-200">
                  <th className="p-2.5">Ticket</th>
                  <th className="p-2.5">Patient Details</th>
                  <th className="p-2.5">Department / Queue</th>
                  <th className="p-2.5">Priority</th>
                  <th className="p-2.5">Sync Channel</th>
                  <th className="p-2.5">Queue Status</th>
                  <th className="p-2.5 text-right">Tele-OPD</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRecords.map((item) => (
                  <tr key={item.ticket_id} className="hover:bg-slate-50">
                    <td className="p-2.5 font-mono font-bold text-slate-800">#{item.ticket_id}</td>
                    <td className="p-2.5">
                      <div className="font-bold text-slate-800">{item.patient_name}</div>
                      <div className="text-[11px] text-slate-500">{item.age}y • {item.gender} • {item.village}</div>
                      {item.live_address && (
                        <div className="text-[10px] text-emerald-800 font-medium mt-0.5 truncate max-w-xs">📍 {item.live_address}</div>
                      )}
                    </td>
                    <td className="p-2.5 font-semibold text-emerald-900">
                      {item.target_department || item.referral_dept || 'General Physician'}
                      <div className="text-[10px] text-slate-400 font-normal">{item.asha_name}</div>
                    </td>
                    <td className="p-2.5">
                      <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                        item.priority === 'RED' ? 'bg-red-100 text-red-700' :
                        item.priority === 'YELLOW' ? 'bg-amber-100 text-amber-800' :
                        'bg-emerald-100 text-emerald-800'
                      }`}>
                        {item.priority}
                      </span>
                    </td>
                    <td className="p-2.5">
                      <span className={`inline-flex items-center gap-1 font-mono text-[10px] font-bold px-2 py-0.5 rounded ${
                        item.sync_status === 'QUEUED_OFFLINE' ? 'bg-amber-100 text-amber-900' : 'bg-emerald-50 text-emerald-800'
                      }`}>
                        {item.sync_status === 'QUEUED_OFFLINE' ? <WifiOff size={10} /> : <Check size={10} />}
                        {item.sync_status || 'SYNCED_ONLINE'}
                      </span>
                    </td>
                    <td className="p-2.5">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        item.status === 'Completed' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}>
                        <CheckCircle size={10} /> {item.status}
                      </span>
                    </td>
                    <td className="p-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => setActiveCallPatient(item)}
                        className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold px-3 py-1 rounded-xl text-[11px] inline-flex items-center gap-1 shadow-sm transition"
                      >
                        <Video size={13} className="text-emerald-700" /> Call
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeCallPatient && (
        <VideoCallModal
          ticketId={activeCallPatient.ticket_id}
          isInitiator={false}
          callerRole="ASHA Worker"
          patient={activeCallPatient}
          onClose={() => {
            setIncomingCallAlert(null);
            setActiveCallPatient(null);
          }}
        />
      )}
    </div>
  );
}