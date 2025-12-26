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
  VALID_AGE_RANGES,
  type Specialty,
  type AgeRange,
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
  let body: {
    specialty?: string;
    scheduledStartAt?: string;
    doctorId?: string;
    intake?: {
      nameOrAlias?: string;
      ageRange?: string;
      chiefComplaint?: string;
      consentAccepted?: boolean;
      consent?: boolean;
    };
  };
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

  // Validate intake
  if (!body.intake) {
    return errorResponse(
      ErrorCodes.VALIDATION_ERROR,
      'Intake information is required',
      400,
      { field: 'intake' }
    );
  }

  if (!body.intake.nameOrAlias || typeof body.intake.nameOrAlias !== 'string' || body.intake.nameOrAlias.trim() === '') {
    return errorResponse(
      ErrorCodes.VALIDATION_ERROR,
      'Intake name or alias is required',
      400,
      { field: 'intake.nameOrAlias' }
    );
  }

  const hasConsent = body.intake.consent === true || body.intake.consentAccepted === true;
  if (!hasConsent) {
    return errorResponse(
      ErrorCodes.VALIDATION_ERROR,
      'Consent must be accepted',
      400,
      { field: 'intake.consent' }
    );
  }

  if (!body.intake.ageRange || !VALID_AGE_RANGES.includes(body.intake.ageRange as AgeRange)) {
    return errorResponse(
      ErrorCodes.VALIDATION_ERROR,
      `Invalid age range. Valid options: ${VALID_AGE_RANGES.join(', ')}`,
      400,
      { field: 'intake.ageRange', validOptions: VALID_AGE_RANGES }
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

  // Validate doctor if provided
  if (body.doctorId) {
    const doctor = await prisma.user.findUnique({
      where: { id: body.doctorId },
      include: { doctorProfile: true },
    });

    if (!doctor || doctor.role !== UserRole.DOCTOR) {
      return errorResponse(
        ErrorCodes.VALIDATION_ERROR,
        'Doctor not found or invalid',
        400, // Using 400 as this is a validation failure of the input ID
        { field: 'doctorId' }
      );
    }

    if (!doctor.doctorProfile?.specialties?.includes(body.specialty)) {
      return errorResponse(
        ErrorCodes.VALIDATION_ERROR,
        'Selected doctor does not support the requested specialty',
        400,
        {
          field: 'doctorId',
          error: 'SPECIALTY_MISMATCH',
          requestedSpecialty: body.specialty,
          doctorSpecialties: doctor.doctorProfile?.specialties || []
        }
      );
    }
  }

  try {
    // Create consultation in a transaction with audit event
    const result = await prisma.$transaction(async (tx) => {
      const consultation = await tx.consultation.create({
        data: {
          patientId: user.id,
          doctorId: body.doctorId || null,
          specialty: body.specialty!,
          status: ConsultationStatus.CREATED,
          scheduledStartAt,
          patientIntake: {
            create: {
              nameOrAlias: body.intake!.nameOrAlias!.trim(),
              ageRange: body.intake!.ageRange,
              chiefComplaint: body.intake!.chiefComplaint,
              consentAcceptedAt: new Date(),
            },
          },
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
            doctorId: consultation.doctorId,
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