/**
 * Tests for POST /api/v1/consultations
 * 
 * TDD: These tests verify the consultation creation endpoint.
 */

import { NextRequest } from 'next/server';
import { createMockUser, createMockConsultation, resetFactories, VALID_SPECIALTIES, UserRole, ConsultationStatus } from '../../helpers/factories';
import { createMockSession } from '../../helpers/auth-mock';
import { prismaMock, resetPrismaMock, setupPrismaMock } from '../../helpers/prisma-mock';

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

describe('POST /api/v1/consultations', () => {
  beforeEach(() => {
    resetFactories();
    resetPrismaMock();
    setupPrismaMock();
    mockGetSession.mockReset();
  });

  /**
   * Helper to create a mock request
   */
  function createRequest(body: object): NextRequest {
    return new NextRequest('http://localhost:3000/api/v1/consultations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
  }

  describe('Authentication', () => {
    it('should return 401 when not authenticated', async () => {
      // Arrange: No session
      mockGetSession.mockResolvedValue(null);

      const request = createRequest({ specialty: 'CARDIOLOGY' });
      const response = await POST(request);

      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.error.code).toBe('UNAUTHORIZED');
    });

    it('should allow authenticated patient to create consultation', async () => {
      // Arrange
      const patient = createMockUser({ role: UserRole.PATIENT });
      const session = createMockSession(patient);
      mockGetSession.mockResolvedValue(session);

      const expectedConsultation = createMockConsultation({
        patientId: patient.id,
        specialty: 'CARDIOLOGY',
        status: ConsultationStatus.CREATED,
      });

      prismaMock.consultation.create.mockResolvedValue(expectedConsultation as any);
      prismaMock.auditEvent.create.mockResolvedValue({} as any);

      const request = createRequest({ specialty: 'CARDIOLOGY' });
      const response = await POST(request);

      expect(response.status).toBe(201);
      const body = await response.json();
      expect(body.specialty).toBe('CARDIOLOGY');
      expect(body.status).toBe(ConsultationStatus.CREATED);
    });
  });

  describe('Validation', () => {
    it('should return 400 when specialty is missing', async () => {
      // Arrange
      const patient = createMockUser();
      const session = createMockSession(patient);
      mockGetSession.mockResolvedValue(session);

      const request = createRequest({});
      const response = await POST(request);

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 when specialty is invalid', async () => {
      // Arrange
      const patient = createMockUser();
      const session = createMockSession(patient);
      mockGetSession.mockResolvedValue(session);

      const request = createRequest({ specialty: 'INVALID_SPECIALTY' });
      const response = await POST(request);

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should accept valid specialties', async () => {
      const patient = createMockUser();
      const session = createMockSession(patient);
      mockGetSession.mockResolvedValue(session);

      for (const specialty of VALID_SPECIALTIES) {
        const expectedConsultation = createMockConsultation({
          patientId: patient.id,
          specialty,
        });
        prismaMock.consultation.create.mockResolvedValue(expectedConsultation as any);
        prismaMock.auditEvent.create.mockResolvedValue({} as any);

        const request = createRequest({ specialty });
        const response = await POST(request);

        expect(response.status).toBe(201);
      }
    });

    it('should accept optional scheduledStartAt as valid ISO date', async () => {
      const patient = createMockUser();
      const session = createMockSession(patient);
      mockGetSession.mockResolvedValue(session);

      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const expectedConsultation = createMockConsultation({
        patientId: patient.id,
        specialty: 'CARDIOLOGY',
        scheduledStartAt: new Date(futureDate),
      });
      prismaMock.consultation.create.mockResolvedValue(expectedConsultation as any);
      prismaMock.auditEvent.create.mockResolvedValue({} as any);

      const request = createRequest({
        specialty: 'CARDIOLOGY',
        scheduledStartAt: futureDate,
      });
      const response = await POST(request);

      expect(response.status).toBe(201);
    });
  });

  describe('Consultation Creation', () => {
    it('should create consultation with CREATED status', async () => {
      // Arrange
      const patient = createMockUser();
      const session = createMockSession(patient);
      mockGetSession.mockResolvedValue(session);

      const expectedConsultation = createMockConsultation({
        patientId: patient.id,
        specialty: 'CARDIOLOGY',
        status: ConsultationStatus.CREATED,
      });

      prismaMock.consultation.create.mockResolvedValue(expectedConsultation as any);
      prismaMock.auditEvent.create.mockResolvedValue({} as any);

      const request = createRequest({ specialty: 'CARDIOLOGY' });
      const response = await POST(request);

      expect(response.status).toBe(201);
      const body = await response.json();
      expect(body.status).toBe(ConsultationStatus.CREATED);
    });

    it('should associate consultation with authenticated patient', async () => {
      // Arrange
      const patient = createMockUser();
      const session = createMockSession(patient);
      mockGetSession.mockResolvedValue(session);

      const expectedConsultation = createMockConsultation({
        patientId: patient.id,
      });

      prismaMock.consultation.create.mockResolvedValue(expectedConsultation as any);
      prismaMock.auditEvent.create.mockResolvedValue({} as any);

      const request = createRequest({ specialty: 'GENERAL' });
      const response = await POST(request);

      expect(response.status).toBe(201);
      const body = await response.json();
      expect(body.patientId).toBe(patient.id);
    });

    it('should set doctorId to null initially (unassigned)', async () => {
      const patient = createMockUser();
      const session = createMockSession(patient);
      mockGetSession.mockResolvedValue(session);

      const expectedConsultation = createMockConsultation({
        patientId: patient.id,
        doctorId: null,
      });

      prismaMock.consultation.create.mockResolvedValue(expectedConsultation as any);
      prismaMock.auditEvent.create.mockResolvedValue({} as any);

      const request = createRequest({ specialty: 'GENERAL' });
      const response = await POST(request);

      expect(response.status).toBe(201);
      const body = await response.json();
      expect(body.doctorId).toBeNull();
    });
  });

  describe('Audit Logging', () => {
    it('should create audit event on successful creation', async () => {
      // Arrange
      const patient = createMockUser();
      const session = createMockSession(patient);
      mockGetSession.mockResolvedValue(session);

      const consultation = createMockConsultation({ patientId: patient.id });
      prismaMock.consultation.create.mockResolvedValue(consultation as any);
      prismaMock.auditEvent.create.mockResolvedValue({} as any);

      const request = createRequest({ specialty: 'CARDIOLOGY' });
      await POST(request);

      // Verify audit event was created
      expect(prismaMock.auditEvent.create).toHaveBeenCalled();
    });
  });

  describe('Response Format', () => {
    it('should return consultation with expected fields', async () => {
      const patient = createMockUser();
      const session = createMockSession(patient);
      mockGetSession.mockResolvedValue(session);

      const consultation = createMockConsultation({
        patientId: patient.id,
        specialty: 'CARDIOLOGY',
      });
      prismaMock.consultation.create.mockResolvedValue(consultation as any);
      prismaMock.auditEvent.create.mockResolvedValue({} as any);

      const request = createRequest({ specialty: 'CARDIOLOGY' });
      const response = await POST(request);

      const body = await response.json();
      expect(body).toHaveProperty('id');
      expect(body).toHaveProperty('patientId');
      expect(body).toHaveProperty('doctorId');
      expect(body).toHaveProperty('specialty');
      expect(body).toHaveProperty('status');
      expect(body).toHaveProperty('scheduledStartAt');
      expect(body).toHaveProperty('createdAt');
    });
  });
});
