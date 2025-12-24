import React from 'react';
import Link from 'next/link';
import { CheckCircle2, Video, ArrowRight } from 'lucide-react';

export default function PaymentSuccessPage({
  searchParams,
}: {
  searchParams: { id: string };
}) {
  const consultationId = searchParams.id;

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto shadow-inner shadow-green-200">
          <CheckCircle2 className="h-12 w-12 text-green-600" />
        </div>
        
        <div className="space-y-2">
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Payment Verified</h1>
          <p className="text-slate-500 font-medium">Your consultation link is now active.</p>
        </div>

        <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-xl shadow-slate-200/50 space-y-4">
          <div className="p-4 bg-slate-50 rounded-2xl flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Consultation ID</span>
            <span className="text-sm font-mono font-bold text-slate-900">{consultationId}</span>
          </div>
          
          <Link 
            href={`/consultation/${consultationId}`}
            className="w-full bg-slate-900 text-white py-5 rounded-2xl font-bold text-sm flex items-center justify-center gap-3 hover:bg-black transition-all shadow-lg shadow-slate-300"
          >
            Enter Consultation Room
            <Video className="h-4 w-4" />
          </Link>
        </div>

        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
          Session ID valid for 1 hour
        </p>
      </div>
    </div>
  );
}