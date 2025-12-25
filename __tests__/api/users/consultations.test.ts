/**
 * Tests for GET /api/v1/users/me/consultations
 * 
 * TDD: These tests verify the user's consultation history endpoint.
 */

import { NextRequest } from 'next/server';
import { createMockUser, createMockDoctor, createMockConsultation, resetFactories, UserRole, ConsultationStatus } from '../../helpers/factories';
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
import { GET } from '@/app/api/v1/users/me/consultations/route';

describe('GET /api/v1/users/me/consultations', () => {
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
    const url = new URL('http://localhost:3000/api/v1/users/me/consultations');
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

  describe('Patient Consultation History', () => {
    it('should return patient consultations', async () => {
      const patient = createMockUser({ id: 'patient_1' });
      const session = createMockSession(patient);
      mockGetSession.mockResolvedValue(session);

      const consultations = [
        createMockConsultation({ patientId: patient.id, status: ConsultationStatus.COMPLETED }),
        createMockConsultation({ patientId: patient.id, status: ConsultationStatus.PAID }),
      ];

      prismaMock.consultation.findMany.mockResolvedValue(consultations as any);
      prismaMock.consultation.count.mockResolvedValue(2);

      const request = createRequest();
      const response = await GET(request);

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.data).toHaveLength(2);
      
      // SECURITY: Verify query is filtered by patientId to prevent unauthorized access
      expect(prismaMock.consultation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            patientId: patient.id,
          }),
        })
      );
      expect(prismaMock.consultation.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            patientId: patient.id,
          }),
        })
      );
    });

    it('should return empty array when patient has no consultations', async () => {
      const patient = createMockUser({ id: 'patient_1' });
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

  describe('Doctor Consultation History', () => {
    it('should return consultations assigned to doctor', async () => {
      const doctor = createMockDoctor({ id: 'doctor_1' });
      const session = createMockSession(doctor);
      mockGetSession.mockResolvedValue(session);

      const consultations = [
        createMockConsultation({ doctorId: doctor.id, status: ConsultationStatus.COMPLETED }),
        createMockConsultation({ doctorId: doctor.id, status: ConsultationStatus.IN_CALL }),
      ];

      prismaMock.consultation.findMany.mockResolvedValue(consultations as any);
      prismaMock.consultation.count.mockResolvedValue(2);

      const request = createRequest();
      const response = await GET(request);

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.data).toHaveLength(2);
      expect(body.data[0].doctorId).toBe(doctor.id);
      
      // SECURITY: Verify query is filtered by doctorId to prevent unauthorized access
      expect(prismaMock.consultation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            doctorId: doctor.id,
          }),
        })
      );
      expect(prismaMock.consultation.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            doctorId: doctor.id,
          }),
        })
      );
    });
  });

  describe('Filtering', () => {
    it('should filter by status', async () => {
      const patient = createMockUser({ id: 'patient_1' });
      const session = createMockSession(patient);
      mockGetSession.mockResolvedValue(session);

      const completedConsultations = [
        createMockConsultation({ patientId: patient.id, status: ConsultationStatus.COMPLETED }),
      ];

      prismaMock.consultation.findMany.mockResolvedValue(completedConsultations as any);
      prismaMock.consultation.count.mockResolvedValue(1);

      const request = createRequest({ status: 'COMPLETED' });
      const response = await GET(request);

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.data).toHaveLength(1);
      expect(body.data[0].status).toBe(ConsultationStatus.COMPLETED);
      
      // SECURITY: Verify query includes both patientId filter AND status filter
      expect(prismaMock.consultation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            patientId: patient.id,
            status: ConsultationStatus.COMPLETED,
          }),
        })
      );
    });

    it('should filter by date range', async () => {
      const patient = createMockUser({ id: 'patient_1' });
      const session = createMockSession(patient);
      mockGetSession.mockResolvedValue(session);

      const now = new Date();
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const consultations = [
        createMockConsultation({
          patientId: patient.id,
          createdAt: new Date(lastMonth.getTime() + 86400000 * 5),
        }),
      ];

      prismaMock.consultation.findMany.mockResolvedValue(consultations as any);
      prismaMock.consultation.count.mockResolvedValue(1);

      const request = createRequest({
        from: lastMonth.toISOString(),
        to: thisMonth.toISOString(),
      });
      const response = await GET(request);

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.data).toHaveLength(1);
    });
  });

  describe('Security', () => {
    it('should not allow patients to see other patients consultations', async () => {
      const patient = createMockUser({ id: 'patient_1' });
      const session = createMockSession(patient);
      mockGetSession.mockResolvedValue(session);

      // Even if malicious data is returned, query must be filtered correctly
      const otherPatientConsultations = [
        createMockConsultation({ patientId: 'other_patient', status: ConsultationStatus.COMPLETED }),
      ];

      prismaMock.consultation.findMany.mockResolvedValue(otherPatientConsultations as any);
      prismaMock.consultation.count.mockResolvedValue(1);

      const request = createRequest();
      const response = await GET(request);

      // SECURITY: Verify query is ALWAYS filtered by authenticated patient's ID
      expect(prismaMock.consultation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            patientId: patient.id, // Must use authenticated user's ID, not any ID from request
          }),
        })
      );
    });

    it('should not allow doctors to see consultations assigned to other doctors', async () => {
      const doctor = createMockDoctor({ id: 'doctor_1' });
      const session = createMockSession(doctor);
      mockGetSession.mockResolvedValue(session);

      const otherDoctorConsultations = [
        createMockConsultation({ doctorId: 'other_doctor', status: ConsultationStatus.COMPLETED }),
      ];

      prismaMock.consultation.findMany.mockResolvedValue(otherDoctorConsultations as any);
      prismaMock.consultation.count.mockResolvedValue(1);

      const request = createRequest();
      const response = await GET(request);

      // SECURITY: Verify query is ALWAYS filtered by authenticated doctor's ID
      expect(prismaMock.consultation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            doctorId: doctor.id, // Must use authenticated user's ID, not any ID from request
          }),
        })
      );
    });
  });

  describe('Pagination', () => {
    it('should support limit parameter', async () => {
      const patient = createMockUser({ id: 'patient_1' });
      const session = createMockSession(patient);
      mockGetSession.mockResolvedValue(session);

      const consultations = Array.from({ length: 5 }, () =>
        createMockConsultation({ patientId: patient.id })
      );

      prismaMock.consultation.findMany.mockResolvedValue(consultations as any);
      prismaMock.consultation.count.mockResolvedValue(20);

      const request = createRequest({ limit: '5' });
      const response = await GET(request);

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.data).toHaveLength(5);
      expect(body.pagination.limit).toBe(5);
      expect(body.pagination.total).toBe(20);
      
      // SECURITY: Verify pagination doesn't bypass authorization filter
      expect(prismaMock.consultation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            patientId: patient.id,
          }),
        })
      );
    });

    it('should support offset parameter', async () => {
      const patient = createMockUser({ id: 'patient_1' });
      const session = createMockSession(patient);
      mockGetSession.mockResolvedValue(session);

      prismaMock.consultation.findMany.mockResolvedValue([]);
      prismaMock.consultation.count.mockResolvedValue(20);

      const request = createRequest({ offset: '10' });
      const response = await GET(request);

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.pagination.offset).toBe(10);
    });
  });

  describe('Sorting', () => {
    it('should sort by createdAt descending by default', async () => {
      const patient = createMockUser({ id: 'patient_1' });
      const session = createMockSession(patient);
      mockGetSession.mockResolvedValue(session);

      const now = new Date();
      const consultations = [
        createMockConsultation({ patientId: patient.id, createdAt: now }),
        createMockConsultation({ patientId: patient.id, createdAt: new Date(now.getTime() - 86400000) }),
      ];

      prismaMock.consultation.findMany.mockResolvedValue(consultations as any);
      prismaMock.consultation.count.mockResolvedValue(2);

      const request = createRequest();
      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(prismaMock.consultation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            patientId: patient.id,
          }),
          orderBy: { createdAt: 'desc' },
        })
      );
    });
  });

  describe('Response Format', () => {
    it('should include consultation details with doctor info', async () => {
      const patient = createMockUser({ id: 'patient_1' });
      const session = createMockSession(patient);
      mockGetSession.mockResolvedValue(session);

      const doctor = createMockDoctor({ id: 'doctor_1', name: 'Dr. Smith' });
      const consultation = {
        ...createMockConsultation({ patientId: patient.id, doctorId: doctor.id }),
        doctor: {
          id: doctor.id,
          name: doctor.name,
          image: null,
        },
      };

      prismaMock.consultation.findMany.mockResolvedValue([consultation] as any);
      prismaMock.consultation.count.mockResolvedValue(1);

      const request = createRequest();
      const response = await GET(request);

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.data[0].doctor).toBeDefined();
      expect(body.data[0].doctor.name).toBe('Dr. Smith');
    });

    it('should include payment status', async () => {
      const patient = createMockUser({ id: 'patient_1' });
      const session = createMockSession(patient);
      mockGetSession.mockResolvedValue(session);

      const consultation = {
        ...createMockConsultation({ patientId: patient.id }),
        payments: [
          {
            id: 'payment_1',
            status: 'PAID',
            amount: 5000,
            currency: 'USD',
          },
        ],
      };

      prismaMock.consultation.findMany.mockResolvedValue([consultation] as any);
      prismaMock.consultation.count.mockResolvedValue(1);

      const request = createRequest();
      const response = await GET(request);

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.data[0].payments).toHaveLength(1);
      expect(body.data[0].payments[0].status).toBe('PAID');
    });
  });
});
