/**
 * Tests for GET /api/v1/consultations/:id
 * 
 * TDD: These tests verify the single consultation get endpoint.
 */

import { NextRequest } from 'next/server';
import { createMockUser, createMockDoctor, createMockAdmin, createMockConsultation, resetFactories, UserRole, ConsultationStatus } from '../../helpers/factories';
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
import { GET } from '@/app/api/v1/consultations/[id]/route';

describe('GET /api/v1/consultations/:id', () => {
  beforeEach(() => {
    resetFactories();
    resetPrismaMock();
    setupPrismaMock();
    mockGetSession.mockReset();
  });

  /**
   * Helper to create a mock request
   */
  function createRequest(id: string): NextRequest {
    return new NextRequest(`http://localhost:3000/api/v1/consultations/${id}`, {
      method: 'GET',
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

      const request = createRequest('consult_1');
      const response = await GET(request, createParams('consult_1'));

      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('Authorization', () => {
    it('should return consultation if user is the patient', async () => {
      // Arrange
      const patient = createMockUser({ id: 'patient_1' });
      const session = createMockSession(patient);
      mockGetSession.mockResolvedValue(session);

      const consultation = createMockConsultation({
        id: 'consult_1',
        patientId: patient.id,
      });

      prismaMock.consultation.findUnique.mockResolvedValue({
        ...consultation,
        patient: { id: patient.id, name: 'Test', email: 'test@test.com' },
        doctor: null,
        patientIntake: null,
        payments: [],
      } as any);

      const request = createRequest('consult_1');
      const response = await GET(request, createParams('consult_1'));

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.patientId).toBe(patient.id);
    });

    it('should return consultation if user is the assigned doctor', async () => {
      const doctor = createMockDoctor({ id: 'doctor_1' });
      const session = createMockSession(doctor);
      mockGetSession.mockResolvedValue(session);

      const consultation = createMockConsultation({
        doctorId: doctor.id,
        status: ConsultationStatus.PAID,
      });

      prismaMock.consultation.findUnique.mockResolvedValue({
        ...consultation,
        patient: { id: 'patient_1', name: 'Test', email: 'test@test.com' },
        doctor: { id: doctor.id, name: 'Dr. Test', email: 'doctor@test.com' },
        patientIntake: null,
        payments: [],
      } as any);

      const request = createRequest(consultation.id);
      const response = await GET(request, createParams(consultation.id));

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.doctorId).toBe(doctor.id);
    });

    it('should return 403 if user is not owner or assigned doctor', async () => {
      const otherUser = createMockUser({ id: 'other_user' });
      const session = createMockSession(otherUser);
      mockGetSession.mockResolvedValue(session);

      const consultation = createMockConsultation({
        patientId: 'patient_1',
        doctorId: 'doctor_1',
      });

      prismaMock.consultation.findUnique.mockResolvedValue({
        ...consultation,
        patient: { id: 'patient_1', name: 'Test', email: 'test@test.com' },
        doctor: { id: 'doctor_1', name: 'Dr. Test', email: 'doctor@test.com' },
        patientIntake: null,
        payments: [],
      } as any);

      const request = createRequest(consultation.id);
      const response = await GET(request, createParams(consultation.id));

      expect(response.status).toBe(403);
      const body = await response.json();
      expect(body.error.code).toBe('FORBIDDEN');
    });

    it('should allow admin to view any consultation', async () => {
      const admin = createMockAdmin();
      const session = createMockSession(admin);
      mockGetSession.mockResolvedValue(session);

      const consultation = createMockConsultation({
        patientId: 'some_patient',
        doctorId: 'some_doctor',
      });

      prismaMock.consultation.findUnique.mockResolvedValue({
        ...consultation,
        patient: { id: 'some_patient', name: 'Test', email: 'test@test.com' },
        doctor: { id: 'some_doctor', name: 'Dr. Test', email: 'doctor@test.com' },
        patientIntake: null,
        payments: [],
      } as any);

      const request = createRequest(consultation.id);
      const response = await GET(request, createParams(consultation.id));

      expect(response.status).toBe(200);
    });
  });

  describe('Not Found', () => {
    it('should return 404 when consultation does not exist', async () => {
      const patient = createMockUser();
      const session = createMockSession(patient);
      mockGetSession.mockResolvedValue(session);

      prismaMock.consultation.findUnique.mockResolvedValue(null);

      const request = createRequest('non_existent_id');
      const response = await GET(request, createParams('non_existent_id'));

      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('Response Format', () => {
    it('should include patient intake if exists', async () => {
      const patient = createMockUser({ id: 'patient_1' });
      const session = createMockSession(patient);
      mockGetSession.mockResolvedValue(session);

      const consultation = createMockConsultation({ patientId: patient.id });
      const consultationWithIntake = {
        ...consultation,
        patient: { id: patient.id, name: 'Test', email: 'test@test.com' },
        doctor: null,
        patientIntake: {
          id: 'intake_1',
          nameOrAlias: 'John Doe',
          ageRange: '18-39',
          chiefComplaint: 'Headache',
          consentAcceptedAt: new Date(),
        },
        payments: [],
      };

      prismaMock.consultation.findUnique.mockResolvedValue(consultationWithIntake as any);

      const request = createRequest(consultation.id);
      const response = await GET(request, createParams(consultation.id));

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.patientIntake).toBeDefined();
      expect(body.patientIntake.nameOrAlias).toBe('John Doe');
    });

    it('should include payment status if exists', async () => {
      const patient = createMockUser({ id: 'patient_1' });
      const session = createMockSession(patient);
      mockGetSession.mockResolvedValue(session);

      const consultation = createMockConsultation({ patientId: patient.id });
      const consultationWithPayment = {
        ...consultation,
        patient: { id: patient.id, name: 'Test', email: 'test@test.com' },
        doctor: null,
        patientIntake: null,
        payments: [{
          id: 'payment_1',
          status: 'PAID',
          amount: 5000,
          currency: 'USD',
        }],
      };

      prismaMock.consultation.findUnique.mockResolvedValue(consultationWithPayment as any);

      const request = createRequest(consultation.id);
      const response = await GET(request, createParams(consultation.id));

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.payments).toHaveLength(1);
      expect(body.payments[0].status).toBe('PAID');
    });
  });
});
