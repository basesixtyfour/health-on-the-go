import React from "react";
import Link from "next/link";
import { headers } from "next/headers";
import {
  CheckCircle2,
  Video,
  AlertCircle,
  Clock,
  Calendar,
  User,
  Stethoscope,
  CalendarPlus,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { squareClient } from "@/lib/square";
import {
  ConsultationStatus,
  PaymentStatus,
} from "@/app/generated/prisma/client";
import { format } from "date-fns";
import { getSpecialtyPrice, SPECIALTIES } from "@/lib/constants";

/**
 * Payment Success / Appointment Confirmation Page
 *
 * This page is shown after Square redirects back from checkout.
 * It VERIFIES the payment with Square API before updating status.
 * Shows full appointment details after successful payment.
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
          <h1 className="text-xl font-bold text-red-600 mb-2">
            Invalid Session
          </h1>
          <p className="text-slate-600">No consultation ID provided.</p>
          <Link
            href="/dashboard"
            className="text-blue-600 hover:underline mt-4 block"
          >
            Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  // Verify and update payment status
  let paymentVerified = false;
  let isPending = false;
  let errorMessage = "";
  let consultationDetails: {
    id: string;
    doctorName: string;
    specialty: string;
    scheduledStartAt: Date | null;
    amountPaid: number;
  } | null = null;

  try {
    // Find the payment record for this consultation
    const payment = await prisma.payment.findFirst({
      where: {
        consultationId,
        status: { in: [PaymentStatus.PENDING, PaymentStatus.PAID] },
      },
      include: {
        consultation: {
          select: {
            id: true,
            status: true,
            specialty: true,
            scheduledStartAt: true,
            doctor: {
              select: { name: true },
            },
          },
        },
      },
    });

    if (!payment) {
      errorMessage = "No payment record found for this consultation.";
    } else if (payment.status === PaymentStatus.PAID) {
      // Payment is already paid - ensure consultation is also marked as PAID
      if (
        payment.consultation.status !== ConsultationStatus.PAID &&
        payment.consultation.status !== ConsultationStatus.IN_CALL &&
        payment.consultation.status !== ConsultationStatus.COMPLETED
      ) {
        await prisma.consultation.update({
          where: { id: consultationId },
          data: { status: ConsultationStatus.PAID },
        });
      }
      paymentVerified = true;
      consultationDetails = {
        id: consultationId,
        doctorName: payment.consultation.doctor?.name || "Your Doctor",
        specialty: payment.consultation.specialty,
        scheduledStartAt: payment.consultation.scheduledStartAt,
        amountPaid: Number(payment.amount) / 100, // Convert cents to dollars
      };
    } else if (payment.providerOrderId) {
      // Payment is PENDING - verify with Square API before updating
      try {
        const orderResponse = await squareClient.orders.get({
          orderId: payment.providerOrderId!,
        });
        const order = orderResponse.order;

        const hasTenders = order?.tenders && order.tenders.length > 0;
        const isCompleted = order?.state === "COMPLETED";

        if (hasTenders || isCompleted) {
          // Payment is confirmed by Square API. Now we need to update both payment AND consultation.
          // First, check if webhook already handled it (consultation might already be PAID or PAYMENT_FAILED).
          const currentConsultation = await prisma.consultation.findUnique({
            where: { id: consultationId },
            select: {
              status: true,
              specialty: true,
              scheduledStartAt: true,
              doctor: { select: { name: true } },
            },
          });

          if (
            currentConsultation?.status === ConsultationStatus.PAID ||
            currentConsultation?.status === ConsultationStatus.IN_CALL ||
            currentConsultation?.status === ConsultationStatus.COMPLETED
          ) {
            // Webhook already processed this - just update payment if needed and show success
            await prisma.payment.update({
              where: { id: payment.id },
              data: {
                status: PaymentStatus.PAID,
                paidAt: new Date(),
              },
            });

            paymentVerified = true;
            consultationDetails = {
              id: consultationId,
              doctorName: currentConsultation?.doctor?.name || "Your Doctor",
              specialty:
                currentConsultation?.specialty ||
                payment.consultation.specialty,
              scheduledStartAt:
                currentConsultation?.scheduledStartAt ??
                payment.consultation.scheduledStartAt,
              amountPaid: Number(payment.amount) / 100,
            };
          } else if (
            currentConsultation?.status === ConsultationStatus.PAYMENT_FAILED
          ) {
            // Webhook already detected a slot conflict
            errorMessage =
              "This slot was taken while your payment was processing. Please pick a different slot.";
          } else {
            // Webhook hasn't processed yet - update both payment AND consultation status
            // The consultation is likely still in CREATED or PAYMENT_PENDING status
            try {
              await prisma.$transaction([
                prisma.payment.update({
                  where: { id: payment.id },
                  data: {
                    status: PaymentStatus.PAID,
                    paidAt: new Date(),
                  },
                }),
                prisma.consultation.update({
                  where: { id: consultationId },
                  data: { status: ConsultationStatus.PAID },
                }),
              ]);

              paymentVerified = true;
              consultationDetails = {
                id: consultationId,
                doctorName: currentConsultation?.doctor?.name || "Your Doctor",
                specialty:
                  currentConsultation?.specialty ||
                  payment.consultation.specialty,
                scheduledStartAt:
                  currentConsultation?.scheduledStartAt ??
                  payment.consultation.scheduledStartAt,
                amountPaid: Number(payment.amount) / 100,
              };
            } catch (updateErr: unknown) {
              // If there's a unique constraint violation (slot taken by another booking),
              // mark consultation as PAYMENT_FAILED
              const err = updateErr as { code?: string };
              if (err?.code === "P2002") {
                await prisma.consultation.update({
                  where: { id: consultationId },
                  data: { status: ConsultationStatus.PAYMENT_FAILED },
                });
                errorMessage =
                  "This slot was taken while your payment was processing. Please pick a different slot.";
              } else {
                throw updateErr;
              }
            }
          }
        } else {
          isPending = true;
        }
      } catch (squareError) {
        console.error("Square API verification error:", squareError);
        isPending = true;
      }
    } else {
      errorMessage = "Payment record is incomplete. Please contact support.";
    }
  } catch (error) {
    console.error("Payment verification error:", error);
    errorMessage = "Unable to verify payment status. Please try again.";
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
            <h1 className="text-2xl font-bold text-slate-900">
              Payment Processing
            </h1>
            <p className="text-slate-500">
              Your payment is being processed. This may take a moment.
            </p>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-lg space-y-4">
            <p className="text-sm text-slate-600">
              If your payment was successful, please refresh this page in a few
              seconds.
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
              href="/book"
              className="px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition"
            >
              Try Again
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Get specialty label
  const specialtyInfo = SPECIALTIES.find(
    (s) => s.id === consultationDetails?.specialty
  );
  const specialtyLabel =
    specialtyInfo?.label ||
    consultationDetails?.specialty ||
    "General Practice";

  // Format date/time for display
  const appointmentDate = consultationDetails?.scheduledStartAt
    ? format(consultationDetails.scheduledStartAt, "EEEE, MMMM d, yyyy")
    : "";
  const appointmentTime = consultationDetails?.scheduledStartAt
    ? format(consultationDetails.scheduledStartAt, "h:mm a")
    : "";

  // Generate Google Calendar link
  // Get origin from headers for server-side rendering
  const headersList = await headers();
  const host = headersList.get("host") || "localhost:3000";
  const protocol = headersList.get("x-forwarded-proto") || "http";
  const appOrigin = process.env.NEXT_PUBLIC_APP_URL || `${protocol}://${host}`;

  const generateCalendarLink = () => {
    if (!consultationDetails?.scheduledStartAt) return "#";
    const start = consultationDetails.scheduledStartAt;
    const end = new Date(start.getTime() + 30 * 60000); // 30 min duration

    const startStr = start.toISOString().replace(/-|:|\.\d{3}/g, "");
    const endStr = end.toISOString().replace(/-|:|\.\d{3}/g, "");

    const title = encodeURIComponent(
      `Telehealth Consultation - ${specialtyLabel}`
    );
    const details = encodeURIComponent(
      `Your virtual consultation with Dr. ${consultationDetails.doctorName}.\n\nJoin link: ${appOrigin}/video/${consultationId}`
    );

    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startStr}/${endStr}&details=${details}`;
  };

  // Success state with full appointment details
  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-blue-50 flex items-center justify-center p-6">
      <div className="max-w-lg w-full space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
        {/* Success Header */}
        <div className="text-center space-y-4">
          <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto shadow-lg shadow-emerald-200">
            <CheckCircle2 className="h-10 w-10 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-slate-900">
              Booking Confirmed!
            </h1>
            <p className="text-slate-500 mt-1">
              Your appointment has been scheduled
            </p>
          </div>
        </div>

        {/* Appointment Details Card */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden">
          {/* Doctor Info Header */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-6 text-white">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center">
                <User className="h-7 w-7" />
              </div>
              <div>
                <p className="text-blue-100 text-sm">Your Doctor</p>
                <p className="text-xl font-bold">
                  Dr. {consultationDetails?.doctorName}
                </p>
              </div>
            </div>
          </div>

          {/* Details Grid */}
          <div className="p-6 space-y-4">
            {/* Date & Time */}
            <div className="flex items-start gap-4 p-4 bg-slate-50 rounded-2xl">
              <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <Calendar className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">
                  Date & Time
                </p>
                <p className="font-semibold text-slate-900">
                  {appointmentDate}
                </p>
                <p className="text-blue-600 font-bold">{appointmentTime}</p>
              </div>
            </div>

            {/* Specialty */}
            <div className="flex items-start gap-4 p-4 bg-slate-50 rounded-2xl">
              <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <Stethoscope className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">
                  Specialty
                </p>
                <p className="font-semibold text-slate-900">{specialtyLabel}</p>
              </div>
            </div>

            {/* Amount Paid */}
            <div className="flex items-center justify-between p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
              <div>
                <p className="text-xs text-emerald-600 uppercase tracking-wide font-medium">
                  Amount Paid
                </p>
                <p className="text-2xl font-bold text-emerald-700">
                  ${consultationDetails?.amountPaid}
                </p>
              </div>
              <div className="px-3 py-1 bg-emerald-100 rounded-full">
                <span className="text-xs font-bold text-emerald-700">PAID</span>
              </div>
            </div>

            {/* Confirmation ID */}
            <div className="text-center pt-2">
              <p className="text-xs text-slate-400">Confirmation ID</p>
              <p className="font-mono text-sm text-slate-600">
                {consultationId.slice(0, 16)}...
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="p-6 pt-0 space-y-3">
            <Link
              href={`/video/${consultationId}`}
              className="w-full bg-slate-900 text-white py-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-3 hover:bg-black transition-all shadow-lg"
            >
              <Video className="h-5 w-5" />
              Join Consultation Room
            </Link>

            <a
              href={generateCalendarLink()}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full bg-white border-2 border-slate-200 text-slate-700 py-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-3 hover:border-blue-300 hover:bg-blue-50 transition-all"
            >
              <CalendarPlus className="h-5 w-5" />
              Add to Google Calendar
            </a>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center space-y-2">
          <p className="text-xs text-slate-500">
            You will also receive a confirmation email with these details.
          </p>
          <Link
            href="/dashboard/patient"
            className="text-sm text-blue-600 hover:underline font-medium"
          >
            Go to Dashboard →
          </Link>
        </div>
      </div>
    </div>
  );
}
