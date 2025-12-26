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

  const authResult = await requireAuth();
  if (authResult.errorResponse) return authResult.errorResponse;

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

    const [demoDoctor, demoPatient] = await Promise.all([
      prisma.user.findUnique({
        where: { email: DEMO_DOCTOR_EMAIL },
        select: { id: true },
      }),
      prisma.user.findUnique({
        where: { email: DEMO_PATIENT_EMAIL },
        select: { id: true },
      }),
    ]);

    if (!demoDoctor) {
      return errorResponse(
        ErrorCodes.NOT_FOUND,
        `Demo doctor (${DEMO_DOCTOR_EMAIL}) not found. Please sign in with this account first.`,
        404
      );
    }

    if (!demoPatient) {
      return errorResponse(
        ErrorCodes.NOT_FOUND,
        `Demo patient (${DEMO_PATIENT_EMAIL}) not found. Please sign in with this account first.`,
        404
      );
    }

    // Determine patient and doctor based on who initiated.
    // (Either way, it's the same doctor/patient pair, just with a different initiator.)
    const patientId = userEmail === DEMO_PATIENT_EMAIL ? user.id : demoPatient.id;
    const doctorId = userEmail === DEMO_DOCTOR_EMAIL ? user.id : demoDoctor.id;

    const reuseCutoff = new Date(Date.now() - ROOM_EXPIRY_MINUTES * 60 * 1000);

    // Only reuse consultations within room expiry. Daily rooms do not exist beyond ROOM_EXPIRY_MINUTES.
    const reusableConsultation = await prisma.consultation.findFirst({
      where: {
        patientId,
        doctorId,
        status: {
          in: [ConsultationStatus.PAID, ConsultationStatus.IN_CALL],
        },
        createdAt: {
          gte: reuseCutoff,
        },
      },
      include: {
        videoSession: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    if (reusableConsultation) {
      await prisma.auditEvent.create({
        data: {
          actorUserId: user.id,
          consultationId: reusableConsultation.id,
          eventType: "DEMO_CALL_REJOINED",
          eventMetadata: {
            roomName: reusableConsultation.videoSession?.roomName,
            demo: true,
            userEmail,
          },
        },
      });

      return successResponse({
        consultationId: reusableConsultation.id,
        message:
          "🎬 Joining existing demo call! Both participants will be in the same room.",
        isExisting: true,
      });
    }

    // Best-effort cleanup of the most recent stale "active" consultation (room already expired).
    const staleConsultation = await prisma.consultation.findFirst({
      where: {
        patientId,
        doctorId,
        status: {
          in: [ConsultationStatus.PAID, ConsultationStatus.IN_CALL],
        },
        createdAt: {
          lt: reuseCutoff,
        },
      },
      include: {
        videoSession: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    if (staleConsultation) {
      const staleRoomName = staleConsultation.videoSession?.roomName;

      if (staleRoomName) {
        try {
          await deleteRoom(staleRoomName);
        } catch (cleanupErr) {
          console.error(
            "Failed to delete expired Daily room for demo consultation:",
            cleanupErr
          );
        }
      }

      await prisma.$transaction(async (tx) => {
        await tx.consultation.update({
          where: { id: staleConsultation.id },
          data: {
            status: ConsultationStatus.EXPIRED,
            endedAt: new Date(),
          },
        });

        await tx.auditEvent.create({
          data: {
            actorUserId: user.id,
            consultationId: staleConsultation.id,
            eventType: "DEMO_CALL_EXPIRED",
            eventMetadata: {
              roomName: staleRoomName,
              demo: true,
            },
          },
        });
      });
    }

    // Create Daily room first (external API call - can't be in transaction)
    const roomName = `demo_${Date.now()}`;
    const room = await createRoom(roomName, ROOM_EXPIRY_MINUTES);

    try {
      const consultation = await prisma.$transaction(async (tx) => {
        const now = new Date();

        const newConsultation = await tx.consultation.create({
          data: {
            patientId,
            doctorId,
            specialty: "GENERAL",
            status: ConsultationStatus.PAID,
            scheduledStartAt: now,
          },
        });

        await tx.patientIntake.create({
          data: {
            consultationId: newConsultation.id,
            nameOrAlias: "Demo Patient",
            ageRange: "18-39",
            chiefComplaint: "Hackathon demonstration",
            consentAcceptedAt: now,
          },
        });

        await tx.videoSession.create({
          data: {
            consultationId: newConsultation.id,
            provider: "DAILY",
            roomName: room.name,
            roomUrl: room.url,
          },
        });

        await tx.consultation.update({
          where: { id: newConsultation.id },
          data: {
            status: ConsultationStatus.IN_CALL,
            startedAt: now,
          },
        });

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
      throw txError;
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
