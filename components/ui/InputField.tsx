import React from 'react';

interface InputFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

export const InputField = ({ label, id, ...props }: InputFieldProps) => (
  <div className="space-y-2">
    <label 
      htmlFor={id} 
      className="text-xs font-bold text-slate-600 ml-1 uppercase tracking-tighter"
    >
      {label}
    </label>
    <input 
      id={id}
      {...props}
      className="w-full p-4 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all outline-none text-slate-900 placeholder:text-slate-400 shadow-sm"
    />
  </div>
);