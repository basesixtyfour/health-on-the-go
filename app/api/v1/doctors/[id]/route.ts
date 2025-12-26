/**
 * Single Doctor API Routes
 * GET /api/v1/doctors/:id - Get a specific doctor by ID
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  errorResponse,
  successResponse,
  requireAuth,
  ErrorCodes,
} from "@/lib/api-utils";
import { UserRole } from "@/app/generated/prisma/client";

type RouteParams = {
  params: Promise<{ id: string }>;
};

export async function GET(request: NextRequest, { params }: RouteParams) {
  const authResult = await requireAuth();
  if (authResult.errorResponse) {
    return authResult.errorResponse;
  }

  const { session } = authResult;
  const { id } = await params;

  try {
    const includeCount = session.user.role === UserRole.ADMIN;

    const doctor = await prisma.user.findFirst({
      where: {
        id,
        role: UserRole.DOCTOR,
      },
      include: {
        doctorProfile: true,
        ...(includeCount && {
          _count: {
            select: { consultationsAsDoctor: true },
          },
        }),
      },
    });

    if (!doctor) {
      return errorResponse(ErrorCodes.NOT_FOUND, "Doctor not found", 404);
    }

    return successResponse(doctor);
  } catch (error) {
    console.error("Error getting doctor:", error);
    return errorResponse(
      ErrorCodes.INTERNAL_ERROR,
      "Failed to get doctor",
      500
    );
  }
}
