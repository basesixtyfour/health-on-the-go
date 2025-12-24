import React from 'react';
import { HeartPulse, Check } from 'lucide-react';

interface Specialty {
  id: string;
  label: string;
  fee: string;
}

interface SpecialtyCardProps {
  specialty: Specialty;
  isSelected: boolean;
  onSelect: (id: string) => void;
}

export const SpecialtyCard = ({ specialty, isSelected, onSelect }: SpecialtyCardProps) => (
  <button
    type="button"
    onClick={() => onSelect(specialty.id)}
    className={`relative p-6 rounded-2xl border transition-all duration-300 text-left group min-h-[120px] flex flex-col justify-between ${
      isSelected 
      ? 'border-blue-600 bg-blue-50/50 ring-1 ring-blue-600 shadow-md' 
      : 'border-slate-200 bg-white hover:border-blue-300 hover:shadow-sm'
    }`}
  >
    <div className="flex justify-between items-start">
      <div className="p-2 bg-slate-50 rounded-lg group-hover:bg-blue-50 transition-colors">
        <HeartPulse className={`h-4 w-4 ${isSelected ? 'text-blue-600' : 'text-slate-400'}`} />
      </div>
      {isSelected && (
        <div className="bg-blue-600 rounded-full p-1 animate-in zoom-in">
          <Check className="h-3 w-3 text-white stroke-[3px]" />
        </div>
      )}
    </div>
    
    <div>
      <div className={`font-bold transition-colors ${isSelected ? 'text-blue-700' : 'text-slate-900'}`}>
        {specialty.label}
      </div>
      <div className="mt-1 flex items-center justify-between">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Consultation</span>
        <span className="text-xs font-bold text-blue-600">
          {specialty.fee}
        </span>
      </div>
    </div>
  </button>
);