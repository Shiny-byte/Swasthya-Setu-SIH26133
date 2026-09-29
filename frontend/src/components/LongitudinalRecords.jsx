import React, { useState } from 'react';
import { History, FileText, Calendar, Activity, AlertCircle, Search, User, QrCode } from 'lucide-react';
import { getStoredPatients } from './AshaTriage';
import InteroperableExportModal from './InteroperableExportModal';

export default function LongitudinalRecords({ lang = 'en' }) {
  const [patientsList] = useState(getStoredPatients);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPatientId, setSelectedPatientId] = useState(patientsList[0]?.ticket_id || null);
  const [exportingPatient, setExportingPatient] = useState(null);

  // Group or simulate longitudinal multi-visit history for the selected patient
  const currentPatient = patientsList.find(p => p.ticket_id === selectedPatientId) || patientsList[0];

  // Mock past historical encounters for longitudinal view
  const historicalVisits = [
    {
      date: '10 Days Ago',
      facility: 'Shirsuphal PHC Sub-Centre',
      asha: currentPatient?.asha_name || 'Anita Shinde',
      diagnosis: 'Routine Antenatal Follow-up',
      bp: '124/82 mmHg',
      weight: '62 kg',
      notes: 'Patient stable. Prescribed Iron & Folic Acid supplements.'
    },
    {
      date: '1 Month Ago',
      facility: 'Baramati Mobile Health Camp',
      asha: 'Sunita Pawar',
      diagnosis: 'Initial Screening / Registration',
      bp: '130/84 mmHg',
      weight: '61.5 kg',
      notes: 'ABHA ID generated. Baseline blood sugar normal.'
    }
  ];

  const filteredPatients = patientsList.filter(p => 
    p.patient_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    String(p.ticket_id).includes(searchQuery) ||
    (p.abha_id && p.abha_id.includes(searchQuery))
  );

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
            <History className="text-emerald-600" size={22} />
            Longitudinal Electronic Health Records (EHR)
          </h2>
          <p className="text-xs text-slate-500">
            Multi-encounter patient history, chronic disease tracking, and cross-facility visit timelines
          </p>
        </div>
        
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-2.5 text-slate-400" size={14} />
          <input
            type="text"
            placeholder="Search by name, ticket, ABHA..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-xs border rounded-xl border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Patient Selection Sidebar */}
        <div className="lg:col-span-4 space-y-3">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400 px-1">
            Registered Patients ({filteredPatients.length})
          </span>

          <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
            {filteredPatients.map((p) => {
              const isSelected = currentPatient?.ticket_id === p.ticket_id;
              return (
                <div
                  key={p.ticket_id}
                  onClick={() => setSelectedPatientId(p.ticket_id)}
                  className={`p-3.5 rounded-2xl border transition cursor-pointer ${
                    isSelected
                      ? 'border-emerald-600 bg-emerald-50/30 shadow-sm ring-2 ring-emerald-500/20'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-bold text-slate-800 text-sm">{p.patient_name}</span>
                    <span className="text-[10px] font-mono text-slate-500">#{p.ticket_id}</span>
                  </div>
                  <div className="text-xs text-slate-500">
                    {p.age}y • {p.gender} • <span className="font-mono text-emerald-700">{p.abha_id || 'ABHA Linked'}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Detailed Longitudinal Timeline */}
        {currentPatient ? (
          <div className="lg:col-span-8 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
            
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
                  <User className="text-emerald-600" size={20} />
                  {currentPatient.patient_name}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  ABHA ID: <span className="font-mono font-bold text-emerald-700">{currentPatient.abha_id || '91-4421-8890-1204'}</span> • Village: {currentPatient.village}
                </p>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-xs bg-slate-100 text-slate-700 font-bold px-3 py-1.5 rounded-xl border border-slate-200">
                  Primary Condition: {currentPatient.diagnosis || 'General Triage'}
                </span>
                <button
                  type="button"
                  onClick={() => setExportingPatient(currentPatient)}
                  className="bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-300 font-bold px-3.5 py-1.5 rounded-xl text-xs inline-flex items-center gap-1.5 shadow-sm transition"
                >
                  <QrCode size={14} /> Export ABHA QR
                </button>
              </div>
            </div>

            {/* Current Active Encounter Card */}
            <div className="bg-emerald-50/50 border border-emerald-200 p-4 rounded-2xl space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs font-black text-emerald-900 uppercase tracking-wide flex items-center gap-1.5">
                  <Activity size={14} className="text-emerald-600" /> Current Active Encounter (Today)
                </span>
                <span className="text-[10px] bg-emerald-600 text-white font-bold px-2.5 py-0.5 rounded-full">
                  {currentPatient.status || 'Waiting'}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-1">
                <div>
                  <span className="text-slate-400 block text-[10px]">BP Vitals:</span>
                  <strong className="text-slate-800 font-mono">{currentPatient.systolic_bp}/{currentPatient.diastolic_bp} mmHg</strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">SpO2 / Pulse:</span>
                  <strong className="text-slate-800 font-mono">{currentPatient.spo2}% / {currentPatient.pulse} bpm</strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Reporting ASHA:</span>
                  <strong className="text-slate-800">{currentPatient.asha_name || 'Anita Shinde'}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Priority:</span>
                  <strong className={currentPatient.priority === 'RED' ? 'text-red-600 font-bold' : 'text-emerald-700 font-bold'}>
                    {currentPatient.priority || 'GREEN'}
                  </strong>
                </div>
              </div>
            </div>

            {/* Historical Visit Timeline */}
            <div className="space-y-4">
              <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Calendar size={14} /> Historical Cross-Facility Encounters
              </h4>

              <div className="relative border-l-2 border-slate-200 ml-3 space-y-6 pl-4">
                {historicalVisits.map((visit, idx) => (
                  <div key={idx} className="relative space-y-1.5">
                    {/* Timeline dot */}
                    <span className="absolute -left-[21px] top-1 w-3 h-3 rounded-full bg-emerald-600 ring-4 ring-white"></span>
                    
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-slate-800">{visit.diagnosis}</span>
                      <span className="text-[10px] font-mono bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{visit.date}</span>
                    </div>
                    
                    <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-200 leading-relaxed">
                      {visit.notes}
                    </p>

                    <div className="flex gap-4 text-[11px] text-slate-400 pt-0.5">
                      <span>Facility: <strong className="text-slate-600">{visit.facility}</strong></span>
                      <span>Recorded By: <strong className="text-slate-600">{visit.asha}</strong></span>
                      <span>BP: <strong className="text-slate-600 font-mono">{visit.bp}</strong></span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        ) : (
          <div className="lg:col-span-8 bg-white p-12 rounded-2xl border border-slate-200 text-center text-slate-400">
            Select a patient to view longitudinal history.
          </div>
        )}

      </div>

      {exportingPatient && (
        <InteroperableExportModal
          patient={exportingPatient}
          onClose={() => setExportingPatient(null)}
        />
      )}
    </div>
  );
}