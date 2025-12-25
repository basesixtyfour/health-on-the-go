/**
 * Tests for GET /api/v1/consultations
 * 
 * TDD: These tests verify the consultation list endpoint.
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
import { GET } from '@/app/api/v1/consultations/route';

describe('GET /api/v1/consultations', () => {
  beforeEach(() => {
    resetFactories();
    resetPrismaMock();
    setupPrismaMock();
    mockGetSession.mockReset();
  });

  /**
   * Helper to create a mock request
   */
  function createRequest(queryParams: Record<string, string> = {}): NextRequest {
    const url = new URL('http://localhost:3000/api/v1/consultations');
    Object.entries(queryParams).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });
    return new NextRequest(url, { method: 'GET' });
  }

  describe('Authentication', () => {
    it('should return 401 when not authenticated', async () => {
      mockGetSession.mockResolvedValue(null);

      const request = createRequest();
      const response = await GET(request);

      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('Patient Access', () => {
    it('should return only consultations belonging to the patient', async () => {
      // Arrange
      const patient = createMockUser({ id: 'patient_1' });
      const session = createMockSession(patient);
      mockGetSession.mockResolvedValue(session);

      const ownConsultation = createMockConsultation({ patientId: patient.id });

      prismaMock.consultation.findMany.mockResolvedValue([ownConsultation as any]);
      prismaMock.consultation.count.mockResolvedValue(1);

      const request = createRequest();
      const response = await GET(request);

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.data).toHaveLength(1);
      expect(body.data[0].patientId).toBe(patient.id);
    });

    it('should return empty array when patient has no consultations', async () => {
      const patient = createMockUser();
      const session = createMockSession(patient);
      mockGetSession.mockResolvedValue(session);

      prismaMock.consultation.findMany.mockResolvedValue([]);
      prismaMock.consultation.count.mockResolvedValue(0);

      const request = createRequest();
      const response = await GET(request);

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.data).toEqual([]);
    });
  });

  describe('Doctor Access', () => {
    it('should return consultations assigned to the doctor', async () => {
      const doctor = createMockDoctor({ id: 'doctor_1' });
      const session = createMockSession(doctor);
      mockGetSession.mockResolvedValue(session);

      const assignedConsultation = createMockConsultation({
        doctorId: doctor.id,
        status: ConsultationStatus.PAID,
      });

      prismaMock.consultation.findMany.mockResolvedValue([assignedConsultation as any]);
      prismaMock.consultation.count.mockResolvedValue(1);

      const request = createRequest();
      const response = await GET(request);

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.data).toHaveLength(1);
      expect(body.data[0].doctorId).toBe(doctor.id);
    });
  });

  describe('Admin Access', () => {
    it('should return all consultations for admin', async () => {
      const admin = createMockAdmin();
      const session = createMockSession(admin);
      mockGetSession.mockResolvedValue(session);

      const consultations = [
        createMockConsultation({ patientId: 'patient_1' }),
        createMockConsultation({ patientId: 'patient_2' }),
        createMockConsultation({ patientId: 'patient_3' }),
      ];

      prismaMock.consultation.findMany.mockResolvedValue(consultations as any);
      prismaMock.consultation.count.mockResolvedValue(3);

      const request = createRequest();
      const response = await GET(request);

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.data).toHaveLength(3);
    });
  });

  describe('Filtering', () => {
    it('should filter by status', async () => {
      const patient = createMockUser();
      const session = createMockSession(patient);
      mockGetSession.mockResolvedValue(session);

      const paidConsultations = [
        createMockConsultation({ patientId: patient.id, status: ConsultationStatus.PAID }),
      ];

      prismaMock.consultation.findMany.mockResolvedValue(paidConsultations as any);
      prismaMock.consultation.count.mockResolvedValue(1);

      const request = createRequest({ status: 'PAID' });
      const response = await GET(request);

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.data[0].status).toBe(ConsultationStatus.PAID);
    });

    it('should filter by specialty', async () => {
      const patient = createMockUser();
      const session = createMockSession(patient);
      mockGetSession.mockResolvedValue(session);

      const cardiologyConsultations = [
        createMockConsultation({ patientId: patient.id, specialty: 'CARDIOLOGY' }),
      ];

      prismaMock.consultation.findMany.mockResolvedValue(cardiologyConsultations as any);
      prismaMock.consultation.count.mockResolvedValue(1);

      const request = createRequest({ specialty: 'CARDIOLOGY' });
      const response = await GET(request);

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.data[0].specialty).toBe('CARDIOLOGY');
    });
  });

  describe('Pagination', () => {
    it('should support limit parameter', async () => {
      const patient = createMockUser();
      const session = createMockSession(patient);
      mockGetSession.mockResolvedValue(session);

      const limit = 10;
      const consultations = Array.from({ length: limit }, () =>
        createMockConsultation({ patientId: patient.id })
      );

      prismaMock.consultation.findMany.mockResolvedValue(consultations as any);
      prismaMock.consultation.count.mockResolvedValue(25);

      const request = createRequest({ limit: '10' });
      const response = await GET(request);

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.data).toHaveLength(limit);
      expect(body.pagination.limit).toBe(limit);
    });

    it('should support offset parameter', async () => {
      const patient = createMockUser();
      const session = createMockSession(patient);
      mockGetSession.mockResolvedValue(session);

      prismaMock.consultation.findMany.mockResolvedValue([]);
      prismaMock.consultation.count.mockResolvedValue(25);

      const request = createRequest({ offset: '10' });
      const response = await GET(request);

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.pagination.offset).toBe(10);
    });

    it('should return total count for pagination metadata', async () => {
      const patient = createMockUser();
      const session = createMockSession(patient);
      mockGetSession.mockResolvedValue(session);

      prismaMock.consultation.findMany.mockResolvedValue([]);
      prismaMock.consultation.count.mockResolvedValue(25);

      const request = createRequest();
      const response = await GET(request);

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.pagination.total).toBe(25);
    });
  });

  describe('Sorting', () => {
    it('should sort by createdAt descending by default', async () => {
      const patient = createMockUser();
      const session = createMockSession(patient);
      mockGetSession.mockResolvedValue(session);

      const now = new Date();
      const consultations = [
        createMockConsultation({ patientId: patient.id, createdAt: now }),
        createMockConsultation({ patientId: patient.id, createdAt: new Date(now.getTime() - 1000) }),
      ];

      prismaMock.consultation.findMany.mockResolvedValue(consultations as any);
      prismaMock.consultation.count.mockResolvedValue(2);

      const request = createRequest();
      const response = await GET(request);

      expect(response.status).toBe(200);
      // Verify findMany was called with correct orderBy
      expect(prismaMock.consultation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: 'desc' },
        })
      );
    });
  });
});
