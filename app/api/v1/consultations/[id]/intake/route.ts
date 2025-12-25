/**
 * Patient Intake API Route
 * 
 * POST /api/v1/consultations/:id/intake - Submit patient intake form
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/prisma';
import {
  errorResponse,
  successResponse,
  requireAuth,
  ErrorCodes,
  VALID_AGE_RANGES,
  type AgeRange,
} from '@/lib/api-utils';
import { ConsultationStatus } from '@/app/generated/prisma/client';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * Valid statuses that allow intake submission
 */
const INTAKE_ALLOWED_STATUSES: readonly ConsultationStatus[] = [
  ConsultationStatus.CREATED,
  ConsultationStatus.PAYMENT_PENDING,
] as const;

/**
 * POST /api/v1/consultations/:id/intake
 * Submit patient intake form
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  // Check authentication
  const authResult = await requireAuth();
  if (authResult.errorResponse) {
    return authResult.errorResponse;
  }

  const { session } = authResult;
  const user = session.user;
  const { id } = await params;

  // Parse request body
  let body: {
    nameOrAlias?: string;
    ageRange?: string;
    chiefComplaint?: string;
    consentAccepted?: boolean;
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

  // Validate required fields
  if (!body.nameOrAlias || body.nameOrAlias.trim() === '') {
    return errorResponse(
      ErrorCodes.VALIDATION_ERROR,
      'Name or alias is required',
      400,
      { field: 'nameOrAlias' }
    );
  }

  if (!body.consentAccepted) {
    return errorResponse(
      ErrorCodes.VALIDATION_ERROR,
      'Consent acceptance is required',
      400,
      { field: 'consentAccepted' }
    );
  }

  // Validate ageRange if provided
  if (body.ageRange && !VALID_AGE_RANGES.includes(body.ageRange as AgeRange)) {
    return errorResponse(
      ErrorCodes.VALIDATION_ERROR,
      `Invalid age range. Valid options: ${VALID_AGE_RANGES.join(', ')}`,
      400,
      { field: 'ageRange', validOptions: VALID_AGE_RANGES }
    );
  }

  try {
    // Fetch consultation
    const consultation = await prisma.consultation.findUnique({
      where: { id },
      include: { patientIntake: true },
    });

    if (!consultation) {
      return errorResponse(
        ErrorCodes.NOT_FOUND,
        'Consultation not found',
        404
      );
    }

    // Check authorization - only the patient can submit intake
    if (consultation.patientId !== user.id) {
      return errorResponse(
        ErrorCodes.FORBIDDEN,
        'Only the consultation owner can submit intake',
        403
      );
    }

    // Check consultation status
    if (!INTAKE_ALLOWED_STATUSES.includes(consultation.status)) {
      return errorResponse(
        ErrorCodes.VALIDATION_ERROR,
        `Cannot submit intake for consultation in ${consultation.status} status`,
        400,
        { currentStatus: consultation.status, allowedStatuses: INTAKE_ALLOWED_STATUSES }
      );
    }

    // Check if intake already exists
    if (consultation.patientIntake) {
      return errorResponse(
        ErrorCodes.CONFLICT,
        'Intake already exists for this consultation',
        409,
        { existingIntakeId: consultation.patientIntake.id }
      );
    }

    // Create patient intake
    const intake = await prisma.patientIntake.create({
      data: {
        consultationId: id,
        nameOrAlias: body.nameOrAlias.trim(),
        ageRange: body.ageRange ?? null,
        chiefComplaint: body.chiefComplaint ?? null,
        consentAcceptedAt: new Date(),
      },
    });

    return successResponse(intake, 201);
  } catch (error) {
    console.error('Error creating intake:', error);
    return errorResponse(
      ErrorCodes.INTERNAL_ERROR,
      'Failed to create intake',
      500
    );
  }
}

/**
 * PUT /api/v1/consultations/:id/intake
 * Update existing patient intake (upsert behavior)
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  // Check authentication
  const authResult = await requireAuth();
  if (authResult.errorResponse) {
    return authResult.errorResponse;
  }

  const { session } = authResult;
  const user = session.user;
  const { id } = await params;

  // Parse request body
  let body: {
    nameOrAlias?: string;
    ageRange?: string;
    chiefComplaint?: string;
    consentAccepted?: boolean;
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

  // Validate required fields
  if (!body.nameOrAlias || body.nameOrAlias.trim() === '') {
    return errorResponse(
      ErrorCodes.VALIDATION_ERROR,
      'Name or alias is required',
      400,
      { field: 'nameOrAlias' }
    );
  }

  if (!body.consentAccepted) {
    return errorResponse(
      ErrorCodes.VALIDATION_ERROR,
      'Consent acceptance is required',
      400,
      { field: 'consentAccepted' }
    );
  }

  // Validate ageRange if provided
  if (body.ageRange && !VALID_AGE_RANGES.includes(body.ageRange as AgeRange)) {
    return errorResponse(
      ErrorCodes.VALIDATION_ERROR,
      `Invalid age range. Valid options: ${VALID_AGE_RANGES.join(', ')}`,
      400,
      { field: 'ageRange', validOptions: VALID_AGE_RANGES }
    );
  }

  try {
    // Fetch consultation
    const consultation = await prisma.consultation.findUnique({
      where: { id },
    });

    if (!consultation) {
      return errorResponse(
        ErrorCodes.NOT_FOUND,
        'Consultation not found',
        404
      );
    }

    // Check authorization - only the patient can update intake
    if (consultation.patientId !== user.id) {
      return errorResponse(
        ErrorCodes.FORBIDDEN,
        'Only the consultation owner can update intake',
        403
      );
    }

    // Check consultation status
    if (!INTAKE_ALLOWED_STATUSES.includes(consultation.status)) {
      return errorResponse(
        ErrorCodes.VALIDATION_ERROR,
        `Cannot update intake for consultation in ${consultation.status} status`,
        400,
        { currentStatus: consultation.status, allowedStatuses: INTAKE_ALLOWED_STATUSES }
      );
    }

    // Upsert patient intake
    const intake = await prisma.patientIntake.upsert({
      where: { consultationId: id },
      create: {
        consultationId: id,
        nameOrAlias: body.nameOrAlias.trim(),
        ageRange: body.ageRange ?? null,
        chiefComplaint: body.chiefComplaint ?? null,
        consentAcceptedAt: new Date(),
      },
      update: {
        nameOrAlias: body.nameOrAlias.trim(),
        ageRange: body.ageRange ?? null,
        chiefComplaint: body.chiefComplaint ?? null,
      },
    });

    return successResponse(intake);
  } catch (error) {
    console.error('Error updating intake:', error);
    return errorResponse(
      ErrorCodes.INTERNAL_ERROR,
      'Failed to update intake',
      500
    );
  }
}
