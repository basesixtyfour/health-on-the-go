import React, { useState, useEffect } from 'react';
import { 
  CreditCard, 
  ShieldCheck, 
  Loader2, 
  AlertCircle, 
  ExternalLink,
  CheckCircle2,
  Lock
} from 'lucide-react';
import { createCheckoutSession, getPaymentStatus } from '@/app/actions/payment';

interface PaymentGateProps {
  consultationId: string;
  onSuccess: () => void;
}

export const PaymentGate = ({ consultationId, onSuccess }: PaymentGateProps) => {
  const [loading, setLoading] = useState(false);
  const [polling, setPolling] = useState(false);
  const [error, setError] = useState("");

  // Poll for status if the user has clicked pay
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (polling) {
      interval = setInterval(async () => {
        const { paid } = await getPaymentStatus(consultationId);
        if (paid) {
          setPolling(false);
          onSuccess();
        }
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [polling, consultationId, onSuccess]);

  const handlePaymentStart = async () => {
    setLoading(true);
    setError("");
    
    const result = await createCheckoutSession(consultationId);
    
    if (result.success && result.url) {
      window.open(result.url, '_blank');
      setPolling(true);
      setLoading(false);
    } else {
      setError(result.error || "Could not reach Square. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto py-12 px-6 animate-in zoom-in-95 duration-500">
      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-2xl shadow-slate-200/60 overflow-hidden">
        {/* Header */}
        <div className="bg-slate-900 p-8 text-center relative">
          <div className="absolute top-4 right-6 flex items-center gap-1 text-[10px] font-bold text-green-400 uppercase tracking-widest">
            <ShieldCheck className="h-3 w-3" /> Secure
          </div>
          <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
            <CreditCard className="h-7 w-7 text-white" />
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">Consultation Payment</h2>
          <p className="text-slate-400 text-xs mt-1 font-medium">Finalize your session activation</p>
        </div>

        {/* Content */}
        <div className="p-8 space-y-8">
          <div className="space-y-4">
            <div className="flex justify-between items-center text-sm font-medium">
              <span className="text-slate-500">Service Category</span>
              <span className="text-slate-900">Virtual Consultation</span>
            </div>
            <div className="h-px bg-slate-100 w-full" />
            <div className="flex justify-between items-center">
              <span className="text-sm font-bold text-slate-900">Total Due</span>
              <span className="text-2xl font-black text-blue-600 tracking-tighter">$50.00</span>
            </div>
          </div>

          {!polling ? (
            <div className="space-y-4">
              <button
                onClick={handlePaymentStart}
                disabled={loading}
                className="w-full bg-blue-600 text-white py-5 rounded-2xl font-bold text-sm shadow-xl shadow-blue-200 hover:bg-blue-700 transition-all flex items-center justify-center gap-2 group active:scale-[0.98]"
              >
                {loading ? (
                  <Loader2 className="animate-spin h-5 w-5" />
                ) : (
                  <>
                    Pay with Square
                    <ExternalLink className="h-4 w-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                  </>
                )}
              </button>
              
              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 text-red-600 rounded-xl text-[10px] font-bold border border-red-100 uppercase tracking-tight">
                  <AlertCircle className="h-3.5 w-3.5" /> {error}
                </div>
              )}
            </div>
          ) : (
            <div className="py-6 flex flex-col items-center text-center space-y-4 bg-blue-50/50 rounded-2xl border border-blue-100 border-dashed">
              <div className="relative">
                <Loader2 className="h-10 w-10 text-blue-600 animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                   <Lock className="h-3 w-3 text-blue-400" />
                </div>
              </div>
              <div className="space-y-1 px-4">
                <p className="text-sm font-bold text-blue-900">Awaiting Confirmation</p>
                <p className="text-[10px] text-blue-600/70 font-medium leading-relaxed">
                  Please complete the payment in the new window. This page will automatically redirect once confirmed.
                </p>
              </div>
            </div>
          )}

          <div className="pt-4 border-t border-slate-100">
             <div className="flex items-center justify-center gap-4 grayscale opacity-40">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em]">PCI Compliant</span>
                <div className="w-1 h-1 bg-slate-300 rounded-full" />
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em]">SSL Encrypted</span>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};