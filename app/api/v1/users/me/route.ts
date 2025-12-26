/**
 * Current user profile API
 *
 * GET /api/v1/users/me
 * PATCH /api/v1/users/me
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

function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export async function GET(_request: NextRequest) {
  const authResult = await requireAuth();
  if (authResult.errorResponse) return authResult.errorResponse;

  const { session } = authResult;
  const user = session.user;

  try {
    const include =
      user.role === UserRole.DOCTOR ? { doctorProfile: true } : undefined;

    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      ...(include ? { include } : {}),
    });

    if (!dbUser) {
      return errorResponse(ErrorCodes.NOT_FOUND, "User not found", 404);
    }

    return successResponse(dbUser);
  } catch (error) {
    console.error("Error fetching current user:", error);
    return errorResponse(
      ErrorCodes.INTERNAL_ERROR,
      "Failed to fetch current user",
      500
    );
  }
}

export async function PATCH(request: NextRequest) {
  const authResult = await requireAuth();
  if (authResult.errorResponse) return authResult.errorResponse;

  const { session } = authResult;
  const user = session.user;

  let body: any;
  try {
    body = await request.json();
  } catch {
    return errorResponse(ErrorCodes.VALIDATION_ERROR, "Invalid JSON body", 400);
  }

  // Disallow privilege / identity changes via this endpoint
  if (body?.email !== undefined || body?.role !== undefined) {
    return errorResponse(
      ErrorCodes.VALIDATION_ERROR,
      "Updating email or role is not allowed",
      400
    );
  }

  // Doctor profile updates (doctors only)
  if (body?.doctorProfile !== undefined) {
    if (user.role !== UserRole.DOCTOR) {
      return errorResponse(
        ErrorCodes.FORBIDDEN,
        "Only doctors can update doctor profile fields",
        403
      );
    }

    const existing = await prisma.user.findUnique({
      where: { id: user.id },
      include: { doctorProfile: true },
    });

    if (!existing?.doctorProfile) {
      return errorResponse(
        ErrorCodes.NOT_FOUND,
        "Doctor profile not found",
        404
      );
    }

    const dp = body.doctorProfile ?? {};
    const dpData: { specialties?: string[]; timezone?: string | null } = {};

    if (dp.specialties !== undefined) {
      if (
        !Array.isArray(dp.specialties) ||
        dp.specialties.length === 0 ||
        dp.specialties.some((s: any) => typeof s !== "string" || !s)
      ) {
        return errorResponse(
          ErrorCodes.VALIDATION_ERROR,
          "Invalid specialties",
          400,
          { field: "doctorProfile.specialties" }
        );
      }
      dpData.specialties = dp.specialties;
    }

    if (dp.timezone !== undefined) {
      if (dp.timezone !== null && typeof dp.timezone !== "string") {
        return errorResponse(
          ErrorCodes.VALIDATION_ERROR,
          "Invalid timezone",
          400,
          { field: "doctorProfile.timezone" }
        );
      }
      dpData.timezone = dp.timezone;
    }

    const updatedDoctorProfile = await prisma.doctorProfile.update({
      where: { doctorId: user.id },
      data: dpData,
    });

    return successResponse({
      ...existing,
      doctorProfile: updatedDoctorProfile,
    });
  }

  const data: { name?: string; image?: string | null } = {};

  if (body?.name !== undefined) {
    if (typeof body.name !== "string" || body.name.trim().length === 0) {
      return errorResponse(ErrorCodes.VALIDATION_ERROR, "Invalid name", 400, {
        field: "name",
      });
    }
    data.name = body.name;
  }

  if (body?.image !== undefined) {
    if (
      body.image !== null &&
      (typeof body.image !== "string" || !isValidHttpUrl(body.image))
    ) {
      return errorResponse(
        ErrorCodes.VALIDATION_ERROR,
        "Invalid image URL",
        400,
        { field: "image" }
      );
    }
    data.image = body.image;
  }

  if (Object.keys(data).length === 0) {
    return errorResponse(
      ErrorCodes.VALIDATION_ERROR,
      "No updatable fields provided",
      400
    );
  }

  try {
    const updated = await prisma.user.update({
      where: { id: user.id },
      data,
    });
    return successResponse(updated);
  } catch (error) {
    console.error("Error updating current user:", error);
    return errorResponse(
      ErrorCodes.INTERNAL_ERROR,
      "Failed to update current user",
      500
    );
  }
}
