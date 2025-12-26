/**
 * Tests for POST /api/v1/consultations Validation
 */

import { NextRequest } from 'next/server';
import { createMockUser, createMockDoctor, resetFactories, UserRole, ConsultationStatus } from '../../helpers/factories';
import { createMockSession } from '../../helpers/auth-mock';
import { prismaMock, resetPrismaMock, setupPrismaMock } from '../../helpers/prisma-mock';
import { ErrorCodes } from '@/lib/api-utils';

// Mock auth module
const mockGetSession = jest.fn();
jest.mock('@/lib/auth', () => ({
  auth: {
    api: {
      getSession: (...args: unknown[]) => mockGetSession(...args),
    },
  },
}));

// Import route handler after mocks are set up
import { POST } from '@/app/api/v1/consultations/route';

describe('POST /api/v1/consultations Validation', () => {
  beforeEach(() => {
    resetFactories();
    resetPrismaMock();
    setupPrismaMock();
    mockGetSession.mockReset();
  });

  function createPostRequest(body: unknown): NextRequest {
    return new NextRequest('http://localhost:3000/api/v1/consultations', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  const validIntake = {
    nameOrAlias: 'John Doe',
    ageRange: '18-39',
    chiefComplaint: 'Feeling sick',
    consentAccepted: true,
  };

  const validBody = {
    specialty: 'GENERAL',
    scheduledStartAt: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
    intake: validIntake,
  };

  describe('Intake Validation', () => {
    beforeEach(() => {
      const patient = createMockUser();
      mockGetSession.mockResolvedValue(createMockSession(patient));
    });

    it('should fail if intake is missing', async () => {
      const body = { ...validBody, intake: undefined };
      const request = createPostRequest(body);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.code).toBe(ErrorCodes.VALIDATION_ERROR);
      expect(data.error.details?.field).toBe('intake');
    });

    it('should fail if nameOrAlias is missing or empty', async () => {
      const body = { ...validBody, intake: { ...validIntake, nameOrAlias: '' } };
      const request = createPostRequest(body);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.details?.field).toBe('intake.nameOrAlias');
    });

    it('should fail if consentAccepted is false', async () => {
      const body = { ...validBody, intake: { ...validIntake, consentAccepted: false } };
      const request = createPostRequest(body);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.details?.field).toBe('intake.consent');
    });

    it('should fail if ageRange is invalid', async () => {
      const body = { ...validBody, intake: { ...validIntake, ageRange: 'INVALID_RANGE' } };
      const request = createPostRequest(body);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.details?.field).toBe('intake.ageRange');
    });
  });

  describe('Doctor Validation', () => {
    beforeEach(() => {
      const patient = createMockUser();
      mockGetSession.mockResolvedValue(createMockSession(patient));
    });

    it('should fail if doctorId does not refer to a doctor', async () => {
      const notADoctor = createMockUser({ id: 'user_not_doctor', role: UserRole.PATIENT });
      prismaMock.user.findUnique.mockResolvedValue(notADoctor as any);

      const body = { ...validBody, doctorId: 'user_not_doctor' };
      const request = createPostRequest(body);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.message).toContain('Doctor not found or invalid');
    });

    it('should fail if doctor does not support the specialty', async () => {
      const doctor = createMockDoctor({
        id: 'doctor_cardio',
        doctorProfile: { specialties: ['CARDIOLOGY'] }
      });
      // Important to return doctor with include: { doctorProfile: true } behavior
      prismaMock.user.findUnique.mockResolvedValue(doctor as any);

      const body = { ...validBody, doctorId: 'doctor_cardio', specialty: 'DERMATOLOGY' };
      const request = createPostRequest(body);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.details?.error).toBe('SPECIALTY_MISMATCH');
    });

    it('should succeed if doctor supports the specialty', async () => {
      const doctor = createMockDoctor({
        id: 'doctor_gp',
        doctorProfile: { specialties: ['GENERAL'] }
      });
      prismaMock.user.findUnique.mockResolvedValue(doctor as any);

      // Setup transaction mock return
      const consultation = { id: 'consult_1', specialty: 'GENERAL' };
      prismaMock.$transaction.mockResolvedValue(consultation);

      const body = { ...validBody, doctorId: 'doctor_gp', specialty: 'GENERAL' };
      const request = createPostRequest(body);
      const response = await POST(request);

      if (response.status !== 201) {
        console.log("Failed Response:", await response.json());
      }
      expect(response.status).toBe(201);
    });
  });
});
