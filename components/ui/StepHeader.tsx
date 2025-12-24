import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StepHeaderProps {
  icon: LucideIcon;
  title: string;
  stepNumber: string;
}

export const StepHeader = ({ icon: Icon, title, stepNumber }: StepHeaderProps) => (
  <div className="flex items-center gap-3 mb-6">
    <div className="flex-none w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 text-xs font-bold border border-slate-200">
      {stepNumber}
    </div>
    <h2 className="text-sm font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
      <Icon className="h-4 w-4" /> {title}
    </h2>
  </div>
);