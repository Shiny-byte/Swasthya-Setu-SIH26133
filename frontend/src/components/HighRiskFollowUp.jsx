import React, { useState, useEffect } from 'react';
import { AlertTriangle, Calendar, PhoneCall, CheckCircle2, Search, BellRing, UserCheck, Users } from 'lucide-react';
import { getStoredPatients } from './AshaTriage';

export default function HighRiskFollowUp({ lang = 'en', currentAsha }) {
  const [patients] = useState(getStoredPatients);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('ALL');
  
  // Dynamically syncs with the active ASHA/Village context passed from App.jsx
  const [selectedArea, setSelectedArea] = useState(currentAsha?.village || 'Shirsuphal');

  useEffect(() => {
    if (currentAsha?.village) {
      setSelectedArea(currentAsha.village);
    }
  }, [currentAsha]);

  const [smsSentId, setSmsSentId] = useState(null);

  const availableVillages = ['Shirsuphal', 'Baramati Rural', 'Malegaon', 'Gunawadi'];

  // High-risk registry tagged across different villages
  const [highRiskRegistry] = useState([
    {
      id: 'HR-501',
      name: 'Sunita Shinde',
      category: 'Maternal (3rd Trimester Preeclampsia)',
      asha: 'Anita Shinde',
      village: 'Shirsuphal',
      phone: '9822104590',
      lastVisit: '2026-08-01',
      nextScheduled: '2026-08-15',
      status: 'OVERDUE',
      riskLevel: 'RED'
    },
    {
      id: 'HR-502',
      name: 'Kavita Jadhav',
      category: 'Chronic Hypertension',
      asha: 'Sunita Pawar',
      village: 'Baramati Rural',
      phone: '9850123488',
      lastVisit: '2026-08-05',
      nextScheduled: '2026-08-20',
      status: 'PENDING',
      riskLevel: 'YELLOW'
    },
    {
      id: 'HR-503',
      name: 'Rohan Suresh Mane',
      category: 'Child Immunization (Infant - 9 Months)',
      asha: 'Priyanka Kale',
      village: 'Malegaon',
      phone: '9890112233',
      lastVisit: '2026-07-28',
      nextScheduled: '2026-08-12',
      status: 'OVERDUE',
      riskLevel: 'RED'
    },
    {
      id: 'HR-504',
      name: 'Ganpat Mane',
      category: 'Type 2 Diabetes / Chronic Care',
      asha: 'Anita Shinde',
      village: 'Shirsuphal',
      phone: '9822998877',
      lastVisit: '2026-08-10',
      nextScheduled: '2026-08-25',
      status: 'PENDING',
      riskLevel: 'YELLOW'
    }
  ]);

  const handleTriggerAutomatedSMS = (patient) => {
    setSmsSentId(patient.id);
    setTimeout(() => setSmsSentId(null), 4000);
  };

  const filtered = highRiskRegistry.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.category.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCat = filterCategory === 'ALL' || p.category.toUpperCase().includes(filterCategory);
    const matchesArea = p.village === selectedArea; // Dynamically matches respective area
    return matchesSearch && matchesCat && matchesArea;
  });

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12 relative">

      {smsSentId && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white p-4 rounded-2xl shadow-2xl border border-slate-700 flex items-center gap-3 animate-slide-in">
          <div className="p-2 bg-emerald-600 rounded-xl">
            <BellRing size={18} />
          </div>
          <div>
            <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider block">Automated Follow-Up Triggered</span>
            <p className="text-xs text-slate-200">SMS reminder & area ASHA escalation alert dispatched successfully.</p>
          </div>
        </div>
      )}

      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
            <AlertTriangle className="text-amber-500" size={22} />
            Area-Wise High-Risk Patient Follow-Up Queue
          </h2>
          <p className="text-xs text-slate-500">
            Targeted tracking registry automatically filtering records based on respective ASHA village assignment
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Dynamic Village / Area Selector */}
          <div className="flex items-center gap-1.5 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200">
            <Users size={14} className="text-emerald-600" />
            <select
              value={selectedArea}
              onChange={(e) => setSelectedArea(e.target.value)}
              className="bg-transparent text-xs font-bold text-emerald-900 outline-none cursor-pointer"
            >
              {availableVillages.map((village, idx) => (
                <option key={idx} value={village}>Village: {village}</option>
              ))}
            </select>
          </div>

          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none bg-white font-semibold text-slate-700"
          >
            <option value="ALL">All Categories</option>
            <option value="MATERNAL">Maternal Care</option>
            <option value="CHILD">Child Immunization</option>
            <option value="CHRONIC">Chronic Conditions</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-red-50 text-red-600 rounded-xl">
            <AlertTriangle size={22} />
          </div>
          <div>
            <span className="text-xs text-slate-400 font-bold uppercase">Overdue in {selectedArea}</span>
            <h3 className="text-xl font-black text-slate-800">
              {filtered.filter(p => p.status === 'OVERDUE').length} Cases
            </h3>
          </div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <UserCheck size={22} />
          </div>
          <div>
            <span className="text-xs text-slate-400 font-bold uppercase">{selectedArea} Registry</span>
            <h3 className="text-xl font-black text-slate-800">{filtered.length} Patients</h3>
          </div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-sky-50 text-sky-600 rounded-xl">
            <Calendar size={22} />
          </div>
          <div>
            <span className="text-xs text-slate-400 font-bold uppercase">Active Jurisdiction</span>
            <h3 className="text-sm font-black text-emerald-700">{selectedArea} Sub-Centre</h3>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 font-bold text-slate-800 text-xs flex justify-between items-center">
          <span>Vulnerable Population Schedule ({selectedArea} Village Area)</span>
          <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-lg">Respects Respective ASHA Area</span>
        </div>
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-50 text-slate-600 border-b border-slate-200">
              <th className="p-3 font-semibold">Patient & Category</th>
              <th className="p-3 font-semibold">Village & ASHA Worker</th>
              <th className="p-3 font-semibold">Last Visit</th>
              <th className="p-3 font-semibold">Next Scheduled</th>
              <th className="p-3 font-semibold">Status</th>
              <th className="p-3 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50/60 transition">
                <td className="p-3">
                  <div className="font-bold text-slate-800">{p.name} <span className="text-slate-400 font-normal">({p.phone})</span></div>
                  <div className="text-[11px] text-emerald-800 font-medium">{p.category}</div>
                </td>
                <td className="p-3">
                  <div className="font-bold text-slate-800">{p.village}</div>
                  <div className="text-[11px] text-slate-500">ASHA: {p.asha}</div>
                </td>
                <td className="p-3 font-mono text-slate-500">{p.lastVisit}</td>
                <td className="p-3 font-mono font-bold text-slate-700">{p.nextScheduled}</td>
                <td className="p-3">
                  <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                    p.status === 'OVERDUE' ? 'bg-red-100 text-red-700 animate-pulse' : 'bg-emerald-100 text-emerald-700'
                  }`}>
                    {p.status}
                  </span>
                </td>
                <td className="p-3 text-right">
                  <button
                    onClick={() => handleTriggerAutomatedSMS(p)}
                    className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold px-3 py-1.5 rounded-xl text-[11px] inline-flex items-center gap-1.5 shadow-sm transition"
                  >
                    <BellRing size={13} /> Trigger Alert
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan="6" className="text-center py-8 text-slate-400 text-xs">
                  No high-risk patients registered under {selectedArea} jurisdiction.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}