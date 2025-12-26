import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, successResponse, errorResponse, ErrorCodes } from "@/lib/api-utils";
import { Prisma } from "@/app/generated/prisma/client";

/**
 * GET /api/v1/admin/audit
 * Admin-only: List audit events
 * 
 * Query Params:
 * - page: number (default 1)
 * - limit: number (default 20)
 * - eventType: string
 * - actorUserId: string
 * - consultationId: string
 */
export async function GET(request: NextRequest) {
    const authResult = await requireAuth();
    if (authResult.errorResponse) return authResult.errorResponse;
    const { session } = authResult;

    if (session.user.role !== "ADMIN") {
        return errorResponse(ErrorCodes.FORBIDDEN, "Admin access required", 403);
    }

    const searchParams = request.nextUrl.searchParams;
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.max(1, Math.min(100, parseInt(searchParams.get("limit") || "20")));
    const eventType = searchParams.get("eventType");
    const actorUserId = searchParams.get("actorUserId");
    const consultationId = searchParams.get("consultationId");

    const skip = (page - 1) * limit;

    const where: Prisma.AuditEventWhereInput = {};
    if (eventType) where.eventType = eventType;
    if (actorUserId) where.actorUserId = actorUserId;
    if (consultationId) where.consultationId = consultationId;

    try {
        const [events, total] = await Promise.all([
            prisma.auditEvent.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: "desc" },
                include: {
                    actor: { select: { id: true, name: true, email: true } }
                }
            }),
            prisma.auditEvent.count({ where }),
        ]);

        return successResponse({
            data: events,
            meta: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            }
        });
    } catch (error) {
        console.error("Admin Audit List Error:", error);
        return errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch audit logs", 500);
    }
}
