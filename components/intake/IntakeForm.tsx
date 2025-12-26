"use client";
import React, { useState } from 'react';
import {
  UserCircle,
  Stethoscope,
  ShieldCheck,
  ChevronRight,
  ChevronLeft,
  Loader2,
  AlertCircle,
  Activity,
  DollarSign
} from 'lucide-react';

// Import Constants
import { SPECIALTIES, AGE_RANGES, getSpecialtyPrice } from '@/lib/constants';

// Import Modular Components
import { InputField } from '@/components/ui/InputField';
import { SpecialtyCard } from '@/components/intake/SpecialtyCard';
import { ConsentBanner } from '@/components/intake/ConsentBanner';

export interface IntakeFormData {
  specialty: string;
  nameOrAlias: string;
  ageRange: string;
  chiefComplaint: string;
  consent: boolean;
}

interface IntakeFormProps {
  onSuccess?: (consultationId: string) => void;
  onSubmit?: (data: IntakeFormData) => Promise<void>;
  onBack?: () => void;
  defaultSpecialty?: string;
  isSubmitting?: boolean;
}



export default function IntakeForm({ onSuccess, onSubmit, onBack, defaultSpecialty, isSubmitting = false }: IntakeFormProps) {
  const [internalLoading, setInternalLoading] = useState(false);
  const [error, setError] = useState("");
  const [formData, setFormData] = useState<IntakeFormData>({
    specialty: defaultSpecialty || '',
    nameOrAlias: '',
    ageRange: '',
    chiefComplaint: '',
    consent: false
  });
  const [specialtyTouched, setSpecialtyTouched] = useState(false);

  React.useEffect(() => {
    if (defaultSpecialty && !specialtyTouched) {
      setFormData(prev => ({ ...prev, specialty: defaultSpecialty }));
    }
  }, [defaultSpecialty, specialtyTouched]);

  const loading = isSubmitting || internalLoading;
  const hasPreSelectedSpecialty = !!defaultSpecialty;
  const selectedSpecialtyInfo = SPECIALTIES.find(s => s.id === formData.specialty);

  // Get dynamic consultation fee based on selected specialty
  const consultationFee = getSpecialtyPrice(formData.specialty);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (onSubmit) {
      await onSubmit(formData);
      return;
    }

    setInternalLoading(true);
    // Fallback handler for standalone form usage
    setTimeout(() => {
      if (process.env.NODE_ENV === 'development') {
        // Only use fake ID in development for testing purposes
        if (onSuccess) onSuccess(`c_${crypto.randomUUID()}`);
      } else {
        // In production, warn that onSubmit should be provided
        console.warn('[IntakeForm] Neither onSubmit nor onSuccess handler provided - form submission will have no effect in production');
      }
      setInternalLoading(false);
    }, 1500);
  };

  return (
    <div className="max-w-4xl mx-auto py-6 px-4">
      {/* Compact Header */}
      <div className="flex items-center gap-4 mb-6">
        <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center">
          <Activity className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Patient Intake</h1>
          <p className="text-sm text-slate-500">Complete your details to proceed</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Form Fields */}
          <div className="lg:col-span-2 space-y-5">
            {/* Price Summary - Show when specialty is pre-selected */}
            {hasPreSelectedSpecialty && (
              <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-100 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-600">Specialty</p>
                  <p className="font-semibold text-slate-900">{selectedSpecialtyInfo?.label || formData.specialty}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-600">Fee</p>
                  <p className="text-2xl font-bold text-emerald-600">${consultationFee}</p>
                </div>
              </div>
            )}

            {/* Specialty Selection - Only if NOT pre-selected */}
            {!hasPreSelectedSpecialty && (
              <div>
                <label className="text-xs font-semibold text-slate-700 mb-2 block">Consultation Type</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {SPECIALTIES.map((s) => (
                    <button
                      type="button"
                      key={s.id}
                      onClick={() => {
                        setFormData({ ...formData, specialty: s.id });
                        setSpecialtyTouched(true);
                      }}
                      className={`p-3 rounded-lg border text-sm transition-all flex flex-col items-center gap-1 ${formData.specialty === s.id
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-blue-300'
                        }`}
                    >
                      <span className="font-medium">{s.label}</span>
                      <span className={`text-xs ${formData.specialty === s.id ? 'text-blue-100' : 'text-emerald-600 font-semibold'}`}>${s.price}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Name and Age Row */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 mb-1 block">Name or Alias *</label>
                <input
                  type="text"
                  required
                  placeholder="John Doe"
                  className="w-full p-3 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none"
                  value={formData.nameOrAlias}
                  onChange={e => setFormData({ ...formData, nameOrAlias: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 mb-1 block">Age Range *</label>
                <select
                  required
                  className="w-full p-3 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none"
                  value={formData.ageRange}
                  onChange={e => setFormData({ ...formData, ageRange: e.target.value })}
                >
                  <option value="">Select</option>
                  {AGE_RANGES.map(range => <option key={range} value={range}>{range}</option>)}
                </select>
              </div>
            </div>

            {/* Chief Complaint */}
            <div>
              <label className="text-xs font-semibold text-slate-700 mb-1 block">Chief Medical Complaint *</label>
              <textarea
                required
                placeholder="Describe your symptoms or reason for visit..."
                className="w-full p-3 bg-white border border-slate-200 rounded-lg h-24 text-sm focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none resize-none"
                value={formData.chiefComplaint}
                onChange={e => setFormData({ ...formData, chiefComplaint: e.target.value })}
              />
            </div>
          </div>

          {/* Right Column - Consent & Submit */}
          <div>
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-lg space-y-4 sticky top-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <ShieldCheck className="h-4 w-4 text-blue-600" /> Consent & Payment
              </div>

              <ConsentBanner
                isChecked={formData.consent}
                onToggle={() => setFormData({ ...formData, consent: !formData.consent })}
              />

              {error && (
                <div className="p-3 bg-red-50 text-red-600 rounded-lg text-xs font-medium flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" /> {error}
                </div>
              )}

              {hasPreSelectedSpecialty && (
                <div className="text-center py-2 border-t border-slate-100">
                  <p className="text-xs text-slate-500">Total</p>
                  <p className="text-xl font-bold text-slate-900">${consultationFee} USD</p>
                </div>
              )}

              <div className="space-y-3">
                {onBack && (
                  <button
                    type="button"
                    onClick={onBack}
                    disabled={loading}
                    className="w-full bg-slate-100 text-slate-700 py-3 rounded-xl font-semibold text-sm hover:bg-slate-200 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Back
                  </button>
                )}

                <button
                  disabled={loading || !formData.specialty || !formData.consent}
                  className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold text-sm shadow-lg shadow-blue-200 hover:bg-blue-700 disabled:bg-slate-200 disabled:shadow-none disabled:text-slate-400 transition-all flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <Loader2 className="animate-spin h-4 w-4" />
                  ) : (
                    <>Proceed to Payment <ChevronRight className="h-4 w-4" /></>
                  )}
                </button>

                <p className="text-[9px] text-center text-slate-400 font-medium uppercase tracking-wide">
                  HIPAA • Encrypted • Square
                </p>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}