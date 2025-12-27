import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ConsultationStatus } from "@/app/generated/prisma/client";
import { squareClient } from "@/lib/square";
import { randomUUID } from "crypto";
import {
  errorResponse,
  successResponse,
  requireAuth,
  ErrorCodes,
} from "@/lib/api-utils";
import { getRedis, slotLockKey } from "@/lib/redis";

/**
 * POST /api/v1/payments
 * Creates a Square checkout session for a consultation.
 *
 * Body: { consultationId: string }
 */
export async function POST(request: NextRequest) {
  // 1. Authenticate
  const authResult = await requireAuth();
  if (authResult.errorResponse) {
    return authResult.errorResponse;
  }

  const { session } = authResult;

  // 2. Parse Body
  let body: { consultationId?: string };
  try {
    body = await request.json();
  } catch {
    return errorResponse(ErrorCodes.VALIDATION_ERROR, "Invalid JSON body", 400);
  }

  const { consultationId } = body;

  if (!consultationId) {
    return errorResponse(
      ErrorCodes.VALIDATION_ERROR,
      "consultationId is required",
      400,
      { field: "consultationId" }
    );
  }

  try {
    // 3. Fetch Consultation & Validate
    const consultation = await prisma.consultation.findUnique({
      where: { id: consultationId },
    });

    if (!consultation) {
      return errorResponse(ErrorCodes.NOT_FOUND, "Consultation not found", 404);
    }

    if (consultation.patientId !== session.user.id) {
      return errorResponse(
        ErrorCodes.FORBIDDEN,
        "You are not authorized to pay for this consultation",
        403
      );
    }

    // Validate Consultation Status
    const validStatuses: ConsultationStatus[] = [
      ConsultationStatus.CREATED,
      ConsultationStatus.PAYMENT_FAILED,
    ];
    if (!validStatuses.includes(consultation.status)) {
      return errorResponse(
        ErrorCodes.VALIDATION_ERROR,
        `Payment cannot be initiated for a consultation in ${consultation.status} status`,
        400,
        { currentStatus: consultation.status, validStatuses }
      );
    }

    // Slot lock needs a concrete slot identity
    if (!consultation.doctorId || !consultation.scheduledStartAt) {
      return errorResponse(
        ErrorCodes.VALIDATION_ERROR,
        "Consultation must have an assigned doctor and scheduled time before payment",
        400,
        { field: "scheduledStartAt" }
      );
    }

    // 4. Check for Existing Payments (Idempotency/Duplication)
    const existingPayment = await prisma.payment.findFirst({
      where: {
        consultationId: consultationId,
        status: { in: ["PENDING", "PAID"] },
      },
    });

    if (existingPayment) {
      return errorResponse(
        ErrorCodes.CONFLICT,
        "A payment is already in progress or completed for this consultation",
        409,
        { paymentId: existingPayment.id }
      );
    }

    // 5. Validate Environment Config
    const locationId = process.env.SQUARE_LOCATION_ID;
    if (!locationId) {
      console.error("Missing SQUARE_LOCATION_ID");
      return errorResponse(
        ErrorCodes.INTERNAL_ERROR,
        "Payment configuration error",
        500
      );
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    if (!baseUrl) {
      console.error("Missing NEXT_PUBLIC_BASE_URL");
      return errorResponse(
        ErrorCodes.INTERNAL_ERROR,
        "Server configuration error",
        500
      );
    }

    // 5. Prepare Payment Link
    const amountInCents = 5000; // TODO: Fetch dynamic price based on specialty
    const redirectUrl = new URL("/checkout/success", baseUrl);
    redirectUrl.searchParams.set("id", consultationId);

    // Slot lock (Redis TTL) to prevent two users paying for the same slot.
    // Acquire as late as possible so we don't lock on earlier validation errors.
    const lockKey = slotLockKey(
      consultation.doctorId,
      consultation.scheduledStartAt.getTime()
    );
    const redis = await getRedis();
    if (redis) {
      const acquired = await redis.set(lockKey, consultationId, {
        NX: true,
        EX: 600, // 10 minutes
      });
      if (!acquired) {
        return errorResponse(
          ErrorCodes.CONFLICT,
          "Slot is currently being paid for. Pick a different slot.",
          409,
          {
            doctorId: consultation.doctorId,
            scheduledStartAt: consultation.scheduledStartAt.toISOString(),
          }
        );
      }
    }

    // 6. Call Square SDK
    let result;
    try {
      result = await squareClient.checkout.paymentLinks.create({
        idempotencyKey: randomUUID(),
        order: {
          locationId: locationId,
          lineItems: [
            {
              name: `${consultation.specialty} Consultation`,
              quantity: "1",
              basePriceMoney: {
                amount: BigInt(amountInCents),
                currency: "USD",
              },
            },
          ],
        },
        checkoutOptions: {
          redirectUrl: redirectUrl.toString(),
        },
      });
    } catch (squareErr) {
      // Best-effort early unlock if provider call fails
      try {
        if (redis) await redis.del(lockKey);
      } catch {
        // ignore
      }
      throw squareErr;
    }

    if (!result.paymentLink?.id || !result.paymentLink?.url) {
      console.error("Square response missing payment link ID or URL", result);
      // Best-effort early unlock if provider response is unusable
      try {
        if (redis) await redis.del(lockKey);
      } catch {
        // ignore
      }
      return errorResponse(
        ErrorCodes.INTERNAL_ERROR,
        "Failed to retrieve payment link from provider",
        502
      );
    }

    // 7. Create Pending Payment Record
    let payment;
    try {
      payment = await prisma.payment.create({
        data: {
          consultationId: consultationId,
          amount: amountInCents,
          status: "PENDING",
          providerCheckoutId: result.paymentLink.id,
          providerOrderId: result.paymentLink.orderId,
          // We'll update providerPaymentId via webhook later
        },
      });
    } catch (dbErr) {
      // Best-effort early unlock if we failed to persist payment
      try {
        if (redis) await redis.del(lockKey);
      } catch {
        // ignore
      }
      throw dbErr;
    }

    return successResponse(
      {
        url: result.paymentLink.url,
        paymentId: payment.id,
      },
      201
    );
  } catch (error) {
    console.error("Checkout Creation Error:", error);
    return errorResponse(
      ErrorCodes.INTERNAL_ERROR,
      `Failed to initialize payment gateway: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
      500
    );
  }
}
