/**
 * Tests for POST /api/v1/consultations/:id/intake
 * 
 * TDD: These tests verify the patient intake submission endpoint.
 */

import { NextRequest } from 'next/server';
import { createMockUser, createMockConsultation, createMockPatientIntake, resetFactories, ConsultationStatus } from '../../helpers/factories';
import { createMockSession } from '../../helpers/auth-mock';
import { prismaMock, resetPrismaMock, setupPrismaMock } from '../../helpers/prisma-mock';

// Mock auth module
const mockGetSession = jest.fn();
jest.mock('@/auth', () => ({
  auth: {
    api: {
      getSession: (...args: unknown[]) => mockGetSession(...args),
    },
  },
}));

// Import route handler after mocks are set up
import { POST, PUT } from '@/app/api/v1/consultations/[id]/intake/route';

describe('POST /api/v1/consultations/:id/intake', () => {
  beforeEach(() => {
    resetFactories();
    resetPrismaMock();
    setupPrismaMock();
    mockGetSession.mockReset();
  });

  /**
   * Helper to create a mock request
   */
  function createRequest(id: string, body: object): NextRequest {
    return new NextRequest(`http://localhost:3000/api/v1/consultations/${id}/intake`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
  }

  /**
   * Helper to create route params
   */
  function createParams(id: string) {
    return { params: Promise.resolve({ id }) };
  }

  describe('Authentication', () => {
    it('should return 401 when not authenticated', async () => {
      mockGetSession.mockResolvedValue(null);

      const request = createRequest('consult_1', {
        nameOrAlias: 'John Doe',
        consentAccepted: true,
      });
      const response = await POST(request, createParams('consult_1'));

      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('Authorization', () => {
    it('should only allow consultation owner to submit intake', async () => {
      const patient = createMockUser({ id: 'patient_1' });
      const session = createMockSession(patient);
      mockGetSession.mockResolvedValue(session);

      const consultation = createMockConsultation({ patientId: patient.id });
      prismaMock.consultation.findUnique.mockResolvedValue({
        ...consultation,
        patientIntake: null,
      } as any);

      const intake = createMockPatientIntake(consultation.id);
      prismaMock.patientIntake.create.mockResolvedValue(intake as any);

      const request = createRequest(consultation.id, {
        nameOrAlias: 'John Doe',
        ageRange: '18-39',
        chiefComplaint: 'Headache',
        consentAccepted: true,
      });
      const response = await POST(request, createParams(consultation.id));

      expect(response.status).toBe(201);
    });

    it('should return 403 when non-owner tries to submit intake', async () => {
      const otherUser = createMockUser({ id: 'other_user' });
      const session = createMockSession(otherUser);
      mockGetSession.mockResolvedValue(session);

      const consultation = createMockConsultation({ patientId: 'patient_1' });
      prismaMock.consultation.findUnique.mockResolvedValue({
        ...consultation,
        patientIntake: null,
      } as any);

      const request = createRequest(consultation.id, {
        nameOrAlias: 'John Doe',
        consentAccepted: true,
      });
      const response = await POST(request, createParams(consultation.id));

      expect(response.status).toBe(403);
      const body = await response.json();
      expect(body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('Validation', () => {
    it('should require nameOrAlias', async () => {
      const patient = createMockUser();
      const session = createMockSession(patient);
      mockGetSession.mockResolvedValue(session);

      const request = createRequest('consult_1', {
        ageRange: '18-39',
        chiefComplaint: 'Headache',
        consentAccepted: true,
      });
      const response = await POST(request, createParams('consult_1'));

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should require consent acceptance', async () => {
      const patient = createMockUser();
      const session = createMockSession(patient);
      mockGetSession.mockResolvedValue(session);

      const request = createRequest('consult_1', {
        nameOrAlias: 'John Doe',
        ageRange: '18-39',
        chiefComplaint: 'Headache',
        consentAccepted: false,
      });
      const response = await POST(request, createParams('consult_1'));

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should validate ageRange format', async () => {
      const patient = createMockUser();
      const session = createMockSession(patient);
      mockGetSession.mockResolvedValue(session);

      const consultation = createMockConsultation({ patientId: patient.id });
      prismaMock.consultation.findUnique.mockResolvedValue({
        ...consultation,
        patientIntake: null,
      } as any);

      const request = createRequest(consultation.id, {
        nameOrAlias: 'John Doe',
        ageRange: 'invalid',
        consentAccepted: true,
      });
      const response = await POST(request, createParams(consultation.id));

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should accept valid intake data', async () => {
      const patient = createMockUser();
      const session = createMockSession(patient);
      mockGetSession.mockResolvedValue(session);

      const consultation = createMockConsultation({ patientId: patient.id });
      prismaMock.consultation.findUnique.mockResolvedValue({
        ...consultation,
        patientIntake: null,
      } as any);

      const intake = createMockPatientIntake(consultation.id);
      prismaMock.patientIntake.create.mockResolvedValue(intake as any);

      const request = createRequest(consultation.id, {
        nameOrAlias: 'John Doe',
        ageRange: '18-39',
        chiefComplaint: 'Recurring headaches for 2 weeks',
        consentAccepted: true,
      });
      const response = await POST(request, createParams(consultation.id));

      expect(response.status).toBe(201);
    });
  });

  describe('Intake Creation', () => {
    it('should create patient intake record', async () => {
      const patient = createMockUser();
      const session = createMockSession(patient);
      mockGetSession.mockResolvedValue(session);

      const consultation = createMockConsultation({ patientId: patient.id });
      prismaMock.consultation.findUnique.mockResolvedValue({
        ...consultation,
        patientIntake: null,
      } as any);

      const intake = createMockPatientIntake(consultation.id);
      prismaMock.patientIntake.create.mockResolvedValue(intake as any);

      const request = createRequest(consultation.id, {
        nameOrAlias: 'John Doe',
        ageRange: '18-39',
        chiefComplaint: 'Headache',
        consentAccepted: true,
      });
      const response = await POST(request, createParams(consultation.id));

      expect(response.status).toBe(201);
      const body = await response.json();
      expect(body.consultationId).toBe(consultation.id);
    });

    it('should set consentAcceptedAt timestamp', async () => {
      const patient = createMockUser();
      const session = createMockSession(patient);
      mockGetSession.mockResolvedValue(session);

      const consultation = createMockConsultation({ patientId: patient.id });
      prismaMock.consultation.findUnique.mockResolvedValue({
        ...consultation,
        patientIntake: null,
      } as any);

      const intake = createMockPatientIntake(consultation.id);
      prismaMock.patientIntake.create.mockResolvedValue(intake as any);

      const request = createRequest(consultation.id, {
        nameOrAlias: 'John Doe',
        consentAccepted: true,
      });
      const response = await POST(request, createParams(consultation.id));

      expect(response.status).toBe(201);
      const body = await response.json();
      expect(body.consentAcceptedAt).toBeDefined();
    });
  });

  describe('Duplicate Prevention', () => {
    it('should return 409 if intake already exists', async () => {
      const patient = createMockUser();
      const session = createMockSession(patient);
      mockGetSession.mockResolvedValue(session);

      const consultation = createMockConsultation({ patientId: patient.id });
      const existingIntake = createMockPatientIntake(consultation.id);

      prismaMock.consultation.findUnique.mockResolvedValue({
        ...consultation,
        patientIntake: existingIntake,
      } as any);

      const request = createRequest(consultation.id, {
        nameOrAlias: 'John Doe',
        consentAccepted: true,
      });
      const response = await POST(request, createParams(consultation.id));

      expect(response.status).toBe(409);
      const body = await response.json();
      expect(body.error.code).toBe('CONFLICT');
    });

    it('should allow updating existing intake (PUT semantics)', async () => {
      const patient = createMockUser();
      const session = createMockSession(patient);
      mockGetSession.mockResolvedValue(session);

      const consultation = createMockConsultation({ patientId: patient.id });
      const existingIntake = createMockPatientIntake(consultation.id);

      prismaMock.consultation.findUnique.mockResolvedValue(consultation as any);
      prismaMock.patientIntake.upsert.mockResolvedValue({
        ...existingIntake,
        chiefComplaint: 'Updated complaint',
      } as any);

      // Create a PUT request
      const request = new NextRequest(
        `http://localhost:3000/api/v1/consultations/${consultation.id}/intake`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nameOrAlias: 'John Doe',
            chiefComplaint: 'Updated complaint',
            consentAccepted: true,
          }),
        }
      );
      const response = await PUT(request, createParams(consultation.id));

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.chiefComplaint).toBe('Updated complaint');
    });
  });

  describe('Consultation Status', () => {
    it('should only allow intake for CREATED or PAYMENT_PENDING consultations', async () => {
      const patient = createMockUser();
      const session = createMockSession(patient);
      mockGetSession.mockResolvedValue(session);

      const validStatuses = [ConsultationStatus.CREATED, ConsultationStatus.PAYMENT_PENDING];

      for (const status of validStatuses) {
        const consultation = createMockConsultation({ patientId: patient.id, status });
        prismaMock.consultation.findUnique.mockResolvedValue({
          ...consultation,
          patientIntake: null,
        } as any);

        const intake = createMockPatientIntake(consultation.id);
        prismaMock.patientIntake.create.mockResolvedValue(intake as any);

        const request = createRequest(consultation.id, {
          nameOrAlias: 'John Doe',
          consentAccepted: true,
        });
        const response = await POST(request, createParams(consultation.id));

        expect(response.status).toBe(201);
      }
    });

    it('should reject intake for completed consultations', async () => {
      const patient = createMockUser();
      const session = createMockSession(patient);
      mockGetSession.mockResolvedValue(session);

      const consultation = createMockConsultation({
        patientId: patient.id,
        status: ConsultationStatus.COMPLETED,
      });

      prismaMock.consultation.findUnique.mockResolvedValue({
        ...consultation,
        patientIntake: null,
      } as any);

      const request = createRequest(consultation.id, {
        nameOrAlias: 'John Doe',
        consentAccepted: true,
      });
      const response = await POST(request, createParams(consultation.id));

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('Not Found', () => {
    it('should return 404 when consultation does not exist', async () => {
      const patient = createMockUser();
      const session = createMockSession(patient);
      mockGetSession.mockResolvedValue(session);

      prismaMock.consultation.findUnique.mockResolvedValue(null);

      const request = createRequest('non_existent', {
        nameOrAlias: 'John Doe',
        consentAccepted: true,
      });
      const response = await POST(request, createParams('non_existent'));

      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body.error.code).toBe('NOT_FOUND');
    });
  });
});
