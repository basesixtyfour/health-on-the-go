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
import { createRoom, deleteRoom } from "@/lib/daily";
import {
  errorResponse,
  successResponse,
  requireAuth,
  ErrorCodes,
} from "@/lib/api-utils";
import { ConsultationStatus } from "@/app/generated/prisma/client";

// Demo room expiry (in minutes). Daily rooms are configured with `exp` and only exist until then.
const ROOM_EXPIRY_MINUTES = 30;

// Demo accounts from environment variables
const DEMO_DOCTOR_EMAIL = process.env.DEMO_DOCTOR_EMAIL;
const DEMO_PATIENT_EMAIL = process.env.DEMO_PATIENT_EMAIL;

function getUserEmail(user: unknown): string | null {
  if (!user || typeof user !== "object") return null;
  const email = (user as { email?: unknown }).email;
  return typeof email === "string" ? email : null;
}

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
    const userEmail = getUserEmail(user);

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

    // For demo mode, always use the fixed demo doctor and patient IDs
    // This ensures both users join the same consultation
    const patientId = demoPatient.id;
    const doctorId = demoDoctor.id;

    // Check for existing active consultation between demo doctor and patient
    const existingConsultation = await prisma.consultation.findFirst({
      where: {
        patientId,
        doctorId,
        status: {
          in: [ConsultationStatus.PAID, ConsultationStatus.IN_CALL],
        },
      },
      include: {
        videoSession: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // If an active consultation exists, return it instead of creating a new one
    if (existingConsultation) {
      // Create audit event for rejoining
      await prisma.auditEvent.create({
        data: {
          actorUserId: user.id,
          consultationId: existingConsultation.id,
          eventType: "DEMO_CALL_REJOINED",
          eventMetadata: {
            roomName: existingConsultation.videoSession?.roomName,
            demo: true,
            userEmail,
          },
        },
      });

      return successResponse({
        consultationId: existingConsultation.id,
        message:
          "🎬 Joining existing demo call! Both participants will be in the same room.",
        isExisting: true,
      });
    }

    // Create Daily room first (external API call - can't be in transaction)
    const roomName = `demo_${Date.now()}`;
    const room = await createRoom(roomName, TOKEN_EXPIRY_MINUTES);

    try {
      // Wrap all DB operations in a transaction for atomicity
      const consultation = await prisma.$transaction(async (tx) => {
        // Create consultation with PAID status (bypassing payment)
        const newConsultation = await tx.consultation.create({
          data: {
            patientId,
            doctorId,
            specialty: "GENERAL",
            status: ConsultationStatus.PAID,
            scheduledStartAt: new Date(),
          },
        });

        // Create patient intake for demo
        await tx.patientIntake.create({
          data: {
            consultationId: newConsultation.id,
            nameOrAlias: "Demo Patient",
            ageRange: "18-39",
            chiefComplaint: "Hackathon demonstration",
            consentAcceptedAt: new Date(),
          },
        });

        // Create video session
        await tx.videoSession.create({
          data: {
            consultationId: newConsultation.id,
            provider: "DAILY",
            roomName: room.name,
            roomUrl: room.url,
          },
        });

        // Update consultation to IN_CALL
        await tx.consultation.update({
          where: { id: newConsultation.id },
          data: {
            status: ConsultationStatus.IN_CALL,
            startedAt: new Date(),
          },
        });

        // Create audit event
        await tx.auditEvent.create({
          data: {
            actorUserId: user.id,
            consultationId: newConsultation.id,
            eventType: "DEMO_CALL_CREATED",
            eventMetadata: {
              roomName: room.name,
              demo: true,
            },
          },
        });

        return newConsultation;
      });

      return successResponse({
        consultationId: consultation.id,
        message:
          "🎬 Demo call created! The other participant can join from their dashboard.",
      });
    } catch (txError) {
      // Transaction failed - clean up the Daily room to avoid orphans
      try {
        await deleteRoom(room.name);
      } catch (cleanupErr) {
        console.error(
          "Failed to delete Daily room after transaction failure:",
          cleanupErr
        );
      }
      throw txError; // Re-throw to be caught by outer catch block
    }
  } catch (error) {
    console.error("Error creating demo call:", error);
    return errorResponse(
      ErrorCodes.INTERNAL_ERROR,
      "Failed to create demo call",
      500
    );
  }
}
