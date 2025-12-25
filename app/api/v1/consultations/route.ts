import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  errorResponse,
  successResponse,
  requireAuth,
  ErrorCodes,
} from "@/lib/api-utils";
import { ConsultationStatus } from "@/app/generated/prisma/client";

/**
 * POST /api/v1/consultations
 * Create a new consultation booking with intake data.
 */
export async function POST(request: NextRequest) {
  const authResult = await requireAuth();
  if (authResult.errorResponse) {
    return authResult.errorResponse;
  }
  const { session } = authResult;

  let body;
  try {
    body = await request.json();
  } catch {
    return errorResponse(ErrorCodes.VALIDATION_ERROR, "Invalid JSON", 400);
  }

  const {
    specialty,
    doctorId,
    scheduledStartAt, // ISO Date string
    intake
  } = body;

  if (!specialty || !scheduledStartAt || !intake) {
    return errorResponse(ErrorCodes.VALIDATION_ERROR, "Missing required fields", 400);
  }

  try {
    // 1. Validate Availability (Double Check)
    // In a real app, you'd lock the slot here. For now, we trust the optimistic UI but handle collisions at DB level if constraints existed.

    // 2. Create Consultation & Intake Transactionally
    const consultation = await prisma.consultation.create({
      data: {
        patientId: session.user.id,
        doctorId: doctorId || null, // Doctor might be auto-assigned/null if none selected
        specialty: specialty,
        status: ConsultationStatus.CREATED,
        scheduledStartAt: new Date(scheduledStartAt),
        patientIntake: {
          create: {
            nameOrAlias: intake.nameOrAlias,
            ageRange: intake.ageRange,
            chiefComplaint: intake.chiefComplaint,
            consentAcceptedAt: new Date()
          }
        }
      }
    });

    return successResponse(consultation, 201);

  } catch (error) {
    console.error("Booking Creation Error:", error);
    return errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to create booking", 500);
  }
}
