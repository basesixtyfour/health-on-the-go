/**
 * Consultations API Routes
 * 
 * POST /api/v1/consultations - Create a new consultation
 * GET /api/v1/consultations - List consultations (filtered by role)
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  errorResponse,
  successResponse,
  requireAuth,
  ErrorCodes,
  VALID_SPECIALTIES,
  type Specialty,
} from '@/lib/api-utils';
import { ConsultationStatus, UserRole } from '@/app/generated/prisma/client';

/**
 * POST /api/v1/consultations
 * Create a new consultation
 */
export async function POST(request: NextRequest) {
  // Check authentication
  const authResult = await requireAuth();
  if (authResult.errorResponse) {
    return authResult.errorResponse;
  }

  const { session } = authResult;
  const user = session.user;

  // Parse request body
  let body: { specialty?: string; scheduledStartAt?: string };
  try {
    body = await request.json();
  } catch {
    return errorResponse(
      ErrorCodes.VALIDATION_ERROR,
      'Invalid JSON body',
      400
    );
  }

  // Validate specialty
  if (!body.specialty) {
    return errorResponse(
      ErrorCodes.VALIDATION_ERROR,
      'Specialty is required',
      400,
      { field: 'specialty' }
    );
  }

  if (!VALID_SPECIALTIES.includes(body.specialty as Specialty)) {
    return errorResponse(
      ErrorCodes.VALIDATION_ERROR,
      `Invalid specialty. Valid options: ${VALID_SPECIALTIES.join(', ')}`,
      400,
      { field: 'specialty', validOptions: VALID_SPECIALTIES }
    );
  }

  // Validate scheduledStartAt if provided
  let scheduledStartAt: Date | null = null;
  if (body.scheduledStartAt) {
    scheduledStartAt = new Date(body.scheduledStartAt);
    if (isNaN(scheduledStartAt.getTime())) {
      return errorResponse(
        ErrorCodes.VALIDATION_ERROR,
        'Invalid date format for scheduledStartAt',
        400,
        { field: 'scheduledStartAt' }
      );
    }
    // Ensure scheduled time is in the future
    if (scheduledStartAt.getTime() <= Date.now()) {
      return errorResponse(
        ErrorCodes.VALIDATION_ERROR,
        'Scheduled time must be in the future',
        400,
        { field: 'scheduledStartAt' }
      );
    }
  }

  try {
    // Create consultation in a transaction with audit event
    const result = await prisma.$transaction(async (tx) => {
      const consultation = await tx.consultation.create({
        data: {
          patientId: user.id,
          specialty: body.specialty!,
          status: ConsultationStatus.CREATED,
          scheduledStartAt,
        },
      });

      // Create audit event
      await tx.auditEvent.create({
        data: {
          actorUserId: user.id,
          consultationId: consultation.id,
          eventType: 'CONSULT_CREATED',
          eventMetadata: {
            specialty: consultation.specialty,
            scheduledStartAt: consultation.scheduledStartAt?.toISOString() ?? null,
          },
        },
      });

      return consultation;
    });

    return successResponse(result, 201);
  } catch (error) {
    console.error('Error creating consultation:', error);
    return errorResponse(
      ErrorCodes.INTERNAL_ERROR,
      'Failed to create consultation',
      500
    );
  }
}

/**
 * GET /api/v1/consultations
 * List consultations with role-based filtering
 */
export async function GET(request: NextRequest) {
  // Check authentication
  const authResult = await requireAuth();
  if (authResult.errorResponse) {
    return authResult.errorResponse;
  }

  const { session } = authResult;
  const user = session.user;

  // Parse query parameters
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const specialty = searchParams.get('specialty');
  const limit = parseInt(searchParams.get('limit') ?? '20', 10);
  const offset = parseInt(searchParams.get('offset') ?? '0', 10);

  // Build where clause based on user role
  type WhereClause = {
    patientId?: string;
    doctorId?: string;
    status?: ConsultationStatus;
    specialty?: string;
    OR?: Array<{ patientId?: string; doctorId?: string }>;
  };

  let whereClause: WhereClause = {};

  // Role-based filtering
  if (user.role === UserRole.PATIENT) {
    // Patients can only see their own consultations
    whereClause.patientId = user.id;
  } else if (user.role === UserRole.DOCTOR) {
    // Doctors see consultations assigned to them
    whereClause.doctorId = user.id;
  }
  // Admins can see all consultations - no filter needed

  // Apply optional filters
  if (status && Object.values(ConsultationStatus).includes(status as ConsultationStatus)) {
    whereClause.status = status as ConsultationStatus;
  }
  if (specialty && VALID_SPECIALTIES.includes(specialty as Specialty)) {
    whereClause.specialty = specialty;
  }

  try {
    // Execute query with pagination
    const [consultations, total] = await Promise.all([
      prisma.consultation.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        take: Math.min(limit, 100), // Cap at 100
        skip: offset,
        include: {
          patientIntake: true,
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
    console.error('Error listing consultations:', error);
    return errorResponse(
      ErrorCodes.INTERNAL_ERROR,
      'Failed to list consultations',
      500
    );
  }
}
