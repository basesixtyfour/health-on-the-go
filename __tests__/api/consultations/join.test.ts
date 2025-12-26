/**
 * Tests for POST /api/v1/consultations/:id/join
 * 
 * TDD: These tests verify the video call join endpoint.
 * Creates Daily room on first join, validates time windows, generates meeting tokens.
 */

import { NextRequest } from 'next/server';
import {
  createMockUser,
  createMockDoctor,
  createMockAdmin,
  createMockConsultation,
  createMockVideoSession,
  resetFactories,
  ConsultationStatus,
} from '../../helpers/factories';
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

// Mock Daily client
const mockCreateRoom = jest.fn();
const mockCreateMeetingToken = jest.fn();
jest.mock('@/lib/daily', () => ({
  createRoom: (...args: unknown[]) => mockCreateRoom(...args),
  createMeetingToken: (...args: unknown[]) => mockCreateMeetingToken(...args),
}));

// Import route handler after mocks are set up
import { POST } from '@/app/api/v1/consultations/[id]/join/route';

describe('POST /api/v1/consultations/:id/join', () => {
  beforeEach(() => {
    resetFactories();
    resetPrismaMock();
    setupPrismaMock();
    mockGetSession.mockReset();
    mockCreateRoom.mockReset();
    mockCreateMeetingToken.mockReset();
  });

  /**
   * Helper to create a mock request
   */
  function createRequest(id: string): NextRequest {
    return new NextRequest(`http://localhost:3000/api/v1/consultations/${id}/join`, {
      method: 'POST',
    });
  }

  /**
   * Helper to create route params
   */
  function createParams(id: string) {
    return { params: Promise.resolve({ id }) };
  }

  /**
   * Helper to get current time ± minutes
   */
  function timeOffset(minutes: number): Date {
    return new Date(Date.now() + minutes * 60 * 1000);
  }

  describe('Authentication', () => {
    it('should return 401 when not authenticated', async () => {
      mockGetSession.mockResolvedValue(null);

      const request = createRequest('consult_1');
      const response = await POST(request, createParams('consult_1'));

      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('Authorization', () => {
    it('should allow patient to join their own consultation', async () => {
      const patient = createMockUser({ id: 'patient_1' });
      const session = createMockSession(patient);
      mockGetSession.mockResolvedValue(session);

      const consultation = createMockConsultation({
        id: 'consult_1',
        patientId: patient.id,
        doctorId: 'doctor_1',
        status: ConsultationStatus.PAID,
        scheduledStartAt: new Date(), // Now
      });

      const videoSession = createMockVideoSession(consultation.id);

      prismaMock.consultation.findUnique.mockResolvedValue({
        ...consultation,
        videoSession,
      } as any);

      mockCreateMeetingToken.mockResolvedValue('mock_token_123');

      const request = createRequest(consultation.id);
      const response = await POST(request, createParams(consultation.id));

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.token).toBe('mock_token_123');
      expect(body.roomUrl).toBeDefined();
    });

    it('should allow assigned doctor to join consultation', async () => {
      const doctor = createMockDoctor({ id: 'doctor_1' });
      const session = createMockSession(doctor);
      mockGetSession.mockResolvedValue(session);

      const consultation = createMockConsultation({
        id: 'consult_1',
        patientId: 'patient_1',
        doctorId: doctor.id,
        status: ConsultationStatus.PAID,
        scheduledStartAt: new Date(),
      });

      const videoSession = createMockVideoSession(consultation.id);

      prismaMock.consultation.findUnique.mockResolvedValue({
        ...consultation,
        videoSession,
      } as any);

      mockCreateMeetingToken.mockResolvedValue('mock_token_doctor');

      const request = createRequest(consultation.id);
      const response = await POST(request, createParams(consultation.id));

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.token).toBe('mock_token_doctor');
    });

    it('should return 403 for unrelated user', async () => {
      const otherUser = createMockUser({ id: 'other_user' });
      const session = createMockSession(otherUser);
      mockGetSession.mockResolvedValue(session);

      const consultation = createMockConsultation({
        id: 'consult_1',
        patientId: 'patient_1',
        doctorId: 'doctor_1',
        status: ConsultationStatus.PAID,
        scheduledStartAt: new Date(),
      });

      prismaMock.consultation.findUnique.mockResolvedValue({
        ...consultation,
        videoSession: null,
      } as any);

      const request = createRequest(consultation.id);
      const response = await POST(request, createParams(consultation.id));

      expect(response.status).toBe(403);
      const body = await response.json();
      expect(body.error.code).toBe('FORBIDDEN');
    });

    it('should allow admin to join any consultation', async () => {
      const admin = createMockAdmin();
      const session = createMockSession(admin);
      mockGetSession.mockResolvedValue(session);

      const consultation = createMockConsultation({
        id: 'consult_1',
        patientId: 'patient_1',
        doctorId: 'doctor_1',
        status: ConsultationStatus.PAID,
        scheduledStartAt: new Date(),
      });

      const videoSession = createMockVideoSession(consultation.id);

      prismaMock.consultation.findUnique.mockResolvedValue({
        ...consultation,
        videoSession,
      } as any);

      mockCreateMeetingToken.mockResolvedValue('mock_token_admin');

      const request = createRequest(consultation.id);
      const response = await POST(request, createParams(consultation.id));

      expect(response.status).toBe(200);
    });
  });

  describe('Status Validation', () => {
    it('should return 400 if consultation status is not PAID or IN_CALL', async () => {
      const patient = createMockUser({ id: 'patient_1' });
      const session = createMockSession(patient);
      mockGetSession.mockResolvedValue(session);

      const consultation = createMockConsultation({
        id: 'consult_1',
        patientId: patient.id,
        status: ConsultationStatus.CREATED, // Not PAID
        scheduledStartAt: new Date(),
      });

      prismaMock.consultation.findUnique.mockResolvedValue({
        ...consultation,
        videoSession: null,
      } as any);

      const request = createRequest(consultation.id);
      const response = await POST(request, createParams(consultation.id));

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(body.error.message).toContain('status');
    });

    it('should allow joining if consultation status is IN_CALL', async () => {
      const patient = createMockUser({ id: 'patient_1' });
      const session = createMockSession(patient);
      mockGetSession.mockResolvedValue(session);

      const consultation = createMockConsultation({
        id: 'consult_1',
        patientId: patient.id,
        doctorId: 'doctor_1',
        status: ConsultationStatus.IN_CALL,
        scheduledStartAt: new Date(),
      });

      const videoSession = createMockVideoSession(consultation.id);

      prismaMock.consultation.findUnique.mockResolvedValue({
        ...consultation,
        videoSession,
      } as any);

      mockCreateMeetingToken.mockResolvedValue('mock_token');

      const request = createRequest(consultation.id);
      const response = await POST(request, createParams(consultation.id));

      expect(response.status).toBe(200);
    });
  });

  describe('Time Window Validation', () => {
    it('should return 400 if joining too early (> 5 minutes before scheduled time)', async () => {
      const patient = createMockUser({ id: 'patient_1' });
      const session = createMockSession(patient);
      mockGetSession.mockResolvedValue(session);

      const consultation = createMockConsultation({
        id: 'consult_1',
        patientId: patient.id,
        status: ConsultationStatus.PAID,
        scheduledStartAt: timeOffset(30), // 30 minutes from now
      });

      prismaMock.consultation.findUnique.mockResolvedValue({
        ...consultation,
        videoSession: null,
      } as any);

      const request = createRequest(consultation.id);
      const response = await POST(request, createParams(consultation.id));

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(body.error.message).toContain('early');
    });

    it('should return 400 if joining too late (> 30 minutes after scheduled time)', async () => {
      const patient = createMockUser({ id: 'patient_1' });
      const session = createMockSession(patient);
      mockGetSession.mockResolvedValue(session);

      const consultation = createMockConsultation({
        id: 'consult_1',
        patientId: patient.id,
        status: ConsultationStatus.PAID,
        scheduledStartAt: timeOffset(-45), // 45 minutes ago
      });

      prismaMock.consultation.findUnique.mockResolvedValue({
        ...consultation,
        videoSession: null,
      } as any);

      const request = createRequest(consultation.id);
      const response = await POST(request, createParams(consultation.id));

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(body.error.message).toContain('late');
    });

    it('should allow joining within valid time window (5 min early to 30 min late)', async () => {
      const patient = createMockUser({ id: 'patient_1' });
      const session = createMockSession(patient);
      mockGetSession.mockResolvedValue(session);

      const consultation = createMockConsultation({
        id: 'consult_1',
        patientId: patient.id,
        doctorId: 'doctor_1',
        status: ConsultationStatus.PAID,
        scheduledStartAt: timeOffset(-3), // 3 minutes ago (within window)
      });

      const videoSession = createMockVideoSession(consultation.id);

      prismaMock.consultation.findUnique.mockResolvedValue({
        ...consultation,
        videoSession,
      } as any);

      mockCreateMeetingToken.mockResolvedValue('mock_token');

      const request = createRequest(consultation.id);
      const response = await POST(request, createParams(consultation.id));

      expect(response.status).toBe(200);
    });

    it('should allow joining at exactly 5 minutes early', async () => {
      const patient = createMockUser({ id: 'patient_1' });
      const session = createMockSession(patient);
      mockGetSession.mockResolvedValue(session);

      const consultation = createMockConsultation({
        id: 'consult_1',
        patientId: patient.id,
        doctorId: 'doctor_1',
        status: ConsultationStatus.PAID,
        scheduledStartAt: timeOffset(5), // Exactly 5 minutes from now
      });

      const videoSession = createMockVideoSession(consultation.id);

      prismaMock.consultation.findUnique.mockResolvedValue({
        ...consultation,
        videoSession,
      } as any);

      mockCreateMeetingToken.mockResolvedValue('mock_token');

      const request = createRequest(consultation.id);
      const response = await POST(request, createParams(consultation.id));

      expect(response.status).toBe(200);
    });
  });

  describe('Room Creation (Lazy)', () => {
    it('should create Daily room if VideoSession does not exist', async () => {
      const doctor = createMockDoctor({ id: 'doctor_1' });
      const session = createMockSession(doctor);
      mockGetSession.mockResolvedValue(session);

      const consultation = createMockConsultation({
        id: 'consult_1',
        patientId: 'patient_1',
        doctorId: doctor.id,
        status: ConsultationStatus.PAID,
        scheduledStartAt: new Date(),
      });

      // No existing video session
      prismaMock.consultation.findUnique.mockResolvedValue({
        ...consultation,
        videoSession: null,
      } as any);

      const newRoom = {
        name: `consult_1_room`,
        url: 'https://test.daily.co/consult_1_room',
      };
      mockCreateRoom.mockResolvedValue(newRoom);

      const createdVideoSession = createMockVideoSession(consultation.id, {
        roomName: newRoom.name,
        roomUrl: newRoom.url,
      });
      prismaMock.videoSession.create.mockResolvedValue(createdVideoSession);

      mockCreateMeetingToken.mockResolvedValue('mock_token');

      const request = createRequest(consultation.id);
      const response = await POST(request, createParams(consultation.id));

      expect(response.status).toBe(200);
      expect(mockCreateRoom).toHaveBeenCalled();
      expect(prismaMock.videoSession.create).toHaveBeenCalled();
    });

    it('should reuse existing room if VideoSession exists', async () => {
      const patient = createMockUser({ id: 'patient_1' });
      const session = createMockSession(patient);
      mockGetSession.mockResolvedValue(session);

      const consultation = createMockConsultation({
        id: 'consult_1',
        patientId: patient.id,
        doctorId: 'doctor_1',
        status: ConsultationStatus.PAID,
        scheduledStartAt: new Date(),
      });

      const existingVideoSession = createMockVideoSession(consultation.id);

      prismaMock.consultation.findUnique.mockResolvedValue({
        ...consultation,
        videoSession: existingVideoSession,
      } as any);

      mockCreateMeetingToken.mockResolvedValue('mock_token');

      const request = createRequest(consultation.id);
      const response = await POST(request, createParams(consultation.id));

      expect(response.status).toBe(200);
      expect(mockCreateRoom).not.toHaveBeenCalled();
      expect(prismaMock.videoSession.create).not.toHaveBeenCalled();
    });
  });

  describe('Status Transition', () => {
    it('should update consultation status to IN_CALL on first join', async () => {
      const doctor = createMockDoctor({ id: 'doctor_1' });
      const session = createMockSession(doctor);
      mockGetSession.mockResolvedValue(session);

      const consultation = createMockConsultation({
        id: 'consult_1',
        patientId: 'patient_1',
        doctorId: doctor.id,
        status: ConsultationStatus.PAID,
        scheduledStartAt: new Date(),
      });

      prismaMock.consultation.findUnique.mockResolvedValue({
        ...consultation,
        videoSession: null,
      } as any);

      mockCreateRoom.mockResolvedValue({
        name: 'room_1',
        url: 'https://test.daily.co/room_1',
      });

      prismaMock.videoSession.create.mockResolvedValue(
        createMockVideoSession(consultation.id)
      );

      mockCreateMeetingToken.mockResolvedValue('mock_token');

      const request = createRequest(consultation.id);
      await POST(request, createParams(consultation.id));

      expect(prismaMock.consultation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: consultation.id },
          data: expect.objectContaining({
            status: ConsultationStatus.IN_CALL,
          }),
        })
      );
    });

    it('should not update status if already IN_CALL', async () => {
      const patient = createMockUser({ id: 'patient_1' });
      const session = createMockSession(patient);
      mockGetSession.mockResolvedValue(session);

      const consultation = createMockConsultation({
        id: 'consult_1',
        patientId: patient.id,
        doctorId: 'doctor_1',
        status: ConsultationStatus.IN_CALL, // Already in call
        scheduledStartAt: new Date(),
      });

      const videoSession = createMockVideoSession(consultation.id);

      prismaMock.consultation.findUnique.mockResolvedValue({
        ...consultation,
        videoSession,
      } as any);

      mockCreateMeetingToken.mockResolvedValue('mock_token');

      const request = createRequest(consultation.id);
      await POST(request, createParams(consultation.id));

      expect(prismaMock.consultation.update).not.toHaveBeenCalled();
    });
  });

  describe('Response Format', () => {
    it('should return joinUrl, roomUrl, token, and expiresAt', async () => {
      const patient = createMockUser({ id: 'patient_1' });
      const session = createMockSession(patient);
      mockGetSession.mockResolvedValue(session);

      const consultation = createMockConsultation({
        id: 'consult_1',
        patientId: patient.id,
        doctorId: 'doctor_1',
        status: ConsultationStatus.PAID,
        scheduledStartAt: new Date(),
      });

      const videoSession = createMockVideoSession(consultation.id, {
        roomUrl: 'https://test.daily.co/my_room',
      });

      prismaMock.consultation.findUnique.mockResolvedValue({
        ...consultation,
        videoSession,
      } as any);

      mockCreateMeetingToken.mockResolvedValue('jwt_token_here');

      const request = createRequest(consultation.id);
      const response = await POST(request, createParams(consultation.id));

      expect(response.status).toBe(200);
      const body = await response.json();

      expect(body).toHaveProperty('joinUrl');
      expect(body).toHaveProperty('roomUrl');
      expect(body).toHaveProperty('token');
      expect(body).toHaveProperty('expiresAt');
      expect(body.joinUrl).toContain('?t=');
      expect(body.token).toBe('jwt_token_here');
    });

    it('should set isOwner=true for doctor token', async () => {
      const doctor = createMockDoctor({ id: 'doctor_1' });
      const session = createMockSession(doctor);
      mockGetSession.mockResolvedValue(session);

      const consultation = createMockConsultation({
        id: 'consult_1',
        patientId: 'patient_1',
        doctorId: doctor.id,
        status: ConsultationStatus.PAID,
        scheduledStartAt: new Date(),
      });

      const videoSession = createMockVideoSession(consultation.id);

      prismaMock.consultation.findUnique.mockResolvedValue({
        ...consultation,
        videoSession,
      } as any);

      mockCreateMeetingToken.mockResolvedValue('doctor_token');

      const request = createRequest(consultation.id);
      await POST(request, createParams(consultation.id));

      expect(mockCreateMeetingToken).toHaveBeenCalledWith(
        expect.any(String),
        doctor.id,
        true // isOwner for doctor
      );
    });

    it('should set isOwner=false for patient token', async () => {
      const patient = createMockUser({ id: 'patient_1' });
      const session = createMockSession(patient);
      mockGetSession.mockResolvedValue(session);

      const consultation = createMockConsultation({
        id: 'consult_1',
        patientId: patient.id,
        doctorId: 'doctor_1',
        status: ConsultationStatus.PAID,
        scheduledStartAt: new Date(),
      });

      const videoSession = createMockVideoSession(consultation.id);

      prismaMock.consultation.findUnique.mockResolvedValue({
        ...consultation,
        videoSession,
      } as any);

      mockCreateMeetingToken.mockResolvedValue('patient_token');

      const request = createRequest(consultation.id);
      await POST(request, createParams(consultation.id));

      expect(mockCreateMeetingToken).toHaveBeenCalledWith(
        expect.any(String),
        patient.id,
        false // isOwner for patient
      );
    });
  });

  describe('Audit Logging', () => {
    it('should create audit event on successful join', async () => {
      const patient = createMockUser({ id: 'patient_1' });
      const session = createMockSession(patient);
      mockGetSession.mockResolvedValue(session);

      const consultation = createMockConsultation({
        id: 'consult_1',
        patientId: patient.id,
        doctorId: 'doctor_1',
        status: ConsultationStatus.PAID,
        scheduledStartAt: new Date(),
      });

      const videoSession = createMockVideoSession(consultation.id);

      prismaMock.consultation.findUnique.mockResolvedValue({
        ...consultation,
        videoSession,
      } as any);

      mockCreateMeetingToken.mockResolvedValue('mock_token');

      const request = createRequest(consultation.id);
      await POST(request, createParams(consultation.id));

      expect(prismaMock.auditEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            actorUserId: patient.id,
            consultationId: consultation.id,
            eventType: 'JOIN_TOKEN_MINTED',
          }),
        })
      );
    });
  });

  describe('Not Found', () => {
    it('should return 404 when consultation does not exist', async () => {
      const patient = createMockUser();
      const session = createMockSession(patient);
      mockGetSession.mockResolvedValue(session);

      prismaMock.consultation.findUnique.mockResolvedValue(null);

      const request = createRequest('non_existent');
      const response = await POST(request, createParams('non_existent'));

      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body.error.code).toBe('NOT_FOUND');
    });
  });
});
