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
  MessageSquare, 
  X, 
  Smartphone,
  Video,
  WifiOff,
  SignalLow,
  SignalHigh,
  UploadCloud,
  Check,
  Menu,
  Home,
  Users as UsersIcon
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
import { getStoredPatients } from './AshaTriage';

export default function AshaMobileApp({ lang = 'en', onSwitchToDesktop = null }) {
  const t = translations[lang] || translations.en;

  const [activeTab, setActiveTab] = useState('new_intake');
  const [searchQuery, setSearchQuery] = useState('');

  const [formData, setFormData] = useState({
    patient_name: '',
    age: '',
    gender: 'Female',
    phone: '',
    village: 'Shirsuphal',
    abha_id: '',
    systolic_bp: '',
    diastolic_bp: '',
    pulse: '',
    spo2: '',
    temperature: '',
    blood_glucose: '',
    symptoms: '',
  });

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
      village: 'Shirsuphal',
      abha_id: '',
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

    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    const isLowBandwidth2G = conn && (conn.effectiveType === '2g' || conn.effectiveType === 'slow-2g');
    const isOffline = !navigator.onLine || isLowBandwidth2G;

    const newPatient = {
      ticket_id: nextSequentialId,
      patient_name: formData.patient_name,
      age: parseInt(formData.age, 10) || 0,
      gender: formData.gender,
      phone: formData.phone,
      village: formData.village,
      abha_id: generatedAbha,
      systolic_bp: formData.systolic_bp ? parseInt(formData.systolic_bp, 10) : 120,
      diastolic_bp: formData.diastolic_bp ? parseInt(formData.diastolic_bp, 10) : 80,
      pulse: formData.pulse ? parseInt(formData.pulse, 10) : 72,
      spo2: formData.spo2 ? parseInt(formData.spo2, 10) : 98,
      temperature: formData.temperature ? parseFloat(formData.temperature) : 98.6,
      blood_glucose: formData.blood_glucose ? parseInt(formData.blood_glucose, 10) : 110,
      symptoms: formData.symptoms,
      priority: priority,
      photo_base64: photoBase64,
      audio_base64: audioBase64,
      status: 'Waiting',
      sync_status: isOffline ? 'QUEUED_OFFLINE' : 'SYNCED_ONLINE',
      date: 'Just Now',
      diagnosis: priority === 'RED' ? 'Urgent Emergency Escalation' : 'General Teleconsult OPD',
      referral_dept: priority === 'RED' ? 'Emergency / ICU' : 'General OPD',
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
      message: `Namaskar ${formData.patient_name}, intake complete. New ABHA ID: ${generatedAbha}. Ticket #${nextSequentialId} [Priority: ${priority}].`
    };

    const ashaSms = {
      id: Date.now() + 2,
      recipient: 'ASHA Field Worker',
      phone: '+91 9823019201',
      message: `Intake Logged: ${formData.patient_name} (${formData.village}). ABHA: ${generatedAbha}. Ticket #${nextSequentialId} [${priority}].`
    };

    setSmsAlerts([patientSms, ashaSms]);

    setResult({
      ticket_id: nextSequentialId,
      priority: priority,
      isOffline,
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
    String(p.ticket_id).includes(searchQuery)
  );

  return (
    <div className="max-w-md mx-auto min-h-screen bg-slate-100 flex flex-col shadow-2xl relative border-x border-slate-300">
      
      {/* Top Mobile Status Header */}
      <div className="bg-emerald-700 text-white px-4 py-3 flex items-center justify-between sticky top-0 z-40 shadow-md">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-emerald-800 rounded-lg">
            <Smartphone size={18} className="text-emerald-200" />
          </div>
          <div>
            <h1 className="text-xs font-bold uppercase tracking-wider">Swasthya Setu ASHA PWA</h1>
            <p className="text-[10px] text-emerald-200">Shirsuphal Sub-Centre • Field Mode</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 bg-white/10 border border-white/20 text-white`}>
            {netInfo.status === 'OFFLINE' ? <WifiOff size={11} /> : netInfo.status === '2G_LOW' ? <SignalLow size={11} /> : <SignalHigh size={11} />}
            {netInfo.label}
          </span>
          {onSwitchToDesktop && (
            <button 
              onClick={onSwitchToDesktop}
              className="text-[10px] bg-emerald-800 hover:bg-emerald-900 px-2 py-1 rounded font-semibold text-white transition"
            >
              Desktop
            </button>
          )}
        </div>
      </div>

      {/* Floating SMS Toast Notifications */}
      {smsAlerts.length > 0 && (
        <div className="fixed top-14 left-4 right-4 z-50 space-y-2">
          {smsAlerts.map((alert) => (
            <div
              key={alert.id}
              className="bg-slate-900 text-white p-3 rounded-xl shadow-xl border border-slate-700 flex items-start justify-between gap-2"
            >
              <div className="flex items-start gap-2">
                <div className="p-1.5 bg-emerald-600 rounded-lg mt-0.5 shrink-0">
                  <Smartphone size={14} />
                </div>
                <div>
                  <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block">
                    SMS Sent • {alert.recipient}
                  </span>
                  <p className="text-[11px] text-slate-200 mt-0.5 leading-snug">
                    {alert.message}
                  </p>
                </div>
              </div>
              <button onClick={() => removeSmsAlert(alert.id)} className="text-slate-400 hover:text-white p-1">
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 p-3 pb-20 space-y-4 overflow-y-auto">

        {/* Outbox Banner */}
        {outboxCount > 0 && (
          <div className="bg-amber-50 border border-amber-300 p-2.5 rounded-xl flex items-center justify-between text-xs shadow-sm">
            <span className="font-semibold text-amber-900 flex items-center gap-1.5">
              <UploadCloud size={14} className={isSyncingOutbox ? 'animate-bounce text-amber-700' : ''} />
              {outboxCount} record(s) in local outbox queue
            </span>
            <button
              onClick={async () => {
                setIsSyncingOutbox(true);
                await syncOutbox();
                setOutboxCount(getOutboxCount());
                setPatientRecords(getStoredPatients());
                setIsSyncingOutbox(false);
              }}
              className="bg-amber-600 text-white font-bold px-2.5 py-1 rounded-lg text-[10px]"
            >
              Sync Now
            </button>
          </div>
        )}

        {/* Emergency Alert Banner */}
        {isEmergencyDetected && activeTab === 'new_intake' && (
          <div className="bg-red-50 border border-red-400 p-3 rounded-xl flex flex-col gap-2 shadow-sm animate-pulse">
            <div className="flex items-center gap-2">
              <Siren size={18} className="text-red-600 shrink-0" />
              <span className="font-bold text-xs text-red-950 uppercase">Critical Red Priority Detected</span>
            </div>
            <p className="text-[11px] text-red-800">
              Vitals indicate emergency. Dispatch 102/108 ambulance immediately.
            </p>
            <div className="flex gap-2 pt-1">
              <a href="tel:102" className="flex-1 bg-white border border-red-300 text-red-700 font-bold py-1.5 rounded-lg text-center text-xs">
                Call 102
              </a>
              <button
                onClick={() => setEmergencyStatus({ eta: 11, vehicle: 'MH-12-EM-1029' })}
                className="flex-1 bg-red-600 text-white font-bold py-1.5 rounded-lg text-xs"
              >
                Dispatch Ambulance
              </button>
            </div>
          </div>
        )}

        {emergencyStatus && (
          <div className="bg-red-700 text-white p-2.5 rounded-xl text-xs flex justify-between items-center shadow">
            <span>Ambulance dispatched. ETA: {emergencyStatus.eta}m</span>
            <button onClick={() => setEmergencyStatus(null)} className="font-bold px-2">✕</button>
          </div>
        )}

        {result && (
          <div className={`p-3 rounded-xl border flex items-center justify-between text-xs ${
            result.priority === 'RED' ? 'bg-red-50 border-red-200 text-red-900' : 'bg-emerald-50 border-emerald-200 text-emerald-900'
          }`}>
            <div className="flex items-center gap-2">
              <CheckCircle2 size={18} className={result.priority === 'RED' ? 'text-red-600' : 'text-emerald-600'} />
              <div>
                <span className="font-bold block">Ticket #{result.ticket_id} [{result.priority}]</span>
                <span className="text-[10px] opacity-80">SMS & ABHA successfully generated</span>
              </div>
            </div>
            <span className="font-bold text-[10px] bg-white px-2 py-0.5 rounded border">
              {result.isOffline ? 'Queued Offline' : 'Synced Online'}
            </span>
          </div>
        )}

        {/* Tab 1: New Intake Form */}
        {activeTab === 'new_intake' && (
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3.5">
            <div className="border-b pb-2 flex items-center gap-2">
              <Activity size={18} className="text-emerald-600" />
              <div>
                <h2 className="text-xs font-bold uppercase tracking-wide text-slate-800">ASHA Field Intake Form</h2>
                <p className="text-[10px] text-slate-500">Record patient vitals and symptoms offline</p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-700">Patient Full Name *</label>
                <input
                  type="text"
                  required
                  value={formData.patient_name}
                  onChange={(e) => setFormData({ ...formData, patient_name: e.target.value })}
                  placeholder="e.g. Pooja Deshmukh"
                  className="w-full mt-1 px-3 py-2 border rounded-xl text-xs border-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-semibold text-slate-700">Phone Number *</label>
                  <input
                    type="tel"
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="10-digit mobile"
                    className="w-full mt-1 px-3 py-2 border rounded-xl text-xs border-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-700">Village</label>
                  <input
                    type="text"
                    value={formData.village}
                    onChange={(e) => setFormData({ ...formData, village: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border rounded-xl text-xs border-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-semibold text-slate-700">Age</label>
                  <input
                    type="number"
                    required
                    value={formData.age}
                    onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                    placeholder="Age"
                    className="w-full mt-1 px-3 py-2 border rounded-xl text-xs border-slate-200"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-700">Gender</label>
                  <select
                    value={formData.gender}
                    onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border rounded-xl text-xs bg-white border-slate-200"
                  >
                    <option value="Female">Female</option>
                    <option value="Male">Male</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                <label className="text-[11px] font-semibold text-slate-700 flex items-center justify-between mb-1">
                  <span className="flex items-center gap-1"><CreditCard size={12} className="text-emerald-600" /> ABHA ID</span>
                  <span className="text-[9px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded">Auto-Create if Blank</span>
                </label>
                <input
                  type="text"
                  value={formData.abha_id}
                  onChange={(e) => setFormData({ ...formData, abha_id: e.target.value })}
                  placeholder="Leave blank for auto-ABHA"
                  className="w-full px-2.5 py-1.5 border rounded-lg text-xs bg-white border-slate-200 font-mono"
                />
              </div>

              <div className="pt-2 border-t border-slate-100">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block mb-1.5 flex items-center gap-1">
                  <Heart size={12} className="text-red-500" /> Field Vitals
                </span>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-600">Systolic BP</label>
                    <input
                      type="number"
                      value={formData.systolic_bp}
                      onChange={(e) => setFormData({ ...formData, systolic_bp: e.target.value })}
                      placeholder="120"
                      className="w-full mt-0.5 px-2 py-1 border rounded-lg text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-600">Diastolic BP</label>
                    <input
                      type="number"
                      value={formData.diastolic_bp}
                      onChange={(e) => setFormData({ ...formData, diastolic_bp: e.target.value })}
                      placeholder="80"
                      className="w-full mt-0.5 px-2 py-1 border rounded-lg text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-600">Pulse (bpm)</label>
                    <input
                      type="number"
                      value={formData.pulse}
                      onChange={(e) => setFormData({ ...formData, pulse: e.target.value })}
                      placeholder="74"
                      className="w-full mt-0.5 px-2 py-1 border rounded-lg text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-600">SpO2 (%)</label>
                    <input
                      type="number"
                      value={formData.spo2}
                      onChange={(e) => setFormData({ ...formData, spo2: e.target.value })}
                      placeholder="98"
                      className="w-full mt-0.5 px-2 py-1 border rounded-lg text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-600">Temp (°F)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={formData.temperature}
                      onChange={(e) => setFormData({ ...formData, temperature: e.target.value })}
                      placeholder="98.6"
                      className="w-full mt-0.5 px-2 py-1 border rounded-lg text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-600">Blood Glucose</label>
                    <input
                      type="number"
                      value={formData.blood_glucose}
                      onChange={(e) => setFormData({ ...formData, blood_glucose: e.target.value })}
                      placeholder="110"
                      className="w-full mt-0.5 px-2 py-1 border rounded-lg text-xs font-mono"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-700">Reported Symptoms *</label>
                <textarea
                  rows="2"
                  required
                  value={formData.symptoms}
                  onChange={(e) => setFormData({ ...formData, symptoms: e.target.value })}
                  placeholder="Describe patient complaints..."
                  className="w-full mt-1 px-3 py-2 border rounded-xl text-xs border-slate-200"
                ></textarea>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <label className="border border-dashed border-slate-300 rounded-xl p-2.5 flex flex-col items-center justify-center cursor-pointer bg-slate-50">
                  <Camera size={16} className="text-emerald-600 mb-1" />
                  <span className="text-[10px] font-semibold text-slate-700 text-center">
                    {isCompressingPhoto ? 'Compressing...' : photoBase64 ? '✓ Photo Ready' : 'Clinical Photo'}
                  </span>
                  <input type="file" accept="image/*" onChange={handlePhotoCapture} className="hidden" />
                </label>

                <div className="border border-dashed border-slate-300 rounded-xl p-2.5 flex flex-col items-center justify-center bg-slate-50">
                  {audioBase64 ? (
                    <span className="text-[10px] font-semibold text-emerald-600">✓ Voice Ready</span>
                  ) : isRecording ? (
                    <button type="button" onClick={stopRecording} className="text-[10px] bg-red-600 text-white px-2 py-1 rounded">
                      <Square size={10} className="inline mr-1" /> Stop
                    </button>
                  ) : (
                    <button type="button" onClick={startRecording} className="text-[10px] font-semibold text-slate-700 flex items-center gap-1">
                      <Mic size={14} className="text-emerald-600" /> Voice Memo
                    </button>
                  )}
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className={`w-full py-3 rounded-xl text-white font-bold text-xs shadow-md transition ${
                  isEmergencyDetected ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                {loading ? 'Submitting...' : 'Submit & Queue Patient'}
              </button>
            </form>
          </div>
        )}

        {/* Tab 2: Records & Registry */}
        {activeTab === 'records' && (
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
            <div className="flex justify-between items-center border-b pb-2">
              <div>
                <h2 className="text-xs font-bold uppercase tracking-wide text-slate-800">Sub-Centre Registry</h2>
                <p className="text-[10px] text-slate-500">All recorded patient tickets ({patientRecords.length})</p>
              </div>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-2.5 text-slate-400" size={13} />
              <input
                type="text"
                placeholder="Search patient, ticket..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs border rounded-xl border-slate-200"
              />
            </div>

            <div className="space-y-2.5">
              {filteredRecords.map((item) => (
                <div key={item.ticket_id} className="p-3 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="font-mono font-bold text-xs text-slate-800">#{item.ticket_id}</span>
                      <h4 className="font-bold text-xs text-slate-900">{item.patient_name}</h4>
                      <p className="text-[10px] text-slate-500">{item.age}y • {item.gender} • {item.village}</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full font-bold text-[9px] ${
                      item.priority === 'RED' ? 'bg-red-100 text-red-700' :
                      item.priority === 'YELLOW' ? 'bg-amber-100 text-amber-800' :
                      'bg-emerald-100 text-emerald-800'
                    }`}>
                      {item.priority}
                    </span>
                  </div>

                  <div className="flex justify-between items-center pt-2 border-t border-slate-200/60 text-[10px]">
                    <span className={`font-mono font-bold px-2 py-0.5 rounded ${
                      item.sync_status === 'QUEUED_OFFLINE' ? 'bg-amber-100 text-amber-900' : 'bg-emerald-50 text-emerald-800'
                    }`}>
                      {item.sync_status || 'SYNCED_ONLINE'}
                    </span>
                    <button
                      onClick={() => setActiveCallPatient(item)}
                      className="bg-emerald-600 text-white font-bold px-2.5 py-1 rounded-lg flex items-center gap-1 shadow-sm"
                    >
                      <Video size={12} /> Call Doctor
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>

      {/* Bottom Mobile Navigation Bar */}
      <div className="bg-white border-t border-slate-200 py-2.5 px-6 flex justify-around items-center fixed bottom-0 left-0 right-0 max-w-md mx-auto z-40 shadow-lg">
        <button
          onClick={() => setActiveTab('new_intake')}
          className={`flex flex-col items-center gap-1 transition ${activeTab === 'new_intake' ? 'text-emerald-600 font-bold' : 'text-slate-400'}`}
        >
          <UserPlus size={18} />
          <span className="text-[10px]">New Intake</span>
        </button>

        <button
          onClick={() => setActiveTab('records')}
          className={`flex flex-col items-center gap-1 transition ${activeTab === 'records' ? 'text-emerald-600 font-bold' : 'text-slate-400'}`}
        >
          <History size={18} />
          <span className="text-[10px]">Registry</span>
        </button>
      </div>

      {activeCallPatient && (
        <VideoCallModal
          ticketId={activeCallPatient.ticket_id}
          isInitiator={false}
          callerRole="ASHA Worker"
          patient={activeCallPatient}
          onClose={() => setActiveCallPatient(null)}
        />
      )}
    </div>
  );
}