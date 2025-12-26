/**
 * Demo Instant Call API
 *
 * POST /api/v1/demo/instant-call
 *
 * 🎬 HACKATHON DEMO ONLY - Creates an instant video call bypassing payment flow
 *
 * Only works when DEMO_MODE=true in environment variables.
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createRoom } from "@/lib/daily";
import {
  errorResponse,
  successResponse,
  requireAuth,
  ErrorCodes,
} from "@/lib/api-utils";
import { ConsultationStatus } from "@/app/generated/prisma/client";

// Token expiry (in minutes)
const TOKEN_EXPIRY_MINUTES = 60;

// Demo accounts from environment variables
const DEMO_DOCTOR_EMAIL = process.env.DEMO_DOCTOR_EMAIL;
const DEMO_PATIENT_EMAIL = process.env.DEMO_PATIENT_EMAIL;

export async function POST(_request: NextRequest) {
  // Check if demo mode is enabled
  if (process.env.DEMO_MODE !== "true") {
    return errorResponse(
      ErrorCodes.FORBIDDEN,
      "Demo mode is not enabled. Set DEMO_MODE=true in environment variables.",
      403
    );
  }

  if (!DEMO_DOCTOR_EMAIL || !DEMO_PATIENT_EMAIL) {
    return errorResponse(
      ErrorCodes.INTERNAL_ERROR,
      "Demo mode is misconfigured. Set DEMO_DOCTOR_EMAIL and DEMO_PATIENT_EMAIL.",
      500
    );
  }

  // Check authentication
  const authResult = await requireAuth();
  if (authResult.errorResponse) {
    return authResult.errorResponse;
  }

  const { session } = authResult;
  const user = session.user;

  try {
    // Allow only demo accounts to trigger demo call creation (prevents accidental prod abuse)
    const userEmail =
      typeof (user as unknown as { email?: unknown })?.email === "string"
        ? (user as unknown as { email: string }).email
        : null;

    if (userEmail !== DEMO_DOCTOR_EMAIL && userEmail !== DEMO_PATIENT_EMAIL) {
      return errorResponse(
        ErrorCodes.FORBIDDEN,
        "Demo call creation is restricted to demo accounts.",
        403
      );
    }

    // Get the demo doctor
    const demoDoctor = await prisma.user.findUnique({
      where: { email: DEMO_DOCTOR_EMAIL },
      select: { id: true },
    });

    if (!demoDoctor) {
      return errorResponse(
        ErrorCodes.NOT_FOUND,
        `Demo doctor (${DEMO_DOCTOR_EMAIL}) not found. Please sign in with this account first.`,
        404
      );
    }

    // Get the demo patient
    const demoPatient = await prisma.user.findUnique({
      where: { email: DEMO_PATIENT_EMAIL },
      select: { id: true },
    });

    if (!demoPatient) {
      return errorResponse(
        ErrorCodes.NOT_FOUND,
        `Demo patient (${DEMO_PATIENT_EMAIL}) not found. Please sign in with this account first.`,
        404
      );
    }

    // Determine patient and doctor based on who initiated
    let patientId: string;
    let doctorId: string;

    if (userEmail === DEMO_DOCTOR_EMAIL) {
      // Demo doctor initiated - use demo patient
      doctorId = user.id;
      patientId = demoPatient.id;
    } else {
      // Demo patient initiated - use demo doctor
      patientId = user.id;
      doctorId = demoDoctor.id;
    }

    // Create a demo consultation with PAID status (bypassing payment)
    const consultation = await prisma.consultation.create({
      data: {
        patientId,
        doctorId,
        specialty: "GENERAL",
        status: ConsultationStatus.PAID,
        scheduledStartAt: new Date(), // Scheduled for now
      },
    });

    // Create patient intake for demo
    await prisma.patientIntake.create({
      data: {
        consultationId: consultation.id,
        nameOrAlias: "Demo Patient",
        ageRange: "18-39",
        chiefComplaint: "Hackathon demonstration",
        consentAcceptedAt: new Date(),
      },
    });

    // Create Daily room
    const roomName = `demo_${consultation.id}_${Date.now()}`;
    const room = await createRoom(roomName, TOKEN_EXPIRY_MINUTES);

    // Create video session
    const videoSession = await prisma.videoSession.create({
      data: {
        consultationId: consultation.id,
        provider: "DAILY",
        roomName: room.name,
        roomUrl: room.url,
      },
    });

    // Update consultation to IN_CALL
    await prisma.consultation.update({
      where: { id: consultation.id },
      data: {
        status: ConsultationStatus.IN_CALL,
        startedAt: new Date(),
      },
    });

    // Create audit event
    await prisma.auditEvent.create({
      data: {
        actorUserId: user.id,
        consultationId: consultation.id,
        eventType: "DEMO_CALL_CREATED",
        eventMetadata: {
          roomName: videoSession.roomName,
          demo: true,
        },
      },
    });

    return successResponse({
      consultationId: consultation.id,
      message:
        "🎬 Demo call created! The other participant can join from their dashboard.",
    });
  } catch (error) {
    console.error("Error creating demo call:", error);
    return errorResponse(
      ErrorCodes.INTERNAL_ERROR,
      "Failed to create demo call",
      500
    );
  }
}
