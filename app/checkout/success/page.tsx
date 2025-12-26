import React from 'react';
import Link from 'next/link';
import { CheckCircle2, Video, AlertCircle, Clock } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { squareClient } from '@/lib/square';
import { ConsultationStatus, PaymentStatus } from '@/app/generated/prisma/client';

/**
 * Payment Success Page
 * 
 * This page is shown after Square redirects back from checkout.
 * It VERIFIES the payment with Square API before updating status.
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
  let isPending = false;
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
      // Payment is already paid - ensure consultation is also marked as PAID
      if (payment.consultation.status !== ConsultationStatus.PAID &&
        payment.consultation.status !== ConsultationStatus.IN_CALL &&
        payment.consultation.status !== ConsultationStatus.COMPLETED) {
        // Update consultation status to PAID if it's not already in a paid/active state
        await prisma.consultation.update({
          where: { id: consultationId },
          data: { status: ConsultationStatus.PAID }
        });
        console.log(`[Success Page] Payment was PAID but consultation was ${payment.consultation.status}, updated to PAID`);
      }
      paymentVerified = true;
    } else if (payment.providerOrderId) {
      // Payment is PENDING - verify with Square API before updating
      try {
        const orderResponse = await squareClient.orders.get({ orderId: payment.providerOrderId! });

        const order = orderResponse.order;
        console.log(`[Success Page] Order ${payment.providerOrderId} state: ${order?.state}, tenders: ${order?.tenders?.length || 0}`);

        // Check if the order has been paid
        // For payment links, the order stays OPEN but will have tenders when paid
        // A tender represents a successful payment
        const hasTenders = order?.tenders && order.tenders.length > 0;
        const isCompleted = order?.state === 'COMPLETED';

        if (hasTenders || isCompleted) {
          // Order has been paid - update our records
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
          console.log(`[Success Page] Verified payment via Square API (tenders: ${hasTenders}, completed: ${isCompleted}) - updated consultation ${consultationId} to PAID`);
        } else {
          // Order not paid yet - show pending state
          isPending = true;
          console.log(`[Success Page] Order ${payment.providerOrderId} has no tenders and state: ${order?.state}`);
        }
      } catch (squareError) {
        console.error('Square API verification error:', squareError);
        // If Square API fails, show pending state rather than auto-approving
        isPending = true;
      }
    } else {
      // No provider order ID - can't verify
      errorMessage = 'Payment record is incomplete. Please contact support.';
    }
  } catch (error) {
    console.error('Payment verification error:', error);
    errorMessage = 'Unable to verify payment status. Please try again.';
  }

  // Pending state - payment not yet confirmed by Square
  if (isPending) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="w-24 h-24 bg-amber-100 rounded-full flex items-center justify-center mx-auto">
            <Clock className="h-12 w-12 text-amber-600 animate-pulse" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-slate-900">Payment Processing</h1>
            <p className="text-slate-500">
              Your payment is being processed. This may take a moment.
            </p>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-lg space-y-4">
            <p className="text-sm text-slate-600">
              If your payment was successful, please refresh this page in a few seconds.
            </p>
            <div className="flex gap-4 justify-center">
              <Link
                href={`/checkout/success?id=${consultationId}`}
                className="px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition"
              >
                Refresh Page
              </Link>
              <Link
                href="/dashboard"
                className="px-6 py-3 bg-slate-200 text-slate-700 rounded-xl font-medium hover:bg-slate-300 transition"
              >
                Go to Dashboard
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
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
