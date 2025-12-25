"use client";
import React, { useState } from 'react';
import {
  UserCircle,
  Stethoscope,
  ShieldCheck,
  ChevronRight,
  Loader2,
  AlertCircle,
  Activity
} from 'lucide-react';

// Import Constants
import { SPECIALTIES, AGE_RANGES } from '@/lib/constants';

// Import Modular Components
import { InputField } from '@/components/ui/InputField';
import { StepHeader } from '@/components/ui/StepHeader';
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
  // If provided, this overrides the internal submission logic
  onSubmit?: (data: IntakeFormData) => Promise<void>;
  defaultSpecialty?: string;
  isSubmitting?: boolean;
}

export default function IntakeForm({ onSuccess, onSubmit, defaultSpecialty, isSubmitting = false }: IntakeFormProps) {
  const [internalLoading, setInternalLoading] = useState(false);
  const [error, setError] = useState("");
  const [formData, setFormData] = useState<IntakeFormData>({
    specialty: defaultSpecialty || '',
    nameOrAlias: '',
    ageRange: '',
    chiefComplaint: '',
    consent: false
  });

  // Update local state if defaultSpecialty changes
  React.useEffect(() => {
    if (defaultSpecialty) {
      setFormData(prev => ({ ...prev, specialty: defaultSpecialty }));
    }
  }, [defaultSpecialty]);

  const loading = isSubmitting || internalLoading;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (onSubmit) {
      await onSubmit(formData);
      return;
    }

    setInternalLoading(true);
    // TODO: Replace with actual Server Action
    setTimeout(() => {
      // Secure ID generation
      if (onSuccess) onSuccess(`c_${crypto.randomUUID()}`);
      setInternalLoading(false);
    }, 1500);
  };

  return (
    <div className="max-w-4xl mx-auto py-12 px-6">
      {/* Page Header */}
      <div className="flex flex-col items-center text-center mb-16">
        <div className="w-14 h-14 bg-slate-900 rounded-2xl flex items-center justify-center shadow-2xl mb-6 transform rotate-6 hover:rotate-0 transition-transform duration-500">
          <Activity className="h-6 w-6 text-white" />
        </div>
        <h1 className="text-4xl font-black text-slate-900 tracking-tight mb-4">
          Patient Intake
        </h1>
        <div className="h-1 w-12 bg-blue-600 rounded-full mb-4"></div>
        <p className="text-slate-500 max-w-sm leading-relaxed text-sm font-medium">
          Initialize your secure medical record to begin your virtual consultation.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-16">
        {/* Section 1: Specialty */}
        <section>
          <StepHeader icon={Stethoscope} title="Consultation Category" stepNumber="1" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {SPECIALTIES.map((s) => (
              <SpecialtyCard
                key={s.id}
                specialty={s}
                isSelected={formData.specialty === s.id}
                onSelect={(id) => setFormData({ ...formData, specialty: id })}
              />
            ))}
          </div>
        </section>

        {/* Section 2: Clinical Details */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-16">
          <div className="lg:col-span-3 space-y-10">
            <section>
              <StepHeader icon={UserCircle} title="Identity & Demographics" stepNumber="2" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <InputField
                  label="Name or Alias"
                  placeholder="e.g. John Doe"
                  required
                  value={formData.nameOrAlias}
                  onChange={e => setFormData({ ...formData, nameOrAlias: e.target.value })}
                />
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-600 ml-1 uppercase tracking-tighter">
                    Patient Age
                  </label>
                  <div className="relative">
                    <select
                      required
                      className="w-full p-4 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all outline-none appearance-none cursor-pointer shadow-sm text-slate-900 font-medium"
                      value={formData.ageRange}
                      onChange={e => setFormData({ ...formData, ageRange: e.target.value })}
                    >
                      <option value="">Select age range</option>
                      {AGE_RANGES.map(range => <option key={range} value={range}>{range}</option>)}
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                      <ChevronRight className="h-4 w-4 rotate-90" />
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section>
              <div className="space-y-3">
                <label className="text-xs font-bold text-slate-600 ml-1 uppercase tracking-tighter flex justify-between">
                  <span>Chief Medical Complaint</span>
                  <span className="text-[10px] text-slate-400">Required</span>
                </label>
                <textarea
                  required
                  placeholder="Describe your current symptoms or reason for today's visit..."
                  className="w-full p-5 bg-white border border-slate-200 rounded-2xl h-44 focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all outline-none text-sm leading-relaxed resize-none shadow-sm text-slate-900"
                  value={formData.chiefComplaint}
                  onChange={e => setFormData({ ...formData, chiefComplaint: e.target.value })}
                />
              </div>
            </section>
          </div>

          {/* Section 3: Summary & Action */}
          <div className="lg:col-span-2">
            <div className="sticky top-24 space-y-8">
              <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-2xl shadow-slate-200/50 space-y-8">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-blue-600" /> Security Review
                </h3>

                <ConsentBanner
                  isChecked={formData.consent}
                  onToggle={() => setFormData({ ...formData, consent: !formData.consent })}
                />

                {error && (
                  <div className="p-4 bg-red-50 text-red-600 rounded-xl text-[11px] font-bold border border-red-100 flex items-center gap-2 animate-in slide-in-from-top-2">
                    <AlertCircle className="h-4 w-4 shrink-0" /> {error}
                  </div>
                )}

                <div className="space-y-4">
                  <button
                    disabled={loading || !formData.specialty || !formData.consent}
                    className="w-full bg-blue-600 text-white py-5 rounded-2xl font-bold text-sm shadow-xl shadow-blue-200 hover:bg-blue-700 disabled:bg-slate-100 disabled:shadow-none disabled:text-slate-400 transition-all flex items-center justify-center gap-3 active:scale-[0.98]"
                  >
                    {loading ? (
                      <Loader2 className="animate-spin h-5 w-5" />
                    ) : (
                      <>
                        Initialize Payment
                        <ChevronRight className="h-4 w-4" />
                      </>
                    )}
                  </button>
                  <p className="text-[10px] text-center text-slate-400 font-bold uppercase tracking-widest">
                    HIPAA • AES-256 • SQUARE
                  </p>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-100 p-6 rounded-2xl">
                <div className="flex items-center gap-3 mb-2">
                  <ShieldCheck className="h-4 w-4 text-green-600" />
                  <span className="text-xs font-bold text-slate-900">Encrypted Infrastructure</span>
                </div>
                <p className="text-[10px] text-slate-500 leading-normal">
                  This platform utilizes industry-standard PHI isolation protocols. All medical data is stored on specialized encrypted instances.
                </p>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}