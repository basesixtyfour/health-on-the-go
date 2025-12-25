import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, errorResponse, ErrorCodes, successResponse } from "@/lib/api-utils";

/**
 * GET /api/v1/payments/[id]
 * Retrieves the status of a specific payment.
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const authResult = await requireAuth();
    if (authResult.errorResponse) {
        return authResult.errorResponse;
    }
    const { session } = authResult;
    const { id } = await params;

    if (!id) {
        return errorResponse(ErrorCodes.VALIDATION_ERROR, "Payment ID required", 400);
    }

    try {
        const payment = await prisma.payment.findUnique({
            where: { id },
            include: { consultation: true }
        });

        if (!payment) {
            return errorResponse(ErrorCodes.NOT_FOUND, "Payment not found", 404);
        }

        // Check authorization (must be the patient or an admin)
        if (payment.consultation.patientId !== session.user.id && session.user.role !== "ADMIN") {
            return errorResponse(ErrorCodes.FORBIDDEN, "Access denied", 403);
        }

        return successResponse({
            id: payment.id,
            status: payment.status,
            amount: payment.amount,
            currency: payment.currency,
            consultationId: payment.consultationId,
            providerCheckoutId: payment.providerCheckoutId,
            createdAt: payment.createdAt,
            updatedAt: payment.updatedAt
        });
    } catch (error) {
        console.error("Payment status fetch error:", error);
        return errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch payment status", 500);
    }
}
