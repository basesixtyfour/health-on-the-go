/**
 * Consultation Close API Route
 *
 * POST /api/v1/consultations/:id/close
 *
 * Allows doctors to end a consultation, marking it as COMPLETED
 * and deleting the Daily room to kick all participants.
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
    errorResponse,
    successResponse,
    requireAuth,
    ErrorCodes,
} from "@/lib/api-utils";
import { deleteRoom } from "@/lib/daily";
import { ConsultationStatus, UserRole } from "@/app/generated/prisma/client";

interface RouteParams {
    params: Promise<{ id: string }>;
}

export async function POST(_request: NextRequest, { params }: RouteParams) {
    const { id: consultationId } = await params;

    if (!consultationId) {
        return errorResponse(
            ErrorCodes.VALIDATION_ERROR,
            "Consultation id is required",
            400,
            { field: "id" }
        );
    }

    // Check authentication
    const authResult = await requireAuth();
    if (authResult.errorResponse) return authResult.errorResponse;

    const { session } = authResult;
    const user = session.user;

    // Only doctors and admins can close consultations
    if (user.role !== UserRole.DOCTOR && user.role !== UserRole.ADMIN) {
        return errorResponse(
            ErrorCodes.FORBIDDEN,
            "Only doctors and admins can end consultations",
            403
        );
    }

    try {
        // Fetch consultation with video session
        const consultation = await prisma.consultation.findUnique({
            where: { id: consultationId },
            include: {
                videoSession: true,
            },
        });

        if (!consultation) {
            return errorResponse(ErrorCodes.NOT_FOUND, "Consultation not found", 404);
        }

        // Check authorization: must be the assigned doctor or admin
        const isAssignedDoctor = consultation.doctorId === user.id;
        const isAdmin = user.role === UserRole.ADMIN;

        if (!isAssignedDoctor && !isAdmin) {
            return errorResponse(
                ErrorCodes.FORBIDDEN,
                "You are not authorized to end this consultation",
                403
            );
        }

        // Update consultation status to COMPLETED atomically
        // Using updateMany with status condition to prevent race conditions
        const result = await prisma.$transaction(async (tx) => {
            const updateResult = await tx.consultation.updateMany({
                where: {
                    id: consultationId,
                    status: ConsultationStatus.IN_CALL,
                },
                data: {
                    status: ConsultationStatus.COMPLETED,
                    endedAt: new Date(),
                },
            });

            // Check if any rows were updated
            if (updateResult.count === 0) {
                throw new Error('STATUS_MISMATCH');
            }

            // Fetch the updated consultation for response
            const updated = await tx.consultation.findUnique({
                where: { id: consultationId },
            });

            // Create audit event after confirming update succeeded
            await tx.auditEvent.create({
                data: {
                    actorUserId: user.id,
                    consultationId: consultationId,
                    eventType: "CONSULTATION_CLOSED",
                    eventMetadata: {
                        from: ConsultationStatus.IN_CALL,
                        to: ConsultationStatus.COMPLETED,
                        closedBy: user.role,
                    },
                },
            });

            return updated;
        });

        // Delete the Daily room to kick all participants
        if (consultation.videoSession?.roomName) {
            try {
                await deleteRoom(consultation.videoSession.roomName);
            } catch (roomError) {
                // Log but don't fail - room deletion is best effort
                console.error("Failed to delete Daily room:", roomError);
            }
        }

        return successResponse({
            ...result,
            message: "Consultation ended successfully",
        });
    } catch (error) {
        // Handle STATUS_MISMATCH from transaction
        if (error instanceof Error && error.message === 'STATUS_MISMATCH') {
            return errorResponse(
                ErrorCodes.INVALID_STATUS_TRANSITION,
                "Cannot close consultation: status is not IN_CALL. The consultation may have already been closed or its status changed.",
                400,
                {
                    requiredStatus: ConsultationStatus.IN_CALL,
                }
            );
        }

        console.error("Error closing consultation:", error);
        return errorResponse(
            ErrorCodes.INTERNAL_ERROR,
            "Failed to close consultation",
            500
        );
    }
}
