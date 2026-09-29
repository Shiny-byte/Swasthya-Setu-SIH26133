import React, { useState } from 'react';
import { Pill, Check, X, Send, Stethoscope } from 'lucide-react';

export default function PrescriptionPad({ inventory = [], selectedMedicines = [], onSelectMedicine, onRemoveMedicine, onFinalize }) {
  const [customNote, setCustomNote] = useState('');

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
      <div className="flex justify-between items-center border-b border-slate-100 pb-3">
        <h3 className="text-sm font-black text-slate-800 flex items-center gap-2 uppercase tracking-wider">
          <Pill className="text-emerald-600" size={18} /> PHC Essential Drug Dispensing & e-Rx
        </h3>
        <span className="text-xs font-mono text-emerald-700 font-bold">Auto-SMS to Patient & ASHA</span>
      </div>

      {/* Available Essential Drugs Grid */}
      <div className="space-y-2">
        <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
          Available PHC Drugs (Click to Add to Prescription)
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {inventory.map((item, idx) => {
            const isStockout = item.quantity_available <= 0 || item.status === 'CRITICAL';
            const isAdded = selectedMedicines.includes(item.drug_name);
            return (
              <button
                key={item.id || idx}
                type="button"
                disabled={isStockout}
                onClick={() => onSelectMedicine(item.drug_name)}
                className={`p-2.5 rounded-xl text-left border text-xs transition flex flex-col justify-between ${
                  isStockout
                    ? 'bg-slate-50 opacity-50 cursor-not-allowed'
                    : isAdded
                    ? 'bg-emerald-50 border-emerald-500 text-emerald-900 font-bold'
                    : 'bg-white border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="flex justify-between items-start">
                  <span className="truncate font-semibold">{item.drug_name}</span>
                  {isAdded && <Check size={13} className="text-emerald-600 shrink-0" />}
                </div>
                <span className={`text-[10px] mt-1 font-mono ${isStockout ? 'text-red-500 font-bold' : 'text-emerald-700'}`}>
                  {isStockout ? 'OUT OF STOCK' : `${item.quantity_available} ${item.unit || 'units'}`}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Display Selected Prescription Cart */}
      {selectedMedicines.length > 0 && (
        <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
          <span className="text-[11px] font-bold text-slate-600 uppercase block tracking-wide">
            Finalized Prescription List (Ready for e-Rx & SMS):
          </span>
          <div className="flex flex-wrap gap-2">
            {selectedMedicines.map((med) => (
              <span
                key={med}
                className="bg-white border border-slate-300 text-slate-800 text-xs px-3 py-1.5 rounded-xl flex items-center gap-2 shadow-sm font-medium"
              >
                <Pill size={13} className="text-emerald-600" />
                {med}
                <button
                  type="button"
                  onClick={() => onRemoveMedicine(med)}
                  className="text-slate-400 hover:text-red-600 font-bold ml-1"
                >
                  <X size={13} />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}