import React, { useState, useEffect } from 'react';
import Login from './components/Login';
import AshaTriage from './components/AshaTriage';
import DoctorQueue from './components/DoctorQueue';
import DistrictAdminDashboard from './components/DistrictAdminDashboard';
import LongitudinalRecords from './components/LongitudinalRecords';
import HighRiskFollowUp from './components/HighRiskFollowUp';
import PatientPortal from './components/PatientPortal';
import { LogOut, Activity, Globe, WifiOff, Download } from 'lucide-react';
import { translations } from './translations';

export default function App() {
  const [lang, setLang] = useState('en');
  const t = translations[lang] || translations.en;

  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstallable, setIsInstallable] = useState(false);

  // ALWAYS START WITH NULL SO LOGIN PAGE APPEARS EVERY TIME YOU OPEN THE PORTAL
  const [user, setUser] = useState(null);

  // Global shared state for current ASHA worker and Village jurisdiction initialized from user session
  const [currentAsha, setCurrentAsha] = useState({ 
    name: 'Anita Shinde', 
    village: 'Shirsuphal', 
    fullLabel: 'Anita Shinde (ASHA - Shirsuphal)' 
  });

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const handleBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  const handleInstallApp = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstallable(false);
    }
    setDeferredPrompt(null);
  };

  const [activeTab, setActiveTab] = useState('triage');

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  if (!user) {
    return (
      <Login
        lang={lang}
        onLoginSuccess={(u) => {
          setUser(u);
          const v = u.village || (u.facility_name?.includes('Baramati') ? 'Baramati Rural' : u.facility_name?.includes('Malegaon') ? 'Malegaon' : 'Shirsuphal');
          setCurrentAsha({ name: u.full_name, village: v, fullLabel: `${u.full_name} (${v})` });
          
          const role = u.role?.toUpperCase();
          if (role === 'ADMIN') setActiveTab('admin');
          else if (role === 'DOCTOR') setActiveTab('doctor');
          else if (role === 'PATIENT') setActiveTab('patient_portal');
          else setActiveTab('triage');
        }}
      />
    );
  }

  const role = user?.role?.toUpperCase();
  const displayVillage = currentAsha.village || user.village || 'Shirsuphal';

  return (
    <div className="min-h-screen bg-slate-100/70 flex flex-col font-sans">
      {!isOnline && (
        <div className="bg-amber-600 text-white text-xs font-semibold px-4 py-2 flex items-center justify-center gap-2 shadow-sm">
          <WifiOff size={16} />
          {t.offline_banner || 'Working Offline - Store-and-Forward Outbox Active'}
        </div>
      )}

      <header className="bg-white border-b border-slate-200 px-6 py-3 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-emerald-600 text-white rounded-xl">
            <Activity size={20} />
          </div>
          <div>
            <span className="font-bold text-slate-800 text-base">{t.app_title || 'Swasthya Setu'}</span>
            <span className="text-xs text-emerald-700 font-bold ml-2">
              | {user.facility_name || `${displayVillage} Sub-Centre / PHC`}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3.5">
          {isInstallable && (
            <button
              onClick={handleInstallApp}
              className="flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold px-3 py-1.5 rounded-lg shadow-sm transition"
            >
              <Download size={14} /> Install App
            </button>
          )}

          <div className="flex items-center gap-1 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
            <Globe size={14} className="text-slate-500" />
            <select
              value={lang}
              onChange={(e) => setLang(e.target.value)}
              className="bg-transparent text-xs font-semibold text-slate-700 outline-none cursor-pointer"
            >
              <option value="en">English</option>
              <option value="mr">मराठी (Marathi)</option>
              <option value="hi">हिन्दी (Hindi)</option>
            </select>
          </div>

          <span className="text-xs bg-slate-100 text-slate-700 px-3 py-1.5 rounded-full font-medium border border-slate-200">
            {user.full_name} <strong className="text-emerald-700 uppercase">({role})</strong>
          </span>

          <button
            onClick={handleLogout}
            className="text-slate-500 hover:text-red-600 transition p-1.5 rounded-lg hover:bg-slate-100"
            title="Logout"
          >
            <LogOut size={18} />
          </button>
        </div>
      </header>

      <nav className="bg-white border-b border-slate-200 px-6 flex gap-8 text-sm font-medium overflow-x-auto">
        {role === 'ASHA' && (
          <button
            onClick={() => setActiveTab('triage')}
            className={`py-3.5 border-b-2 font-semibold transition whitespace-nowrap ${
              activeTab === 'triage'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {t.asha_triage || 'ASHA Intake Desk'}
          </button>
        )}

        {role === 'DOCTOR' && (
          <button
            onClick={() => setActiveTab('doctor')}
            className={`py-3.5 border-b-2 font-semibold transition whitespace-nowrap ${
              activeTab === 'doctor'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {t.doctor_queue || 'Doctor Tele-OPD Queue'}
          </button>
        )}

        {role === 'PATIENT' && (
          <button
            onClick={() => setActiveTab('patient_portal')}
            className={`py-3.5 border-b-2 font-semibold transition whitespace-nowrap ${
              activeTab === 'patient_portal'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Patient Health Dashboard
          </button>
        )}

        {/* Longitudinal EHR available for ASHA, Doctor, and Admin */}
        {(role === 'ASHA' || role === 'DOCTOR' || role === 'ADMIN') && (
          <button
            onClick={() => setActiveTab('longitudinal')}
            className={`py-3.5 border-b-2 font-semibold transition whitespace-nowrap ${
              activeTab === 'longitudinal'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Longitudinal EHR
          </button>
        )}

        {/* High-Risk Follow-Up restricted only to ASHA and Doctor */}
        {(role === 'ASHA' || role === 'DOCTOR') && (
          <button
            onClick={() => setActiveTab('followup')}
            className={`py-3.5 border-b-2 font-semibold transition whitespace-nowrap ${
              activeTab === 'followup'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            High-Risk Follow-Up
          </button>
        )}

        {role === 'ADMIN' && (
          <button
            onClick={() => setActiveTab('admin')}
            className={`py-3.5 border-b-2 font-semibold transition whitespace-nowrap ${
              activeTab === 'admin'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {t.district_command || 'District Command Portal'}
          </button>
        )}
      </nav>

      <main className="p-6 flex-1 max-w-7xl w-full mx-auto">
        {activeTab === 'triage' && <AshaTriage lang={lang || 'en'} currentAsha={currentAsha} setCurrentAsha={setCurrentAsha} />}
        {activeTab === 'doctor' && <DoctorQueue lang={lang || 'en'} />}
        {activeTab === 'patient_portal' && <PatientPortal lang={lang || 'en'} />}
        {activeTab === 'longitudinal' && <LongitudinalRecords lang={lang || 'en'} />}
        {activeTab === 'followup' && <HighRiskFollowUp lang={lang || 'en'} currentAsha={currentAsha} />}
        {activeTab === 'admin' && <DistrictAdminDashboard lang={lang || 'en'} />}
      </main>
    </div>
  );
}