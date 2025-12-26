/**
 * Current user's consultation history
 *
 * GET /api/v1/users/me/consultations
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  errorResponse,
  successResponse,
  requireAuth,
  ErrorCodes,
} from "@/lib/api-utils";
import { ConsultationStatus, UserRole } from "@/app/generated/prisma/client";

export async function GET(request: NextRequest) {
  const authResult = await requireAuth();
  if (authResult.errorResponse) return authResult.errorResponse;

  const { session } = authResult;
  const user = session.user;

  const { searchParams } = new URL(request.url);

  const statusRaw = searchParams.get("status");
  const fromRaw = searchParams.get("from");
  const toRaw = searchParams.get("to");

  const limitRaw = searchParams.get("limit") ?? "20";
  const offsetRaw = searchParams.get("offset") ?? "0";
  const limit = Math.max(1, Math.min(100, parseInt(limitRaw, 10) || 20));
  const offset = Math.max(0, parseInt(offsetRaw, 10) || 0);

  type WhereClause = {
    patientId?: string;
    doctorId?: string;
    OR?: Array<{ patientId?: string; doctorId?: string }>;
    status?: ConsultationStatus;
    createdAt?: { gte?: Date; lte?: Date };
  };

  const whereClause: WhereClause = {};

  if (user.role === UserRole.PATIENT) {
    whereClause.patientId = user.id;
  } else if (user.role === UserRole.DOCTOR) {
    whereClause.doctorId = user.id;
  } else {
    // Admins can only see consultations where they are the patient or doctor via /me
    whereClause.OR = [{ patientId: user.id }, { doctorId: user.id }];
  }

  if (
    statusRaw &&
    Object.values(ConsultationStatus).includes(statusRaw as ConsultationStatus)
  ) {
    whereClause.status = statusRaw as ConsultationStatus;
  }

  if (fromRaw || toRaw) {
    const createdAt: { gte?: Date; lte?: Date } = {};
    if (fromRaw) {
      const from = new Date(fromRaw);
      if (isNaN(from.getTime())) {
        return errorResponse(
          ErrorCodes.VALIDATION_ERROR,
          "Invalid from date",
          400,
          { field: "from" }
        );
      }
      createdAt.gte = from;
    }
    if (toRaw) {
      const to = new Date(toRaw);
      if (isNaN(to.getTime())) {
        return errorResponse(
          ErrorCodes.VALIDATION_ERROR,
          "Invalid to date",
          400,
          { field: "to" }
        );
      }
      createdAt.lte = to;
    }
    whereClause.createdAt = createdAt;
  }

  try {
    const [consultations, total] = await Promise.all([
      prisma.consultation.findMany({
        where: whereClause,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
        include: {
          doctor: {
            select: {
              id: true,
              name: true,
              image: true,
            },
          },
          payments: true,
        },
      }),
      prisma.consultation.count({ where: whereClause }),
    ]);

    return successResponse({
      data: consultations,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + consultations.length < total,
      },
    });
  } catch (error) {
    console.error("Error listing current user consultations:", error);
    return errorResponse(
      ErrorCodes.INTERNAL_ERROR,
      "Failed to list consultations",
      500
    );
  }
}
