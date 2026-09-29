import React, { useEffect } from 'react';
import { Printer, X, ShieldCheck, Building2, FileText, CheckCircle2, ArrowLeft } from 'lucide-react';

export default function ReferralPrintSlip({ ticket, referralData, onClose }) {
  if (!ticket) return null;

  // Allow closing via Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handlePrint = () => {
    window.print();
  };

  const qrDataText = `ABDM:${ticket.ticket_id}|${ticket.patient_name}|${ticket.priority}|${referralData?.facility || 'Sub-District'}`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(qrDataText)}`;

  return (
    <div 
      className="fixed inset-0 z-[99999] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto"
      onClick={onClose} // Clicking backdrop closes modal
    >
      <div 
        className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-300 relative print:p-0 print:border-none print:shadow-none my-auto"
        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside card
      >
        
        {/* STICKY TOP ACTION BAR FOR HACKATHON DEMO */}
        <div className="flex justify-between items-center bg-slate-900 text-white px-4 py-3 rounded-xl mb-4 print:hidden shadow-lg">
          <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-2">
            <FileText size={16} className="text-red-400" /> Authorized Emergency Referral Pass
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition shadow"
            >
              <Printer size={14} /> Print PDF
            </button>
            <button
              type="button"
              onClick={onClose}
              className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-3.5 py-1.5 rounded-lg transition flex items-center gap-1.5 shadow"
            >
              <ArrowLeft size={14} /> Close & Return to Queue
            </button>
          </div>
        </div>

        {/* PRINTABLE SLIP CONTENT */}
        <div className="border-2 border-slate-900 rounded-xl p-6 bg-white text-slate-900 space-y-4 font-sans print:border-2 print:p-4">
          
          <div className="flex items-start justify-between border-b-2 border-slate-900 pb-3">
            <div>
              <div className="flex items-center gap-1.5 text-xs font-black uppercase text-emerald-800">
                <ShieldCheck size={16} /> Government of Maharashtra • Public Health Department
              </div>
              <h1 className="text-lg font-black text-slate-900 mt-0.5">INTER-FACILITY EMERGENCY REFERRAL SLIP</h1>
              <p className="text-[11px] text-slate-600 font-semibold">
                Origin Facility: Shirsuphal Primary Health Centre (PHC), Baramati Taluka, Pune
              </p>
            </div>
            <div className="text-right">
              <span className={`inline-block px-3 py-1 rounded text-xs font-black uppercase border ${
                ticket.priority === 'RED'
                  ? 'bg-red-100 border-red-600 text-red-800'
                  : 'bg-amber-100 border-amber-600 text-amber-900'
              }`}>
                {ticket.priority} Priority
              </span>
              <p className="text-xs font-mono font-bold text-slate-700 mt-1">Ticket #{ticket.ticket_id}</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 items-center bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <div className="col-span-2 space-y-1 text-xs">
              <p><strong>Patient Name:</strong> {ticket.patient_name} ({ticket.age} yrs / {ticket.gender})</p>
              <p><strong>Village:</strong> {ticket.village || 'Shirsuphal'} • <strong>Phone:</strong> {ticket.phone || '98XXXXXXXX'}</p>
              <p><strong>ABHA ID:</strong> <span className="font-mono font-bold text-emerald-800">{ticket.abha_id || '91-4421-8890-1204'}</span></p>
              <p><strong>Referral Authorized:</strong> {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
            </div>
            <div className="flex flex-col items-center justify-center border-l border-slate-200 pl-2">
              <img
                src={qrCodeUrl}
                alt="ABDM Referral QR"
                className="w-24 h-24 border border-slate-300 rounded-lg p-1 bg-white shadow-sm"
              />
              <span className="text-[9px] font-mono text-slate-500 mt-1 uppercase text-center font-bold">
                Scan at Receiving Desk
              </span>
            </div>
          </div>

          <div>
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
              Field Intake Vitals (Recorded by ASHA)
            </h3>
            <div className="grid grid-cols-6 gap-2 text-center text-xs bg-slate-100 p-2.5 rounded-xl font-mono border border-slate-200">
              <div><span className="text-[10px] text-slate-500 block">BP</span>{ticket.systolic_bp || 120}/{ticket.diastolic_bp || 80}</div>
              <div><span className="text-[10px] text-slate-500 block">Pulse</span>{ticket.pulse || 72} bpm</div>
              <div><span className="text-[10px] text-slate-500 block">SpO2</span>{ticket.spo2 || 98}%</div>
              <div><span className="text-[10px] text-slate-500 block">Temp</span>{ticket.temperature || 98.6}°F</div>
              <div><span className="text-[10px] text-slate-500 block">Glucose</span>{ticket.blood_glucose || 110}</div>
              <div><span className="text-[10px] text-slate-500 block">Triage</span><strong className="text-red-700">{ticket.priority}</strong></div>
            </div>
          </div>

          <div className="border border-red-200 bg-red-50/60 p-3.5 rounded-xl space-y-1 text-xs">
            <div className="flex items-center gap-1.5 font-bold text-red-950 uppercase">
              <Building2 size={15} className="text-red-700" /> Target Receiving Institution
            </div>
            <div className="grid grid-cols-2 gap-2 text-slate-800 pt-1">
              <div><strong>Target Facility:</strong> {referralData?.facility || 'Baramati Sub-District Hospital'}</div>
              <div><strong>Speciality Dept:</strong> {referralData?.department || 'High-Risk OB-GYN / ICU'}</div>
              <div><strong>Transport Status:</strong> 102/108 Rural Ambulance En Route</div>
              <div><strong>Bed Status:</strong> ABDM Bed Queue Reserved</div>
            </div>
          </div>

          <div className="text-xs space-y-1 bg-slate-50 p-3 rounded-xl border border-slate-200">
            <p><strong>Provisional Clinical Impression:</strong> {referralData?.diagnosis || ticket.symptoms}</p>
            <p><strong>Clinical Reason for Escalation:</strong> {referralData?.reason || 'Critical vital threshold crossed requiring secondary/tertiary hospital intensive care.'}</p>
          </div>

          <div className="pt-4 border-t border-slate-300 flex justify-between items-end text-xs text-slate-600 print:flex">
            <div>
              <p className="font-mono text-[10px] font-bold text-emerald-800 flex items-center gap-1">
                <CheckCircle2 size={12} /> VERIFIED ABDM DIGITAL TOKEN
              </p>
              <p className="text-[10px]">Shirsuphal PHC Telemedicine Cell</p>
            </div>
            <div className="text-right">
              <p className="font-bold text-slate-900">Dr. Kulkarni, MBBS, DGO</p>
              <p className="text-[10px]">Reg. No: MMC/2018/04/1102</p>
              <p className="text-[10px]">Medical Officer In-Charge</p>
            </div>
          </div>

        </div>

        {/* BOTTOM STICKY CLOSE BUTTON FOR EASY ACCESS */}
        <div className="mt-4 pt-3 border-t border-slate-200 flex justify-end print:hidden">
          <button
            type="button"
            onClick={onClose}
            className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs px-6 py-2.5 rounded-xl shadow-lg transition flex items-center gap-2"
          >
            <X size={16} /> Close Referral Slip & Return to Queue
          </button>
        </div>

      </div>
    </div>
  );
}