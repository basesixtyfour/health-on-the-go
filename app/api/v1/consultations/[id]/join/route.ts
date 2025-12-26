/**
 * Consultation Join API Route
 *
 * POST /api/v1/consultations/:id/join
 *
 * Generates a video call join URL for a consultation.
 * Creates Daily room on first join (lazy creation) and validates time windows.
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createMeetingToken, createRoom, deleteRoom } from "@/lib/daily";
import {
  errorResponse,
  successResponse,
  requireAuth,
  ErrorCodes,
} from "@/lib/api-utils";
import { ConsultationStatus, UserRole } from "@/app/generated/prisma/client";

// Time window constants (in minutes)
const EARLY_JOIN_WINDOW_MINUTES = 5;
const LATE_JOIN_WINDOW_MINUTES = 30;

// Token expiry (in minutes)
const TOKEN_EXPIRY_MINUTES = 30;

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

  try {
    // Fetch consultation with video session
    const consultation = await prisma.consultation.findUnique({
      where: { id: consultationId },
      include: {
        videoSession: true,
      },
    });

    // Check if consultation exists
    if (!consultation) {
      return errorResponse(ErrorCodes.NOT_FOUND, "Consultation not found", 404);
    }

    // Check authorization: must be patient, assigned doctor, or admin
    const isPatient = consultation.patientId === user.id;
    const isDoctor = consultation.doctorId === user.id;
    const isAdmin = user.role === UserRole.ADMIN;

    if (!isPatient && !isDoctor && !isAdmin) {
      return errorResponse(
        ErrorCodes.FORBIDDEN,
        "You are not authorized to join this consultation",
        403
      );
    }

    // Check consultation status
    if (
      consultation.status !== ConsultationStatus.PAID &&
      consultation.status !== ConsultationStatus.IN_CALL
    ) {
      return errorResponse(
        ErrorCodes.VALIDATION_ERROR,
        `Cannot join consultation with status: ${consultation.status}. Consultation must be in PAID or IN_CALL status.`,
        400,
        {
          currentStatus: consultation.status,
          requiredStatus: [ConsultationStatus.PAID, ConsultationStatus.IN_CALL],
        }
      );
    }

    // Validate time window
    if (consultation.scheduledStartAt) {
      const now = Date.now();
      const scheduledTime = consultation.scheduledStartAt.getTime();
      const earlyBoundary =
        scheduledTime - EARLY_JOIN_WINDOW_MINUTES * 60 * 1000;
      const lateBoundary = scheduledTime + LATE_JOIN_WINDOW_MINUTES * 60 * 1000;

      if (now < earlyBoundary) {
        const minutesUntilOpen = Math.ceil((earlyBoundary - now) / 60000);
        return errorResponse(
          ErrorCodes.VALIDATION_ERROR,
          `Too early to join. You can join ${EARLY_JOIN_WINDOW_MINUTES} minutes before the scheduled time. Please wait ${minutesUntilOpen} more minutes.`,
          400,
          {
            scheduledAt: consultation.scheduledStartAt,
            opensAt: new Date(earlyBoundary),
          }
        );
      }

      if (now > lateBoundary) {
        return errorResponse(
          ErrorCodes.VALIDATION_ERROR,
          `Too late to join. The join window closed ${LATE_JOIN_WINDOW_MINUTES} minutes after the scheduled time.`,
          400,
          {
            scheduledAt: consultation.scheduledStartAt,
            closedAt: new Date(lateBoundary),
          }
        );
      }
    }

    // Get or create video session
    let videoSession = consultation.videoSession;

    if (!videoSession) {
      // Create Daily room
      const roomName = `consult_${consultationId}_${Date.now()}`;
      const room = await createRoom(roomName, TOKEN_EXPIRY_MINUTES);

      try {
        // Save video session + update consultation atomically
        videoSession = await prisma.$transaction(async (tx) => {
          const createdSession = await tx.videoSession.create({
            data: {
              consultationId,
              provider: "DAILY",
              roomName: room.name,
              roomUrl: room.url,
            },
          });

          await tx.consultation.update({
            where: { id: consultationId },
            data: {
              status: ConsultationStatus.IN_CALL,
              startedAt: new Date(),
            },
          });

          return createdSession;
        });
      } catch (err) {
        // DB transaction failed; clean up created Daily room to avoid orphans.
        try {
          await deleteRoom(room.name);
        } catch (cleanupErr) {
          console.error(
            "Failed to delete Daily room after transaction failure:",
            cleanupErr
          );
        }

        console.error(
          "Failed to persist video session / consultation update; Daily room cleaned up:",
          err
        );
        throw err;
      }
    }

    // Determine if user is owner (doctor or admin gets owner privileges)
    const isOwner = isDoctor || isAdmin;

    // Generate meeting token
    const token = await createMeetingToken(
      videoSession.roomName,
      user.id,
      isOwner
    );

    // Calculate token expiry
    const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_MINUTES * 60 * 1000);

    // Create audit event
    await prisma.auditEvent.create({
      data: {
        actorUserId: user.id,
        consultationId,
        eventType: "JOIN_TOKEN_MINTED",
        eventMetadata: {
          roomName: videoSession.roomName,
          isOwner,
          userRole: user.role,
        },
      },
    });

    // Build join URL (Daily Prebuilt URL with token)
    const joinUrl = `${videoSession.roomUrl}?t=${token}`;

    return successResponse({
      joinUrl,
      roomUrl: videoSession.roomUrl,
      token,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (error) {
    console.error("Error joining consultation:", error);
    return errorResponse(
      ErrorCodes.INTERNAL_ERROR,
      "Failed to join consultation",
      500
    );
  }
}
