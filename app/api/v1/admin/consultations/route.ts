import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, successResponse, errorResponse, ErrorCodes } from "@/lib/api-utils";
import { ConsultationStatus, Prisma } from "@/app/generated/prisma/client";

/**
 * GET /api/v1/admin/consultations
 * Admin-only: List all consultations with filtering and pagination
 * 
 * Query Params:
 * - page: number (default 1)
 * - limit: number (default 20)
 * - status: ConsultationStatus
 * - doctorId: string
 * - patientId: string
 */
export async function GET(request: NextRequest) {
    const authResult = await requireAuth();
    if (authResult.errorResponse) return authResult.errorResponse;
    const { session } = authResult;

    // Strict Admin Authorization
    if (session.user.role !== "ADMIN") {
        return errorResponse(ErrorCodes.FORBIDDEN, "Admin access required", 403);
    }

    const searchParams = request.nextUrl.searchParams;
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.max(1, Math.min(100, parseInt(searchParams.get("limit") || "20")));
    const status = searchParams.get("status") as ConsultationStatus | null;
    const doctorId = searchParams.get("doctorId");
    const patientId = searchParams.get("patientId");

    const skip = (page - 1) * limit;

    const where: Prisma.ConsultationWhereInput = {};
    if (status) where.status = status;
    if (doctorId) where.doctorId = doctorId;
    if (patientId) where.patientId = patientId;

    try {
        const [consultations, total] = await Promise.all([
            prisma.consultation.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: "desc" },
                include: {
                    patient: { select: { id: true, name: true, email: true } },
                    doctor: { select: { id: true, name: true, email: true } },
                }
            }),
            prisma.consultation.count({ where }),
        ]);

        return successResponse({
            data: consultations,
            meta: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            }
        });
    } catch (error) {
        console.error("Admin Consultation List Error:", error);
        return errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch consultations", 500);
    }
}
