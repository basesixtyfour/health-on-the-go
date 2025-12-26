/**
 * Doctors API Routes
 * GET /api/v1/doctors - List all doctors with their profiles
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  errorResponse,
  successResponse,
  requireAuth,
  ErrorCodes,
  VALID_SPECIALTIES,
  type Specialty,
} from "@/lib/api-utils";
import { UserRole } from "@/app/generated/prisma/client";

export async function GET(request: NextRequest) {
  const authResult = await requireAuth();
  if (authResult.errorResponse) {
    return authResult.errorResponse;
  }

  const { searchParams } = new URL(request.url);
  const specialty = searchParams.get("specialty");
  const search = searchParams.get("search");

  const limitRaw = searchParams.get("limit") ?? "20";
  const offsetRaw = searchParams.get("offset") ?? "0";
  const limit = Math.max(1, Math.min(100, parseInt(limitRaw, 10) || 20));
  const offset = Math.max(0, parseInt(offsetRaw, 10) || 0);

  type WhereClause = {
    role: UserRole;
    name?: { contains: string; mode: "insensitive" };
    doctorProfile?: { specialties: { has: string } };
  };

  const whereClause: WhereClause = {
    role: UserRole.DOCTOR,
  };

  if (search) {
    whereClause.name = { contains: search, mode: "insensitive" };
  }

  if (specialty && VALID_SPECIALTIES.includes(specialty as Specialty)) {
    whereClause.doctorProfile = { specialties: { has: specialty } };
  }

  try {
    const [doctors, total] = await Promise.all([
      prisma.user.findMany({
        where: whereClause,
        orderBy: { name: "asc" },
        take: limit,
        skip: offset,
        include: {
          doctorProfile: true,
        },
      }),
      prisma.user.count({ where: whereClause }),
    ]);

    return successResponse({
      data: doctors,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + doctors.length < total,
      },
    });
  } catch (error) {
    console.error("Error listing doctors:", error);
    return errorResponse(
      ErrorCodes.INTERNAL_ERROR,
      "Failed to list doctors",
      500
    );
  }
}
