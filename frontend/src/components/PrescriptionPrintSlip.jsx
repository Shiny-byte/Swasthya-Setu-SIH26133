import React, { useEffect } from 'react';
import { Printer, X, ShieldCheck, Pill, CheckCircle2, FileText } from 'lucide-react';

export default function PrescriptionPrintSlip({ ticket, prescriptionData, onClose }) {
  if (!ticket) return null;

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

  const rxDataText = `RX:${ticket.ticket_id}|${ticket.patient_name}|${prescriptionData?.medicines?.join(',')}`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(rxDataText)}`;

  return (
    <div 
      className="fixed inset-0 z-[99999] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-300 relative print:p-0 print:border-none print:shadow-none my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* CLOSE BUTTON */}
        <button
          type="button"
          onClick={onClose}
          className="absolute -top-3 -right-3 z-50 bg-slate-900 hover:bg-red-600 text-white w-10 h-10 rounded-full flex items-center justify-center shadow-2xl border-2 border-white transition print:hidden"
          title="Close Modal"
        >
          <X size={20} />
        </button>

        {/* TOP ACTION BAR */}
        <div className="flex justify-between items-center pb-4 mb-4 border-b border-slate-200 print:hidden">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
            <FileText size={16} className="text-emerald-600" /> PHC Digital e-Prescription Pass
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2 rounded-xl flex items-center gap-1.5 shadow transition"
            >
              <Printer size={15} /> Print / PDF
            </button>
            <button
              type="button"
              onClick={onClose}
              className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-4 py-2 rounded-xl transition"
            >
              Close
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
              <h1 className="text-lg font-black text-slate-900 mt-0.5">SWASTHYA SETU TELE-PRESCRIPTION (e-Rx)</h1>
              <p className="text-[11px] text-slate-600 font-semibold">
                Shirsuphal Primary Health Centre (PHC), Baramati Taluka, Pune
              </p>
            </div>
            <div className="text-right">
              <span className="inline-block px-3 py-1 rounded text-xs font-black uppercase border bg-emerald-100 border-emerald-600 text-emerald-900">
                Verified Rx
              </span>
              <p className="text-xs font-mono font-bold text-slate-700 mt-1">Ticket #{ticket.ticket_id}</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 items-center bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <div className="col-span-2 space-y-1 text-xs">
              <p><strong>Patient Name:</strong> {ticket.patient_name} ({ticket.age} yrs / {ticket.gender})</p>
              <p><strong>Village:</strong> {ticket.village || 'Shirsuphal'} • <strong>Phone:</strong> {ticket.phone || '+91 98XXXXXXXX'}</p>
              <p><strong>ABHA ID:</strong> <span className="font-mono font-bold text-emerald-800">{ticket.abha_id || '91-4421-8890-1204'}</span></p>
              <p><strong>Issued On:</strong> {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
            </div>
            <div className="flex flex-col items-center justify-center border-l border-slate-200 pl-2">
              <img
                src={qrCodeUrl}
                alt="ABDM e-Rx QR"
                className="w-24 h-24 border border-slate-300 rounded-lg p-1 bg-white shadow-sm"
              />
              <span className="text-[9px] font-mono text-slate-500 mt-1 uppercase text-center font-bold">
                Scan at PHC Pharmacy
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
              <Pill size={14} className="text-emerald-600" /> Prescribed Medications (Rx)
            </h3>
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
              {prescriptionData?.medicines && prescriptionData.medicines.length > 0 ? (
                prescriptionData.medicines.map((med, idx) => (
                  <div key={idx} className="flex justify-between items-center text-xs pb-2 border-b border-slate-200/60 last:border-none last:pb-0">
                    <span className="font-bold text-slate-800 flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center text-[10px] font-mono font-bold">
                        {idx + 1}
                      </span>
                      {med}
                    </span>
                    <span className="font-mono text-slate-600 text-[11px]">Qty: 1 Unit • 1 OD/BD</span>
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-500 italic">Oral rehydration & rest recommended.</p>
              )}
            </div>
          </div>

          <div className="text-xs space-y-1 bg-slate-50 p-3 rounded-xl border border-slate-200">
            <p><strong>Provisional Diagnosis:</strong> {prescriptionData?.diagnosis || 'General OPD Teleconsultation'}</p>
            <p><strong>Clinical Advice & Instructions:</strong> {prescriptionData?.advice || 'Take medicines as directed with clean boiled water. Visit PHC if symptoms persist.'}</p>
          </div>

          <div className="pt-4 border-t border-slate-300 flex justify-between items-end text-xs text-slate-600 print:flex">
            <div>
              <p className="font-mono text-[10px] font-bold text-emerald-800 flex items-center gap-1">
                <CheckCircle2 size={12} /> ABDM DIGITAL HEALTH RECORDS TOKEN
              </p>
              <p className="text-[10px]">Shirsuphal PHC Telemedicine Cell</p>
            </div>
            <div className="text-right">
              <p className="font-bold text-slate-900">Dr. R. Kulkarni, MBBS, DGO</p>
              <p className="text-[10px]">Reg. No: MMC/2018/04/1102</p>
              <p className="text-[10px]">Medical Officer In-Charge</p>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}