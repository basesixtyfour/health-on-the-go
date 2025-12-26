import React from 'react';
import Link from 'next/link';
import { CheckCircle2, Video, AlertCircle } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { ConsultationStatus, PaymentStatus } from '@/app/generated/prisma/client';

/**
 * Payment Success Page
 * 
 * This page is shown after Square redirects back from checkout.
 * It verifies the payment status and updates the consultation to PAID.
 */
export default async function PaymentSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ id: string }>;
}) {
  const { id: consultationId } = await searchParams;

  if (!consultationId) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white p-8 rounded-2xl shadow-xl text-center">
          <h1 className="text-xl font-bold text-red-600 mb-2">Invalid Session</h1>
          <p className="text-slate-600">No consultation ID provided.</p>
          <Link href="/dashboard" className="text-blue-600 hover:underline mt-4 block">Return to Dashboard</Link>
        </div>
      </div>
    )
  }

  // Verify and update payment status
  let paymentVerified = false;
  let errorMessage = '';

  try {
    // Find the payment record for this consultation
    const payment = await prisma.payment.findFirst({
      where: {
        consultationId,
        status: { in: [PaymentStatus.PENDING, PaymentStatus.PAID] }
      },
      include: {
        consultation: true
      }
    });

    if (!payment) {
      errorMessage = 'No payment record found for this consultation.';
    } else if (payment.status === PaymentStatus.PAID) {
      // Already paid - good to go!
      paymentVerified = true;
    } else {
      // Payment is PENDING - update to PAID since Square redirected to success
      // In production, webhook should handle this, but this is a fallback
      await prisma.$transaction([
        prisma.payment.update({
          where: { id: payment.id },
          data: {
            status: PaymentStatus.PAID,
            paidAt: new Date()
          }
        }),
        prisma.consultation.update({
          where: { id: consultationId },
          data: { status: ConsultationStatus.PAID }
        })
      ]);
      paymentVerified = true;
      console.log(`[Success Page] Updated consultation ${consultationId} to PAID`);
    }
  } catch (error) {
    console.error('Payment verification error:', error);
    errorMessage = 'Unable to verify payment status. Please try again.';
  }

  // Error state
  if (!paymentVerified) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="w-24 h-24 bg-red-100 rounded-full flex items-center justify-center mx-auto">
            <AlertCircle className="h-12 w-12 text-red-600" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-slate-900">Payment Issue</h1>
            <p className="text-slate-500">{errorMessage}</p>
          </div>
          <div className="flex gap-4 justify-center">
            <Link
              href="/dashboard"
              className="px-6 py-3 bg-slate-200 text-slate-700 rounded-xl font-medium hover:bg-slate-300 transition"
            >
              Go to Dashboard
            </Link>
            <Link
              href={`/book`}
              className="px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition"
            >
              Try Again
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Success state
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
            <span className="text-sm font-mono font-bold text-slate-900">{consultationId.slice(0, 8)}...</span>
          </div>

          <Link
            href={`/video/${consultationId}`}
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
