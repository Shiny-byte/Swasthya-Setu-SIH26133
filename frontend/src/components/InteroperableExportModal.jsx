import React, { useRef } from 'react';
import { QrCode, Download, Printer, X, ShieldCheck, Activity, User, Building2 } from 'lucide-react';

export default function InteroperableExportModal({ patient, onClose }) {
  const printRef = useRef();

  const handlePrint = () => {
    const printContent = printRef.current.innerHTML;
    const originalContent = document.body.innerHTML;
    document.body.innerHTML = printContent;
    window.print();
    document.body.innerHTML = originalContent;
    window.location.reload();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden animate-slide-in">
        
        {/* Modal Header */}
        <div className="bg-emerald-700 text-white p-5 flex justify-between items-center">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/10 rounded-xl">
              <QrCode size={22} />
            </div>
            <div>
              <h3 className="font-bold text-base">ABHA Interoperable Health Record</h3>
              <p className="text-xs text-emerald-100">Standardized Cross-Facility Transfer Slip</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-emerald-100 hover:text-white p-1.5 rounded-xl hover:bg-white/10 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Printable / Exportable Body */}
        <div className="p-6 space-y-5 overflow-y-auto max-h-[75vh]" ref={printRef}>
          
          <div className="border border-slate-200 rounded-2xl p-4 space-y-4 bg-slate-50/50">
            <div className="flex justify-between items-start border-b border-slate-200 pb-3">
              <div>
                <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-widest block">National Health ID (ABHA)</span>
                <span className="font-mono font-black text-slate-800 text-base">{patient?.abha_id || '91-4421-8890-1204'}</span>
              </div>
              <span className="text-xs font-bold bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full border border-emerald-200">
                Ticket #{patient?.ticket_id || '1001'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-slate-400 block">Patient Name:</span>
                <strong className="text-slate-800 text-sm">{patient?.patient_name || 'Sunita Shinde'}</strong>
              </div>
              <div>
                <span className="text-slate-400 block">Demographics:</span>
                <strong className="text-slate-800">{patient?.age || 26} yrs • {patient?.gender || 'Female'}</strong>
              </div>
              <div>
                <span className="text-slate-400 block">Village / Sub-Centre:</span>
                <strong className="text-slate-800">{patient?.village || 'Shirsuphal'}</strong>
              </div>
              <div>
                <span className="text-slate-400 block">Triage Priority:</span>
                <strong className={patient?.priority === 'RED' ? 'text-red-600 font-bold' : 'text-emerald-700 font-bold'}>
                  {patient?.priority || 'GREEN'}
                </strong>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-200">
              <span className="text-[11px] font-bold text-slate-600 block mb-1">Latest Vitals Summary:</span>
              <div className="bg-white p-2.5 rounded-xl border border-slate-200 flex justify-between text-xs font-mono">
                <span>BP: <strong>{patient?.systolic_bp || 120}/{patient?.diastolic_bp || 80}</strong></span>
                <span>SpO2: <strong>{patient?.spo2 || 98}%</strong></span>
                <span>Pulse: <strong>{patient?.pulse || 72} bpm</strong></span>
              </div>
            </div>

            <div>
              <span className="text-[11px] font-bold text-slate-600 block mb-1">Clinical Diagnosis / Notes:</span>
              <p className="text-xs text-slate-700 bg-white p-2.5 rounded-xl border border-slate-200 italic">
                "{patient?.diagnosis || patient?.symptoms || 'General OPD consultation & longitudinal tracking record.'}"
              </p>
            </div>
          </div>

          {/* Simulated QR Code for Interoperability Scan */}
          <div className="flex flex-col items-center justify-center p-4 bg-white border border-dashed border-slate-300 rounded-2xl text-center">
            <div className="w-32 h-32 bg-slate-900 text-white rounded-xl flex items-center justify-center p-2 mb-2 shadow-inner">
              {/* Simulated QR matrix pattern */}
              <div className="grid grid-cols-6 gap-1 w-full h-full p-2 bg-white text-black font-mono text-[8px] font-bold items-center justify-center text-center">
                <span>██</span><span>░░</span><span>██</span><span>██</span><span>░░</span><span>██</span>
                <span>░░</span><span>██</span><span>░░</span><span>░░</span><span>██</span><span>░░</span>
                <span>██</span><span>░░</span><span>██</span><span>██</span><span>░░</span><span>██</span>
                <span>░░</span><span>██</span><span>░░</span><span>░░</span><span>██</span><span>░░</span>
                <span>██</span><span>██</span><span>░░</span><span>░░</span><span>██</span><span>██</span>
                <span>░░</span><span>░░</span><span>██</span><span>██</span><span>░░</span><span>░░</span>
              </div>
            </div>
            <span className="text-[10px] text-slate-500 font-mono">Scan via ABHA Gateway at District Hospital</span>
          </div>

        </div>

        {/* Modal Footer Actions */}
        <div className="bg-slate-50 p-4 border-t border-slate-200 flex justify-between items-center">
          <span className="text-[10px] text-slate-500 flex items-center gap-1">
            <ShieldCheck size={14} className="text-emerald-600" /> ABHA Standardized Health ID Format
          </span>
          <div className="flex gap-2">
            <button
              onClick={handlePrint}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl flex items-center gap-1.5 shadow-sm transition"
            >
              <Printer size={14} /> Print / Export PDF
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}