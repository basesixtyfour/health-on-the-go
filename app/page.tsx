"use client";

import React, { useState } from 'react';
import { 
  Stethoscope, 
  ShieldCheck, 
  Activity, 
  Lock,
  Loader2,
  Globe
} from 'lucide-react';
import { authClient } from "@/lib/auth-client";

export default function RootPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleLogin = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      await authClient.signIn.social({
        provider: 'google',
        callbackURL: '/dashboard', // Redirect after successful login
      });
    } catch (err) {
      console.error('Google sign-in error:', err);
      setError('Failed to sign in. Please try again.');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFDFF] flex flex-col">
      {/* Minimalist Header */}
      <header className="p-6 flex justify-between items-center max-w-7xl mx-auto w-full">
        <div className="flex items-center gap-2 text-blue-600 font-bold text-xl tracking-tight">
          <Stethoscope className="h-7 w-7" />
          <span>VeersaHealth</span>
        </div>
        <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest border border-slate-200 px-3 py-1.5 rounded-full">
          <ShieldCheck className="h-3.5 w-3.5 text-green-500" /> Secure Protocol v2.5
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-[440px] space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
          
          {/* Hero Branding */}
          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-blue-200 rotate-3">
              <Activity className="h-8 w-8 text-white -rotate-3" />
            </div>
            <h1 className="text-4xl font-black text-slate-900 tracking-tighter">
              Medical Portal
            </h1>
            <p className="text-slate-500 font-medium text-sm max-w-[280px] mx-auto leading-relaxed">
              Access secure virtual care and real-time medical consultations.
            </p>
          </div>

          {/* Auth Card */}
          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-2xl shadow-slate-200/50 space-y-6">
            
            {/* Error Message */}
            {error && (
              <div className="p-4 bg-red-50 border border-red-100 rounded-2xl">
                <p className="text-sm text-red-600 font-medium text-center">{error}</p>
              </div>
            )}

            {/* Google Sign In Button */}
            <button
              onClick={handleGoogleLogin}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-3 py-4 border border-slate-200 rounded-2xl font-bold text-sm text-slate-700 hover:bg-slate-50 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  <svg className="h-5 w-5" viewBox="0 0 24 24">
                    <path
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      fill="#4285F4"
                    />
                    <path
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      fill="#34A853"
                    />
                    <path
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                      fill="#FBBC05"
                    />
                    <path
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      fill="#EA4335"
                    />
                  </svg>
                  Continue with Google
                </>
              )}
            </button>

            <p className="text-xs text-slate-500 text-center leading-relaxed">
              Secure authentication powered by Google. Your credentials are never stored on our servers.
            </p>
          </div>

          {/* Footer Badges */}
          <div className="pt-8 flex flex-col items-center gap-6">
            <div className="flex gap-6 items-center">
              <div className="flex items-center gap-1.5 grayscale opacity-50">
                <Globe className="h-3 w-3" />
                <span className="text-[9px] font-bold text-slate-900 uppercase tracking-widest">Global HIPAA Standard</span>
              </div>
              <div className="w-1 h-1 bg-slate-200 rounded-full" />
              <div className="flex items-center gap-1.5 grayscale opacity-50">
                <Lock className="h-3 w-3" />
                <span className="text-[9px] font-bold text-slate-900 uppercase tracking-widest">AES-256 Encrypted</span>
              </div>
            </div>
            
            <p className="text-[10px] text-slate-400 font-medium text-center leading-relaxed">
              By continuing, you agree to our Clinical Terms of Service <br />
              and PHI Data Privacy Protocol.
            </p>
          </div>

        </div>
      </main>
    </div>
  );
}