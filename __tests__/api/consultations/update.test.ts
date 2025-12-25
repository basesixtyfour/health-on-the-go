/**
 * Tests for PATCH /api/v1/consultations/:id
 * 
 * TDD: These tests verify the consultation update endpoint.
 */

import { NextRequest } from 'next/server';
import { createMockUser, createMockDoctor, createMockAdmin, createMockConsultation, resetFactories, UserRole, ConsultationStatus } from '../../helpers/factories';
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
import { PATCH } from '@/app/api/v1/consultations/[id]/route';

describe('PATCH /api/v1/consultations/:id', () => {
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
    return new NextRequest(`http://localhost:3000/api/v1/consultations/${id}`, {
      method: 'PATCH',
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

      const request = createRequest('consult_1', { status: 'IN_CALL' });
      const response = await PATCH(request, createParams('consult_1'));

      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('Authorization', () => {
    it('should return 403 when patient tries to update status', async () => {
      const patient = createMockUser({ role: UserRole.PATIENT });
      const session = createMockSession(patient);
      mockGetSession.mockResolvedValue(session);

      const consultation = createMockConsultation({ patientId: patient.id });
      prismaMock.consultation.findUnique.mockResolvedValue(consultation as any);

      const request = createRequest(consultation.id, { status: 'IN_CALL' });
      const response = await PATCH(request, createParams(consultation.id));

      expect(response.status).toBe(403);
      const body = await response.json();
      expect(body.error.code).toBe('FORBIDDEN');
    });

    it('should allow doctor to update consultation status', async () => {
      const doctor = createMockDoctor({ id: 'doctor_1' });
      const session = createMockSession(doctor);
      mockGetSession.mockResolvedValue(session);

      const consultation = createMockConsultation({
        doctorId: doctor.id,
        status: ConsultationStatus.PAID,
      });

      prismaMock.consultation.findUnique.mockResolvedValue(consultation as any);
      prismaMock.consultation.update.mockResolvedValue({
        ...consultation,
        status: ConsultationStatus.IN_CALL,
      } as any);
      prismaMock.auditEvent.create.mockResolvedValue({} as any);

      const request = createRequest(consultation.id, { status: 'IN_CALL' });
      const response = await PATCH(request, createParams(consultation.id));

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.status).toBe(ConsultationStatus.IN_CALL);
    });

    it('should allow admin to update any consultation', async () => {
      const admin = createMockAdmin();
      const session = createMockSession(admin);
      mockGetSession.mockResolvedValue(session);

      const consultation = createMockConsultation({
        status: ConsultationStatus.PAID,
      });

      prismaMock.consultation.findUnique.mockResolvedValue(consultation as any);
      prismaMock.consultation.update.mockResolvedValue({
        ...consultation,
        status: ConsultationStatus.CANCELLED,
      } as any);
      prismaMock.auditEvent.create.mockResolvedValue({} as any);

      const request = createRequest(consultation.id, { status: 'CANCELLED' });
      const response = await PATCH(request, createParams(consultation.id));

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.status).toBe(ConsultationStatus.CANCELLED);
    });
  });

  describe('Status Transitions', () => {
    const validTransitions: [ConsultationStatus, ConsultationStatus][] = [
      [ConsultationStatus.CREATED, ConsultationStatus.PAYMENT_PENDING],
      [ConsultationStatus.PAYMENT_PENDING, ConsultationStatus.PAID],
      [ConsultationStatus.PAYMENT_PENDING, ConsultationStatus.PAYMENT_FAILED],
      [ConsultationStatus.PAID, ConsultationStatus.IN_CALL],
      [ConsultationStatus.IN_CALL, ConsultationStatus.COMPLETED],
      [ConsultationStatus.CREATED, ConsultationStatus.CANCELLED],
      [ConsultationStatus.PAYMENT_PENDING, ConsultationStatus.CANCELLED],
      [ConsultationStatus.PAID, ConsultationStatus.CANCELLED],
    ];

    it.each(validTransitions)(
      'should allow transition from %s to %s',
      async (from, to) => {
        const doctor = createMockDoctor({ id: 'doctor_1' });
        const session = createMockSession(doctor);
        mockGetSession.mockResolvedValue(session);

        const consultation = createMockConsultation({
          doctorId: doctor.id,
          status: from,
        });

        prismaMock.consultation.findUnique.mockResolvedValue(consultation as any);
        prismaMock.consultation.update.mockResolvedValue({
          ...consultation,
          status: to,
        } as any);
        prismaMock.auditEvent.create.mockResolvedValue({} as any);

        const request = createRequest(consultation.id, { status: to });
        const response = await PATCH(request, createParams(consultation.id));

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.status).toBe(to);
      }
    );

    const invalidTransitions: [ConsultationStatus, ConsultationStatus][] = [
      [ConsultationStatus.COMPLETED, ConsultationStatus.CREATED],
      [ConsultationStatus.CANCELLED, ConsultationStatus.PAID],
      [ConsultationStatus.EXPIRED, ConsultationStatus.IN_CALL],
    ];

    it.each(invalidTransitions)(
      'should reject transition from %s to %s',
      async (from, to) => {
        const doctor = createMockDoctor({ id: 'doctor_1' });
        const session = createMockSession(doctor);
        mockGetSession.mockResolvedValue(session);

        const consultation = createMockConsultation({
          doctorId: doctor.id,
          status: from,
        });

        prismaMock.consultation.findUnique.mockResolvedValue(consultation as any);

        const request = createRequest(consultation.id, { status: to });
        const response = await PATCH(request, createParams(consultation.id));

        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.error.code).toBe('INVALID_STATUS_TRANSITION');
      }
    );
  });

  describe('Audit Logging', () => {
    it('should create audit event on status change', async () => {
      const doctor = createMockDoctor();
      const session = createMockSession(doctor);
      mockGetSession.mockResolvedValue(session);

      const consultation = createMockConsultation({
        doctorId: doctor.id,
        status: ConsultationStatus.PAID,
      });

      prismaMock.consultation.findUnique.mockResolvedValue(consultation as any);
      prismaMock.consultation.update.mockResolvedValue({
        ...consultation,
        status: ConsultationStatus.IN_CALL,
      } as any);
      prismaMock.auditEvent.create.mockResolvedValue({} as any);

      const request = createRequest(consultation.id, { status: 'IN_CALL' });
      await PATCH(request, createParams(consultation.id));

      expect(prismaMock.auditEvent.create).toHaveBeenCalled();
    });
  });

  describe('Not Found', () => {
    it('should return 404 when consultation does not exist', async () => {
      const doctor = createMockDoctor();
      const session = createMockSession(doctor);
      mockGetSession.mockResolvedValue(session);

      prismaMock.consultation.findUnique.mockResolvedValue(null);

      const request = createRequest('non_existent', { status: 'IN_CALL' });
      const response = await PATCH(request, createParams('non_existent'));

      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('Concurrency', () => {
    it('should handle concurrent updates with optimistic locking', async () => {
      const doctor = createMockDoctor();
      const session = createMockSession(doctor);
      mockGetSession.mockResolvedValue(session);

      const serverUpdatedAt = new Date('2025-01-01');
      const consultation = createMockConsultation({
        doctorId: doctor.id,
        status: ConsultationStatus.PAID,
        updatedAt: serverUpdatedAt,
      });

      prismaMock.consultation.findUnique.mockResolvedValue(consultation as any);

      // Simulate stale update attempt
      const staleUpdatedAt = new Date('2024-12-01').toISOString();

      const request = createRequest(consultation.id, {
        status: 'IN_CALL',
        updatedAt: staleUpdatedAt,
      });
      const response = await PATCH(request, createParams(consultation.id));

      expect(response.status).toBe(409);
      const body = await response.json();
      expect(body.error.code).toBe('CONFLICT');
    });
  });
});
