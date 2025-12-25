import React from 'react';
import { Check } from 'lucide-react';

interface ConsentBannerProps {
  isChecked: boolean;
  onToggle: () => void;
}

export const ConsentBanner = ({ isChecked, onToggle }: ConsentBannerProps) => (
  <div 
    onClick={onToggle}
    className={`p-5 rounded-2xl border transition-all cursor-pointer flex gap-4 ${
      isChecked ? 'bg-slate-900 border-slate-900 shadow-lg' : 'bg-white border-slate-200 hover:border-slate-300'
    }`}
  >
    <div className="pt-1">
      <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${
        isChecked ? 'bg-blue-500 border-blue-500' : 'bg-slate-100 border-slate-300'
      }`}>
        {isChecked && <Check className="h-3.5 w-3.5 text-white stroke-[3px]" />}
      </div>
    </div>
    <div className="space-y-1">
      <p className={`text-xs font-bold leading-tight ${isChecked ? 'text-white' : 'text-slate-900'}`}>
        Telehealth Consent & Privacy Acknowledgement
      </p>
      <p className={`text-[11px] leading-relaxed ${isChecked ? 'text-slate-400' : 'text-slate-500'}`}>
        I agree to virtual care terms. My clinical data will be isolated and encrypted via AES-256 in accordance with HIPAA standards.
      </p>
    </div>
  </div>
);