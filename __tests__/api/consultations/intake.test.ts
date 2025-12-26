/**
 * Tests for POST/PUT /api/v1/consultations/[id]/intake
 */

import { NextRequest } from 'next/server';
import { createMockUser, createMockConsultation, resetFactories, ConsultationStatus, VALID_SPECIALTIES } from '../../helpers/factories';
import { createMockSession } from '../../helpers/auth-mock';
import { prismaMock, resetPrismaMock, setupPrismaMock } from '../../helpers/prisma-mock';

// Mock auth
const mockGetSession = jest.fn();
jest.mock('@/lib/auth', () => ({
  auth: {
    api: {
      getSession: (...args: unknown[]) => mockGetSession(...args),
    },
  },
}));

// Mock generated Prisma client
jest.mock('@/app/generated/prisma/client', () => ({
  ConsultationStatus: {
    CREATED: 'CREATED',
    PAYMENT_PENDING: 'PAYMENT_PENDING',
    PAID: 'PAID',
    IN_CALL: 'IN_CALL',
    COMPLETED: 'COMPLETED',
    CANCELLED: 'CANCELLED',
    EXPIRED: 'EXPIRED',
    PAYMENT_FAILED: 'PAYMENT_FAILED',
  }
}));

import { POST, PUT } from '@/app/api/v1/consultations/[id]/intake/route';

describe('/api/v1/consultations/[id]/intake', () => {
  beforeEach(() => {
    resetFactories();
    resetPrismaMock();
    setupPrismaMock();
    mockGetSession.mockReset();
  });

  function createRequest(method: 'POST' | 'PUT', body: object): NextRequest {
    return new NextRequest('http://localhost:3000/api/v1/consultations/123/intake', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  describe('POST (Create Intake)', () => {
    it('should return 401 if not authenticated', async () => {
      mockGetSession.mockResolvedValue(null);
      const req = createRequest('POST', {});
      const res = await POST(req, { params: Promise.resolve({ id: '123' }) });
      expect(res.status).toBe(401);
    });

    it('should validate required fields', async () => {
      const patient = createMockUser();
      mockGetSession.mockResolvedValue(createMockSession(patient));

      const req = createRequest('POST', { nameOrAlias: '' }); // Missing consent
      const res = await POST(req, { params: Promise.resolve({ id: '123' }) });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 404 if consultation missing', async () => {
      const patient = createMockUser();
      mockGetSession.mockResolvedValue(createMockSession(patient));
      prismaMock.consultation.findUnique.mockResolvedValue(null);

      const req = createRequest('POST', { nameOrAlias: 'John', consentAccepted: true });
      const res = await POST(req, { params: Promise.resolve({ id: '123' }) });

      expect(res.status).toBe(404);
    });

    it('should return 403 if user is not the patient', async () => {
      const patient = createMockUser({ id: 'p1' });
      const other = createMockUser({ id: 'p2' });
      mockGetSession.mockResolvedValue(createMockSession(other));

      const consultation = createMockConsultation({ patientId: patient.id });
      prismaMock.consultation.findUnique.mockResolvedValue(consultation as any);

      const req = createRequest('POST', { nameOrAlias: 'John', consentAccepted: true });
      const res = await POST(req, { params: Promise.resolve({ id: consultation.id }) });

      expect(res.status).toBe(403);
    });

    it('should return 400 if consultation status is invalid', async () => {
      const patient = createMockUser();
      mockGetSession.mockResolvedValue(createMockSession(patient));

      // COMPLETED status not allowed for intake
      const consultation = createMockConsultation({
        patientId: patient.id,
        status: ConsultationStatus.COMPLETED
      });
      prismaMock.consultation.findUnique.mockResolvedValue(consultation as any);

      const req = createRequest('POST', { nameOrAlias: 'John', consentAccepted: true });
      const res = await POST(req, { params: Promise.resolve({ id: consultation.id }) });

      expect(res.status).toBe(400);
    });

    it('should create intake successfully', async () => {
      const patient = createMockUser();
      mockGetSession.mockResolvedValue(createMockSession(patient));

      const consultation = createMockConsultation({
        patientId: patient.id,
        status: ConsultationStatus.CREATED,
        patientIntake: null
      });
      prismaMock.consultation.findUnique.mockResolvedValue(consultation as any);

      prismaMock.patientIntake.create.mockResolvedValue({
        id: 'intake-1',
        nameOrAlias: 'Johnny'
      } as any);

      const req = createRequest('POST', {
        nameOrAlias: 'Johnny',
        consentAccepted: true,
        chiefComplaint: 'Headache'
      });
      const res = await POST(req, { params: Promise.resolve({ id: consultation.id }) });

      expect(res.status).toBe(201);
      expect(prismaMock.patientIntake.create).toHaveBeenCalled();
    });
  });

  describe('PUT (Update Intake)', () => {
    it('should update intake successfully via upsert', async () => {
      const patient = createMockUser();
      mockGetSession.mockResolvedValue(createMockSession(patient));

      const consultation = createMockConsultation({
        patientId: patient.id,
        status: ConsultationStatus.CREATED,
      });
      prismaMock.consultation.findUnique.mockResolvedValue(consultation as any);

      prismaMock.patientIntake.upsert.mockResolvedValue({
        id: 'intake-1',
        nameOrAlias: 'Johnny Updated'
      } as any);

      const req = createRequest('PUT', {
        nameOrAlias: 'Johnny Updated',
        consentAccepted: true
      });
      const res = await PUT(req, { params: Promise.resolve({ id: consultation.id }) });

      expect(res.status).toBe(200); // or 201 depending on impl, but usually 200 for update return
      expect(prismaMock.patientIntake.upsert).toHaveBeenCalled();
    });
  });
});
