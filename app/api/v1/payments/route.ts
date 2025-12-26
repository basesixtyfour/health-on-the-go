import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { squareClient } from "@/lib/square";
import { randomUUID } from "crypto";
import {
    errorResponse,
    successResponse,
    requireAuth,
    ErrorCodes,
} from "@/lib/api-utils";

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
        // 4. Check for Existing Payments (Idempotency/Duplication)
        const existingPayment = await prisma.payment.findFirst({
            where: {
                consultationId: consultationId,
                status: { in: ["PENDING", "PAID"] }
            }
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

        // 6. Call Square SDK
        const result = await squareClient.checkout.paymentLinks.create({
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

        if (!result.paymentLink?.id || !result.paymentLink?.url) {
            console.error("Square response missing payment link ID or URL", result);
            return errorResponse(
                ErrorCodes.INTERNAL_ERROR,
                "Failed to retrieve payment link from provider",
                502
            );
        }

        // 7. Create Pending Payment Record
        const payment = await prisma.payment.create({
            data: {
                consultationId: consultationId,
                amount: amountInCents,
                status: "PENDING",
                providerCheckoutId: result.paymentLink.id,
                providerOrderId: result.paymentLink.orderId,
                // We'll update providerPaymentId via webhook later
            },
        });

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
            `Failed to initialize payment gateway: ${error instanceof Error ? error.message : 'Unknown error'}`,
            500,
            { originalError: error instanceof Error ? error.stack : error }
        );
    }
}
