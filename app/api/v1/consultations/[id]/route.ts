/**
 * Single Consultation API Routes
 *
 * GET /api/v1/consultations/:id - Get a single consultation
 * PATCH /api/v1/consultations/:id - Update a consultation
 */

import { NextRequest } from "next/server";
import { prisma } from "@/prisma";
import {
  errorResponse,
  successResponse,
  requireAuth,
  ErrorCodes,
  isValidStatusTransition,
} from "@/lib/api-utils";
import { ConsultationStatus, UserRole } from "@/app/generated/prisma/client";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * Check if user has access to a consultation
 */
function hasAccessToConsultation(
  user: { id: string; role?: string | null },
  consultation: { patientId: string; doctorId: string | null }
): boolean {
  // Admins can access all consultations
  if (user.role === UserRole.ADMIN) {
    return true;
  }

  // Patients can access their own consultations
  if (consultation.patientId === user.id) {
    return true;
  }

  // Doctors can access consultations assigned to them
  if (consultation.doctorId === user.id) {
    return true;
  }

  return false;
}

/**
 * GET /api/v1/consultations/:id
 * Get a single consultation by ID
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  // Check authentication
  const authResult = await requireAuth();
  if (authResult.errorResponse) {
    return authResult.errorResponse;
  }

  const { session } = authResult;
  const user = session.user;
  const { id } = await params;

  try {
    // Fetch consultation with related data
    const consultation = await prisma.consultation.findUnique({
      where: { id },
      include: {
        patientIntake: true,
        payments: true,
        patient: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        doctor: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!consultation) {
      return errorResponse(ErrorCodes.NOT_FOUND, "Consultation not found", 404);
    }

    // Check authorization
    if (!hasAccessToConsultation(user, consultation)) {
      return errorResponse(
        ErrorCodes.FORBIDDEN,
        "You do not have access to this consultation",
        403
      );
    }

    return successResponse(consultation);
  } catch (error) {
    console.error("Error fetching consultation:", error);
    return errorResponse(
      ErrorCodes.INTERNAL_ERROR,
      "Failed to fetch consultation",
      500
    );
  }
}

/**
 * PATCH /api/v1/consultations/:id
 * Update a consultation (primarily for status transitions)
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  // Check authentication
  const authResult = await requireAuth();
  if (authResult.errorResponse) {
    return authResult.errorResponse;
  }

  const { session } = authResult;
  const user = session.user;
  const { id } = await params;

  // Parse request body
  let body: {
    status?: string;
    doctorId?: string;
    scheduledStartAt?: string;
    updatedAt?: string; // For optimistic locking
  };
  try {
    body = await request.json();
  } catch {
    return errorResponse(ErrorCodes.VALIDATION_ERROR, "Invalid JSON body", 400);
  }

  try {
    // Fetch current consultation
    const consultation = await prisma.consultation.findUnique({
      where: { id },
    });

    if (!consultation) {
      return errorResponse(ErrorCodes.NOT_FOUND, "Consultation not found", 404);
    }

    // Check if user has general access to this consultation
    if (!hasAccessToConsultation(user, consultation)) {
      return errorResponse(
        ErrorCodes.FORBIDDEN,
        "You do not have access to this consultation",
        403
      );
    }

    // RBAC: Status updates - only doctors and admins
    if (body.status) {
      if (user.role !== UserRole.DOCTOR && user.role !== UserRole.ADMIN) {
        return errorResponse(
          ErrorCodes.FORBIDDEN,
          "Only doctors and admins can update consultation status",
          403
        );
      }
    }

    // RBAC: Doctor assignment - only admins
    if (body.doctorId) {
      if (user.role !== UserRole.ADMIN) {
        return errorResponse(
          ErrorCodes.FORBIDDEN,
          "Only admins can assign doctors to consultations",
          403
        );
      }
      // Validate that the assigned user is actually a doctor
      const assignedDoctor = await prisma.user.findUnique({
        where: { id: body.doctorId },
        select: { id: true, role: true },
      });
      if (!assignedDoctor) {
        return errorResponse(
          ErrorCodes.NOT_FOUND,
          "Assigned doctor not found",
          404
        );
      }
      if (assignedDoctor.role !== UserRole.DOCTOR) {
        return errorResponse(
          ErrorCodes.VALIDATION_ERROR,
          "Assigned user must be a doctor",
          400
        );
      }
    }

    // RBAC: Schedule updates - only doctors and admins
    if (body.scheduledStartAt) {
      if (user.role !== UserRole.DOCTOR && user.role !== UserRole.ADMIN) {
        return errorResponse(
          ErrorCodes.FORBIDDEN,
          "Only doctors and admins can update consultation schedule",
          403
        );
      }
    }

    // Validate status transition
    if (body.status) {
      if (
        !Object.values(ConsultationStatus).includes(
          body.status as ConsultationStatus
        )
      ) {
        return errorResponse(
          ErrorCodes.VALIDATION_ERROR,
          "Invalid status value",
          400
        );
      }

      if (!isValidStatusTransition(consultation.status, body.status)) {
        return errorResponse(
          ErrorCodes.INVALID_STATUS_TRANSITION,
          `Cannot transition from ${consultation.status} to ${body.status}`,
          400,
          { from: consultation.status, to: body.status }
        );
      }
    }

    // Optimistic locking check
    if (body.updatedAt) {
      const clientUpdatedAt = new Date(body.updatedAt);
      if (consultation.updatedAt.getTime() > clientUpdatedAt.getTime()) {
        return errorResponse(
          ErrorCodes.CONFLICT,
          "Consultation was modified by another request. Please refresh and try again.",
          409,
          {
            serverUpdatedAt: consultation.updatedAt.toISOString(),
            clientUpdatedAt: body.updatedAt,
          }
        );
      }
    }

    // Build update data
    type UpdateData = {
      status?: ConsultationStatus;
      doctorId?: string;
      scheduledStartAt?: Date;
      startedAt?: Date;
      endedAt?: Date;
    };

    const updateData: UpdateData = {};

    if (body.status) {
      updateData.status = body.status as ConsultationStatus;

      // Set timestamps based on status
      if (body.status === ConsultationStatus.IN_CALL) {
        updateData.startedAt = new Date();
      } else if (body.status === ConsultationStatus.COMPLETED) {
        updateData.endedAt = new Date();
      }
    }

    if (body.doctorId) {
      updateData.doctorId = body.doctorId;
    }

    if (body.scheduledStartAt) {
      updateData.scheduledStartAt = new Date(body.scheduledStartAt);
    }

    // Update in transaction with audit event
    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.consultation.update({
        where: { id },
        data: updateData,
      });

      // Create audit event for status changes
      if (body.status) {
        await tx.auditEvent.create({
          data: {
            actorUserId: user.id,
            consultationId: consultation.id,
            eventType: "CONSULT_STATUS_CHANGED",
            eventMetadata: {
              from: consultation.status,
              to: body.status,
            },
          },
        });
      }

      return updated;
    });

    return successResponse(result);
  } catch (error) {
    console.error("Error updating consultation:", error);
    return errorResponse(
      ErrorCodes.INTERNAL_ERROR,
      "Failed to update consultation",
      500
    );
  }
}
