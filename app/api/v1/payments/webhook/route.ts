import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "crypto";
import { prisma } from "@/lib/prisma";

import {
  ConsultationStatus,
  PaymentStatus,
} from "@/app/generated/prisma/client";
import { getRedis, slotLockKey } from "@/lib/redis";

const SIGNATURE_KEY = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY;

/**
 * POST /api/v1/payments/webhook
 * Handles 'payment.updated' events from Square.
 */
export async function POST(request: NextRequest) {
  if (!SIGNATURE_KEY) {
    console.error("Missing SQUARE_WEBHOOK_SIGNATURE_KEY");
    return NextResponse.json({ error: "Configuration Error" }, { status: 500 });
  }

  const signature = request.headers.get("x-square-hmacsha256-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const bodyText = await request.text();

  // Validate Runtime Configuration
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  if (!baseUrl) {
    console.error("Missing NEXT_PUBLIC_BASE_URL during webhook processing");
    return NextResponse.json(
      { error: "Server Configuration Error" },
      { status: 500 }
    );
  }

  // Verify signature manually to avoid SDK version conflicts
  try {
    const hmac = createHmac("sha256", SIGNATURE_KEY);
    // The notification URL must be exact. In dev, this might mismatch if using localtunnel/ngrok, so be careful.
    // Square signs: url + body
    const notificationUrl = baseUrl + "/api/v1/payments/webhook";
    hmac.update(notificationUrl + bodyText);
    const calculatedSignature = hmac.digest("base64");

    if (calculatedSignature !== signature) {
      console.warn("Invalid Webhook Signature");
      console.warn(`Expected: ${calculatedSignature}, Got: ${signature}`);
      return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
    }
  } catch (err) {
    console.error("Error verifying signature:", err);
    return NextResponse.json(
      { error: "Signature verification failed" },
      { status: 500 }
    );
  }

  let event;
  try {
    event = JSON.parse(bodyText);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (event.type === "payment.updated") {
    const paymentObj = event.data.object.payment;
    const orderId = paymentObj.order_id;
    const status = paymentObj.status; // COMPLETED, FAILED, etc.
    const paymentId = paymentObj.id;

    if (!orderId) {
      return NextResponse.json({ message: "No order ID in event" });
    }

    // Find our local payment record
    const localPayment = await prisma.payment.findFirst({
      where: { providerOrderId: orderId },
    });

    if (!localPayment) {
      console.warn(`Payment record not found for order ${orderId}`);
      return NextResponse.json({ message: "Record not found" }); // Return 200 to acknowledge webhook
    }

    let newPaymentStatus: PaymentStatus | undefined;
    let newConsultationStatus: ConsultationStatus | undefined;

    if (status === "COMPLETED") {
      newPaymentStatus = PaymentStatus.PAID;
      newConsultationStatus = ConsultationStatus.PAID;
    } else if (status === "FAILED") {
      newPaymentStatus = PaymentStatus.FAILED;
      newConsultationStatus = ConsultationStatus.PAYMENT_FAILED;
    }

    if (newPaymentStatus) {
      let consultationForLock:
        | { doctorId: string | null; scheduledStartAt: Date | null }
        | null
        | undefined;
      try {
        // Transactional update
        await prisma.$transaction([
          prisma.payment.update({
            where: { id: localPayment.id },
            data: {
              status: newPaymentStatus,
              providerPaymentId: paymentId,
              paidAt: status === "COMPLETED" ? new Date() : undefined,
            },
          }),
          prisma.consultation.update({
            where: { id: localPayment.consultationId },
            data: { status: newConsultationStatus },
          }),
        ]);
        console.log(
          `Updated payment ${localPayment.id} to ${newPaymentStatus}`
        );
      } catch (err: any) {
        // If payment succeeded but slot confirmation fails due to uniqueness (double-booking prevention),
        // mark the consultation as PAYMENT_FAILED so the UI can prompt the user to pick a different slot.
        const isUniqueViolation = err?.code === "P2002";

        if (status === "COMPLETED" && isUniqueViolation) {
          const consultation = await prisma.consultation.findUnique({
            where: { id: localPayment.consultationId },
            select: { id: true, doctorId: true, scheduledStartAt: true },
          });
          consultationForLock = {
            doctorId: consultation?.doctorId ?? null,
            scheduledStartAt: consultation?.scheduledStartAt ?? null,
          };

          await prisma.$transaction([
            prisma.payment.update({
              where: { id: localPayment.id },
              data: {
                status: PaymentStatus.PAID,
                providerPaymentId: paymentId,
                paidAt: new Date(),
              },
            }),
            prisma.consultation.update({
              where: { id: localPayment.consultationId },
              data: { status: ConsultationStatus.PAYMENT_FAILED },
            }),
            prisma.auditEvent.create({
              data: {
                consultationId: localPayment.consultationId,
                eventType: "PAYMENT_CONFLICT_SLOT_TAKEN",
                eventMetadata: {
                  providerOrderId: orderId,
                  providerPaymentId: paymentId,
                  doctorId: consultation?.doctorId ?? null,
                  scheduledStartAt:
                    consultation?.scheduledStartAt?.toISOString?.() ?? null,
                },
              },
            }),
          ]);

          console.warn(
            `Slot conflict: payment ${localPayment.id} succeeded but consultation ${localPayment.consultationId} could not be confirmed (unique constraint).`
          );
          return NextResponse.json({ success: true });
        }

        throw err;
      } finally {
        // Ensure the slot lock is released on terminal webhook events even if an unexpected error occurs.
        // Without this, a non-P2002 error can leave the slot locked for the full TTL.
        if (status === "FAILED" || status === "COMPLETED") {
          try {
            if (!consultationForLock) {
              consultationForLock = await prisma.consultation.findUnique({
                where: { id: localPayment.consultationId },
                select: { doctorId: true, scheduledStartAt: true },
              });
            }
            if (
              consultationForLock?.doctorId &&
              consultationForLock?.scheduledStartAt
            ) {
              const redis = await getRedis();
              if (redis) {
                await redis.del(
                  slotLockKey(
                    consultationForLock.doctorId,
                    consultationForLock.scheduledStartAt.getTime()
                  )
                );
              }
            }
          } catch {
            // ignore
          }
        }
      }
    }
  }

  return NextResponse.json({ success: true });
}
