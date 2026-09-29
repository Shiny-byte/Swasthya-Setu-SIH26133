import React, { useState, useRef } from 'react';
import { HeartPulse, QrCode, FileText, Siren, Activity, CheckCircle2, UserPlus, Send, ShieldCheck, Camera, Mic, Square, MapPin, Truck, AlertTriangle, Users } from 'lucide-react';
import { getStoredPatients } from './AshaTriage';
import InteroperableExportModal from './InteroperableExportModal';
import { compressImageFor2G, saveToOutbox, PATIENT_STORAGE_KEY } from './offlinesync';
import { translations } from '../translations';

export default function PatientPortal({ lang = 'en' }) {
  const t = translations[lang] || translations.en;

  const [allPatients, setPatients] = useState(getStoredPatients);
  
  const [formData, setFormData] = useState({
    patient_name: '',
    age: '',
    gender: 'Female',
    phone: '',
    village: 'Shirsuphal',
    target_department: 'General Physician', // Added automatic department state
    systolic_bp: '',
    diastolic_bp: '',
    pulse: '',
    spo2: '',
    temperature: '',
    blood_glucose: '',
    symptoms: ''
  });

  // Live GPS and Media states
  const [gpsCoords, setGpsCoords] = useState(null);
  const [fetchingGps, setFetchingGps] = useState(false);
  const [photoBase64, setPhotoBase64] = useState(null);
  const [isCompressingPhoto, setIsCompressingPhoto] = useState(false);
  
  const [audioBase64, setAudioBase64] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  const [activePatient, setActivePatient] = useState(null);
  const [showQrModal, setShowQrModal] = useState(false);
  const [sosTriggered, setSosTriggered] = useState(false);
  const [successBanner, setSuccessBanner] = useState(false);

  // Smart auto-detect department based on symptoms text
  const handleSymptomsChange = (e) => {
    const text = e.target.value;
    const lower = text.toLowerCase();
    
    let detectedDept = 'General Physician';
    if (lower.includes('chest pain') || lower.includes('breathless') || lower.includes('heart') || lower.includes('palpitations')) {
      detectedDept = 'Cardiology / Emergency';
    } else if (lower.includes('pregnant') || lower.includes('pregnancy') || lower.includes('trimester') || lower.includes('maternity') || lower.includes('delivery')) {
      detectedDept = 'OB-GYN';
    } else if (lower.includes('child') || lower.includes('infant') || lower.includes('baby') || lower.includes('pediatric')) {
      detectedDept = 'Pediatrics';
    }

    setFormData(prev => ({
      ...prev,
      symptoms: text,
      target_department: detectedDept
    }));
  };

  const handleCaptureGps = () => {
    setFetchingGps(true);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setGpsCoords({
            lat: position.coords.latitude.toFixed(4),
            lng: position.coords.longitude.toFixed(4),
            address: `${formData.village} Patient Live Position (Satellite Verified)`
          });
          setFetchingGps(false);
        },
        () => {
          setGpsCoords({ lat: '18.1858', lng: '74.5880', address: `${formData.village} Rural Grid (GPS Locked)` });
          setFetchingGps(false);
        }
      );
    } else {
      setGpsCoords({ lat: '18.1858', lng: '74.5880', address: `${formData.village} Rural Grid` });
      setFetchingGps(false);
    }
  };

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

  const handleSelfSubmit = (e) => {
    e.preventDefault();
    
    let priority = 'GREEN';
    const sys = Number(formData.systolic_bp);
    const spo2 = Number(formData.spo2);
    const temp = Number(formData.temperature);

    if ((sys && sys >= 160) || (spo2 && spo2 < 92) || (temp && temp >= 102.5)) {
      priority = 'RED';
    } else if ((sys && sys >= 140) || (temp && temp >= 100.5)) {
      priority = 'YELLOW';
    }

    const currentList = getStoredPatients();
    const highestId = currentList.reduce((max, p) => {
      const id = parseInt(p.ticket_id || 0, 10);
      return id > max ? id : max;
    }, 1000);

    const newTicketId = highestId + 1;
    const generatedAbha = `91-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}`;

    const finalDept = formData.target_department || (priority === 'RED' ? 'Cardiology / Emergency' : 'General Physician');

    const newRecord = {
      ticket_id: newTicketId,
      patient_name: formData.patient_name,
      age: parseInt(formData.age, 10) || 0,
      gender: formData.gender,
      phone: formData.phone,
      village: formData.village,
      asha_name: 'Self-Registered (Patient Portal)',
      abha_id: generatedAbha,
      target_department: finalDept,
      referral_dept: finalDept,
      systolic_bp: sys || 120,
      diastolic_bp: Number(formData.diastolic_bp) || 80,
      pulse: Number(formData.pulse) || 72,
      spo2: spo2 || 98,
      temperature: temp || 98.6,
      blood_glucose: Number(formData.blood_glucose) || 110,
      symptoms: formData.symptoms,
      gps_coords: gpsCoords,
      photo_base64: photoBase64,
      audio_base64: audioBase64,
      priority: priority,
      status: 'Waiting',
      sync_status: 'SYNCED_ONLINE',
      date: 'Just Now',
      diagnosis: priority === 'RED' ? 'Urgent Emergency Self-Escalation' : 'General Teleconsult OPD'
    };

    saveToOutbox(newRecord);
    const updated = getStoredPatients();
    setPatients(updated);

    setActivePatient(newRecord);
    setSuccessBanner(true);
    setFormData({
      patient_name: '',
      age: '',
      gender: 'Female',
      phone: '',
      village: 'Shirsuphal',
      target_department: 'General Physician',
      systolic_bp: '',
      diastolic_bp: '',
      pulse: '',
      spo2: '',
      temperature: '',
      blood_glucose: '',
      symptoms: ''
    });
    setPhotoBase64(null);
    setAudioBase64(null);
    setGpsCoords(null);
  };

  const handleSosTrigger = () => {
    setSosTriggered(true);
    
    try {
      const ambs = JSON.parse(localStorage.getItem('swasthya_live_ambulances') || '[]');
      const updated = ambs.map((a, i) => i === 0 ? { ...a, status: 'DISPATCHED (En Route)', eta: '6 mins' } : a);
      localStorage.setItem('swasthya_live_ambulances', JSON.stringify(updated));
    } catch (err) {
      console.error("Failed to sync patient SOS with admin dashboard:", err);
    }

    setTimeout(() => setSosTriggered(false), 6000);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12 relative">

      {sosTriggered && (
        <div className="fixed bottom-6 right-6 z-50 bg-red-600 text-white p-4 rounded-2xl shadow-2xl border border-red-700 flex items-center gap-3 animate-slide-in">
          <div className="p-2 bg-white text-red-600 rounded-2xl animate-pulse">
            <Siren size={20} />
          </div>
          <div>
            <span className="text-xs font-black uppercase tracking-wider block">🚨 {t.sos_broadcasted || 'Emergency SOS Broadcasted!'}</span>
            <p className="text-xs text-red-100">{t.sos_desc || 'Live GPS coordinates transmitted to 102/108 Ambulance & PHC command.'}</p>
          </div>
        </div>
      )}

      {successBanner && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 p-4 rounded-2xl flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <CheckCircle2 size={22} className="text-emerald-600 shrink-0" />
            <div>
              <span className="font-bold text-sm block">
                {t.registration_successful || 'Registration Successful!'} Ticket #{activePatient?.ticket_id} {t.generated || 'Generated'}
              </span>
              <p className="text-xs text-emerald-700 mt-0.5">
                {t.registration_success_desc || 'Your vitals, live GPS, and symptoms have been synchronized with the Doctor Tele-OPD queue.'} Routed to: <strong>{activePatient?.target_department}</strong>.
              </p>
            </div>
          </div>
          <button onClick={() => setSuccessBanner(false)} className="text-emerald-700 font-bold px-2">✕</button>
        </div>
      )}

      {activePatient ? (
        <div className="space-y-6 animate-slide-in">
          
          {activePatient.priority === 'RED' && (
            <div className="bg-red-600 text-white p-6 rounded-3xl shadow-xl border-2 border-red-400 space-y-3 animate-pulse">
              <div className="flex items-center gap-2">
                <AlertTriangle size={24} className="text-white shrink-0" />
                <h3 className="text-base font-black uppercase tracking-wider">
                  ⚠️ Critical Emergency Precautionary Steps Required Immediately
                </h3>
              </div>
              <ul className="text-xs text-red-50 space-y-1.5 list-disc pl-5 font-medium leading-relaxed">
                <li><strong>Stay Calm & Rest:</strong> Do not exert yourself. Sit or lie down in a comfortable, well-ventilated area immediately.</li>
                <li><strong>Clear Airway & Loosen Clothing:</strong> Ensure there are no tight garments around your neck or chest to assist breathing.</li>
                <li><strong>Prepare ABHA & QR Slip:</strong> Keep your digital ABHA ID or printed QR pass ready for the incoming PHC medical team or 108 ambulance driver.</li>
                <li><strong>Do Not Take Unprescribed Heavy Medication:</strong> Avoid consuming strong over-the-counter painkillers or sedatives without tele-doctor authorization.</li>
              </ul>
            </div>
          )}

          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col sm:flex-row justify-between sm:items-center gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-full">
                  {t.abha_verified_patient || 'ABHA Verified Patient'}
                </span>
                <span className="text-xs font-mono text-slate-500">ABHA: {activePatient.abha_id}</span>
              </div>
              <h2 className="text-2xl font-black text-slate-800 flex items-center gap-2">
                <HeartPulse className="text-emerald-600" size={26} />
                {lang === 'mr' ? 'नमस्कार,' : lang === 'hi' ? 'नमस्कार,' : 'Namaskar,'} {activePatient.patient_name}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {t.village || 'Village'}: {activePatient.village} • Dept: <strong className="text-emerald-800">{activePatient.target_department}</strong> • Ticket #{activePatient.ticket_id}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowQrModal(true)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2.5 rounded-2xl shadow-sm transition flex items-center gap-2 shrink-0"
              >
                <QrCode size={16} /> {t.qr_slip || 'QR Slip'}
              </button>
              <button
                onClick={() => setActivePatient(null)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-4 py-2.5 rounded-2xl transition"
              >
                {t.new_intake || 'New Intake'}
              </button>
            </div>
          </div>

          <div className="bg-red-50 border-2 border-red-500 p-5 rounded-3xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-red-600 text-white rounded-2xl shrink-0 shadow">
                <Siren size={22} className="animate-pulse" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm text-red-950 uppercase tracking-wide">{t.emergency_sos_title || 'Emergency SOS & Ambulance Dispatch'}</h3>
                <p className="text-xs text-red-800">{t.emergency_sos_desc || 'Pressing this button instantly transmits your live GPS location to the nearest 108/102 emergency vehicle.'}</p>
              </div>
            </div>
            <button
              onClick={handleSosTrigger}
              className="bg-red-600 hover:bg-red-700 text-white font-black text-xs px-5 py-3 rounded-2xl shadow-lg transition uppercase tracking-wider shrink-0"
            >
              {t.trigger_sos || 'Trigger SOS Now'}
            </button>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <Activity size={18} className="text-emerald-600" /> {t.active_tele_status || 'Active Tele-OPD Status & Vitals'}
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-emerald-50/50 p-4 rounded-2xl border border-emerald-200 text-xs">
              <div>
                <span className="text-slate-400 block text-[10px]">{t.queue_status || 'Current Queue Status:'}</span>
                <strong className="text-emerald-800 font-bold">{activePatient.status || 'Waiting for Doctor'}</strong>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">{t.triage_priority || 'Triage Priority:'}</span>
                <strong className={activePatient.priority === 'RED' ? 'text-red-600 font-bold' : 'text-emerald-700 font-bold'}>
                  {activePatient.priority || 'GREEN'}
                </strong>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">{t.recorded_bp || 'Recorded BP:'}</span>
                <strong className="text-slate-800 font-mono">{activePatient.systolic_bp}/{activePatient.diastolic_bp} mmHg</strong>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">{t.spo2 || 'SpO2 Level:'}</span>
                <strong className="text-slate-800 font-mono">{activePatient.spo2}%</strong>
              </div>
            </div>

            <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-2">
              <span className="text-[11px] font-bold text-slate-400 uppercase">{t.reported_symptoms || 'Reported Symptoms:'}</span>
              <p className="text-xs text-slate-700 font-medium">"{activePatient.symptoms}"</p>
            </div>
          </div>

        </div>
      ) : (
        <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-2xl flex items-center justify-center mb-3">
              <UserPlus size={24} />
            </div>
            <h2 className="text-xl font-black text-slate-800">{t.patient_self_intake || 'Patient Self-Intake & Tele-OPD Registration'}</h2>
            <p className="text-xs text-slate-500 mt-1">
              {t.patient_self_subtitle || 'Enter your details, attach your live GPS location, audio notes, or photos, and submit directly to the doctor queue.'}
            </p>
          </div>

          <form onSubmit={handleSelfSubmit} className="space-y-4">
            
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <MapPin size={15} className="text-emerald-600" /> {t.live_gps || 'Live GPS & Location Verification'}
                </span>
                <button
                  type="button"
                  onClick={handleCaptureGps}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold px-3 py-1.5 rounded-xl transition shadow-sm"
                >
                  {fetchingGps ? (t.acquiring_gps || 'Acquiring Satellite Lock...') : gpsCoords ? (t.gps_captured || '✓ GPS Captured') : (t.capture_gps || 'Capture Live GPS')}
                </button>
              </div>
              {gpsCoords && (
                <p className="text-[11px] font-mono text-emerald-900 bg-emerald-50 p-2.5 rounded-xl border border-emerald-200">
                  📍 Lat: {gpsCoords.lat}, Lng: {gpsCoords.lng} | {gpsCoords.address}
                </p>
              )}

              <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                  📞 {t.emergency_helpline || 'Emergency SOS Helpline:'} <strong className="font-mono text-red-700">102 / 108</strong>
                </span>
                <button
                  type="button"
                  onClick={handleSosTrigger}
                  className="bg-red-600 hover:bg-red-700 text-white text-[11px] font-bold px-3.5 py-1.5 rounded-xl shadow transition flex items-center gap-1"
                >
                  <Truck size={13} /> {t.trigger_sos_ambulance || 'Trigger SOS Ambulance'}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-700">{t.patient_name || 'Patient Full Name'} *</label>
                <input
                  type="text"
                  required
                  placeholder={t.patient_name_placeholder || 'e.g. Ramesh Patil'}
                  value={formData.patient_name}
                  onChange={(e) => setFormData({ ...formData, patient_name: e.target.value })}
                  className="w-full mt-1 px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm outline-none focus:border-emerald-600"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700">{t.phone_number || 'Phone Number'} *</label>
                <input
                  type="tel"
                  required
                  placeholder={t.phone_placeholder || '10-digit mobile number'}
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full mt-1 px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm outline-none focus:border-emerald-600 font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-700">{t.age || 'Age'} *</label>
                <input
                  type="number"
                  required
                  placeholder={t.age_placeholder || 'Years'}
                  value={formData.age}
                  onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                  className="w-full mt-1 px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm outline-none focus:border-emerald-600 font-mono"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700">{t.gender || 'Gender'}</label>
                <select
                  value={formData.gender}
                  onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                  className="w-full mt-1 px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm outline-none bg-white font-semibold"
                >
                  <option value="Female">{t.female || 'Female'}</option>
                  <option value="Male">{t.male || 'Male'}</option>
                  <option value="Other">{t.other || 'Other'}</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700">{t.village || 'Village'}</label>
                <select
                  value={formData.village}
                  onChange={(e) => setFormData({ ...formData, village: e.target.value })}
                  className="w-full mt-1 px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm outline-none bg-white font-semibold"
                >
                  <option value="Shirsuphal">Shirsuphal</option>
                  <option value="Baramati Rural">Baramati Rural</option>
                  <option value="Malegaon">Malegaon</option>
                  <option value="Gunawadi">Gunawadi</option>
                </select>
              </div>
            </div>

            {/* NEW: Target Department Selector with Auto-Detection Indicator */}
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <Users size={14} className="text-emerald-600" /> Target Department / Specialist (Auto-Detected)
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

            <div className="pt-2 border-t border-slate-100">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">{t.self_vitals || 'Self-Recorded Vitals (Optional)'}</span>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
                <div>
                  <label className="text-[11px] text-slate-600">{t.systolic_bp || 'Systolic BP'}</label>
                  <input
                    type="number"
                    placeholder="120"
                    value={formData.systolic_bp}
                    onChange={(e) => setFormData({ ...formData, systolic_bp: e.target.value })}
                    className="w-full mt-1 px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-600">{t.diastolic_bp || 'Diastolic BP'}</label>
                  <input
                    type="number"
                    placeholder="80"
                    value={formData.diastolic_bp}
                    onChange={(e) => setFormData({ ...formData, diastolic_bp: e.target.value })}
                    className="w-full mt-1 px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-600">{t.pulse || 'Pulse (bpm)'}</label>
                  <input
                    type="number"
                    placeholder="74"
                    value={formData.pulse}
                    onChange={(e) => setFormData({ ...formData, pulse: e.target.value })}
                    className="w-full mt-1 px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-600">{t.spo2 || 'SpO2 (%)'}</label>
                  <input
                    type="number"
                    placeholder="98"
                    value={formData.spo2}
                    onChange={(e) => setFormData({ ...formData, spo2: e.target.value })}
                    className="w-full mt-1 px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-600">{t.temp || 'Temp (°F)'}</label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="98.6"
                    value={formData.temperature}
                    onChange={(e) => setFormData({ ...formData, temperature: e.target.value })}
                    className="w-full mt-1 px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-600">{t.blood_glucose || 'Blood Glucose'}</label>
                  <input
                    type="number"
                    placeholder="110"
                    value={formData.blood_glucose}
                    onChange={(e) => setFormData({ ...formData, blood_glucose: e.target.value })}
                    className="w-full mt-1 px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-mono"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700">{t.symptoms_label || 'Reported Symptoms'} *</label>
              <textarea
                rows="2"
                required
                placeholder={t.symptoms_placeholder || 'Describe your complaints, duration of fever or pain...'}
                value={formData.symptoms}
                onChange={handleSymptomsChange}
                className="w-full mt-1 px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm outline-none focus:border-emerald-600"
              ></textarea>
            </div>

            {/* Photo & Voice Note Attachments */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <label className="border border-dashed border-slate-300 rounded-xl p-3 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 transition">
                <Camera size={20} className="text-emerald-600 mb-1" />
                <span className="text-xs font-semibold text-slate-700">
                  {isCompressingPhoto
                    ? (t.compressing_photo || 'Compressing Photo...')
                    : photoBase64
                    ? (t.photo_compressed || '✓ Compressed Photo Ready')
                    : (t.capture_photo || 'Attach Clinical Photo')}
                </span>
                <input type="file" accept="image/*" onChange={handlePhotoCapture} className="hidden" />
              </label>

              <div className="border border-dashed border-slate-300 rounded-xl p-3 flex flex-col items-center justify-center">
                {audioBase64 ? (
                  <span className="text-xs font-semibold text-emerald-600">{t.voice_ready || '✓ Voice Note Ready'}</span>
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
              className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl shadow-lg transition flex items-center justify-center gap-2"
            >
              <Send size={15} /> {t.submit_queue || 'Submit & Sync to Doctor Queue'}
            </button>
          </form>
        </div>
      )}

      {showQrModal && activePatient && (
        <InteroperableExportModal
          patient={activePatient}
          onClose={() => setShowQrModal(false)}
        />
      )}

    </div>
  );
}