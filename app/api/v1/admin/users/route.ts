import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, successResponse, errorResponse, ErrorCodes } from "@/lib/api-utils";
import { UserRole, Prisma } from "@/app/generated/prisma/client";

/**
 * GET /api/v1/admin/users
 * Admin-only: List all users
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
    const role = searchParams.get("role") as UserRole | null;
    const query = searchParams.get("query"); // Search by name or email

    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = {};
    if (role) where.role = role;
    if (query) {
        where.OR = [
            { name: { contains: query, mode: "insensitive" } },
            { email: { contains: query, mode: "insensitive" } }
        ];
    }

    try {
        const [users, total] = await Promise.all([
            prisma.user.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: "desc" },
                select: {
                    id: true,
                    name: true,
                    email: true,
                    role: true,
                    createdAt: true,
                    emailVerified: true,
                    image: true,
                    doctorProfile: {
                        select: {
                            specialties: true,
                            timezone: true
                        }
                    }
                }
            }),
            prisma.user.count({ where }),
        ]);

        return successResponse({
            data: users,
            meta: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            }
        });
    } catch (error) {
        console.error("Admin User List Error:", error);
        return errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch users", 500);
    }
}

/**
 * PATCH /api/v1/admin/users
 * Admin-only: Update user role and optionally manage DoctorProfile
 * Body: { userId: string, role?: UserRole, specialty?: string, specialties?: string[] }
 * - specialty: Add a single specialty (for backwards compatibility)
 * - specialties: Set the complete list of specialties
 */
export async function PATCH(request: NextRequest) {
    const authResult = await requireAuth();
    if (authResult.errorResponse) return authResult.errorResponse;
    const { session } = authResult;

    if (session.user.role !== "ADMIN") {
        return errorResponse(ErrorCodes.FORBIDDEN, "Admin access required", 403);
    }

    let body;
    try {
        body = await request.json();
    } catch {
        return errorResponse(ErrorCodes.VALIDATION_ERROR, "Invalid JSON body", 400);
    }

    const { userId, role, specialty, specialties } = body;

    if (!userId) {
        return errorResponse(ErrorCodes.VALIDATION_ERROR, "userId is required", 400);
    }

    try {
        const result = await prisma.$transaction(async (tx) => {
            // First fetch the user to check current state
            const existingUser = await tx.user.findUnique({
                where: { id: userId },
                include: { doctorProfile: true }
            });

            if (!existingUser) {
                throw { code: 'P2025' };
            }

            // Update role if provided
            let updatedUser = existingUser;
            if (role && Object.values(UserRole).includes(role)) {
                updatedUser = await tx.user.update({
                    where: { id: userId },
                    data: { role },
                    include: { doctorProfile: true }
                });
            }

            // Handle doctor profile updates
            const targetRole = role || existingUser.role;
            if (targetRole === 'DOCTOR') {
                // Determine what specialties to set
                let newSpecialties: string[] = [];

                if (specialties && Array.isArray(specialties)) {
                    // If specialties array is provided, use it directly
                    newSpecialties = specialties;
                } else if (specialty) {
                    // If single specialty provided, add to existing or create new
                    const existingSpecialties = existingUser.doctorProfile?.specialties || [];
                    if (!existingSpecialties.includes(specialty)) {
                        newSpecialties = [...existingSpecialties, specialty];
                    } else {
                        newSpecialties = existingSpecialties;
                    }
                }

                if (newSpecialties.length > 0 || !existingUser.doctorProfile) {
                    await tx.doctorProfile.upsert({
                        where: { doctorId: userId },
                        create: {
                            doctorId: userId,
                            specialties: newSpecialties.length > 0 ? newSpecialties : ['GENERAL'],
                            timezone: "UTC"
                        },
                        update: {
                            specialties: newSpecialties
                        }
                    });
                }
            }

            // Return updated user with profile
            return await tx.user.findUnique({
                where: { id: userId },
                select: {
                    id: true,
                    name: true,
                    role: true,
                    doctorProfile: {
                        select: {
                            specialties: true,
                            timezone: true
                        }
                    }
                }
            });
        });

        return successResponse(result);
    } catch (error) {
        console.error("Admin Update User Error:", error);
        if ((error as any).code === 'P2025') {
            return errorResponse(ErrorCodes.NOT_FOUND, "User not found", 404);
        }
        return errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to update user", 500);
    }
}

