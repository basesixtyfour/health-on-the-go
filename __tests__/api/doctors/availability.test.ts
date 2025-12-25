/**
 * Tests for GET /api/v1/doctors/availability
 * 
 * TDD: These tests verify the doctor availability endpoint.
 */

import { NextRequest } from 'next/server';
import { createMockUser, createMockDoctor, resetFactories } from '../../helpers/factories';
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
import { GET } from '@/app/api/v1/doctors/availability/route';

describe('GET /api/v1/doctors/availability', () => {
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
    const url = new URL('http://localhost:3000/api/v1/doctors/availability');
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

  describe('Validation', () => {
    it('should require specialty parameter', async () => {
      const patient = createMockUser();
      const session = createMockSession(patient);
      mockGetSession.mockResolvedValue(session);

      const request = createRequest({}); // Missing specialty
      const response = await GET(request);

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should validate date parameter format', async () => {
      const patient = createMockUser();
      const session = createMockSession(patient);
      mockGetSession.mockResolvedValue(session);

      // Mock doctors for multi-doctor flow
      const doctor = createMockDoctor({ id: 'doctor_1' });
      prismaMock.user.findMany.mockResolvedValue([
        {
          ...doctor,
          doctorProfile: {
            id: 'profile_1',
            doctorId: doctor.id,
            specialties: ['CARDIOLOGY'],
            timezone: 'UTC',
          },
        },
      ] as any);

      const request = createRequest({
        specialty: 'CARDIOLOGY',
        date: 'invalid-date',
      });
      const response = await GET(request);

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('Getting Availability', () => {
    it('should return available time slots', async () => {
      const patient = createMockUser();
      const session = createMockSession(patient);
      mockGetSession.mockResolvedValue(session);

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dateStr = tomorrow.toISOString().split('T')[0];

      // Mock doctors with availability
      const doctor = createMockDoctor({ id: 'doctor_1' });
      prismaMock.user.findMany.mockResolvedValue([
        {
          ...doctor,
          doctorProfile: {
            id: 'profile_1',
            doctorId: doctor.id,
            specialties: ['CARDIOLOGY'],
            timezone: 'UTC',
          },
        },
      ] as any);

      // Mock no conflicting consultations
      prismaMock.consultation.findMany.mockResolvedValue([]);

      const request = createRequest({
        specialty: 'CARDIOLOGY',
        date: dateStr,
      });
      const response = await GET(request);

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.slots).toBeDefined();
      expect(Array.isArray(body.slots)).toBe(true);
    });

    it('should filter out booked time slots', async () => {
      const patient = createMockUser();
      const session = createMockSession(patient);
      mockGetSession.mockResolvedValue(session);

      // Create a tomorrow date at 10 AM UTC for the booked slot
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dateStr = tomorrow.toISOString().split('T')[0];

      // Create the booked consultation time at 10:00 UTC on that day
      const bookedAt = new Date(`${dateStr}T10:00:00.000Z`);

      const doctor = createMockDoctor({ id: 'doctor_1' });
      prismaMock.user.findMany.mockResolvedValue([
        {
          ...doctor,
          doctorProfile: {
            id: 'profile_1',
            doctorId: doctor.id,
            specialties: ['CARDIOLOGY'],
            timezone: 'UTC',
          },
        },
      ] as any);

      // Mock an existing consultation at 10 AM UTC
      prismaMock.consultation.findMany.mockResolvedValue([
        {
          id: 'consult_1',
          doctorId: doctor.id,
          scheduledStartAt: bookedAt,
          status: 'PAID',
        },
      ] as any);

      const request = createRequest({
        specialty: 'CARDIOLOGY',
        date: dateStr,
      });
      const response = await GET(request);

      expect(response.status).toBe(200);
      const body = await response.json();
      // The 10 AM UTC slot should not be available
      const tenAmSlot = body.slots?.find((slot: any) =>
        new Date(slot.startTime).getUTCHours() === 10
      );
      expect(tenAmSlot?.available).toBe(false);
    });

    it('should filter by specific doctor if doctorId provided', async () => {
      const patient = createMockUser();
      const session = createMockSession(patient);
      mockGetSession.mockResolvedValue(session);

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dateStr = tomorrow.toISOString().split('T')[0];

      const doctor = createMockDoctor({ id: 'doctor_1' });
      prismaMock.user.findUnique.mockResolvedValue({
        ...doctor,
        doctorProfile: {
          id: 'profile_1',
          doctorId: doctor.id,
          specialties: ['CARDIOLOGY'],
          timezone: 'UTC',
        },
      } as any);

      prismaMock.consultation.findMany.mockResolvedValue([]);

      const request = createRequest({
        specialty: 'CARDIOLOGY',
        date: dateStr,
        doctorId: 'doctor_1',
      });
      const response = await GET(request);

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.doctorId).toBe('doctor_1');
    });
  });

  describe('Response Format', () => {
    it('should return slots with startTime and endTime', async () => {
      const patient = createMockUser();
      const session = createMockSession(patient);
      mockGetSession.mockResolvedValue(session);

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dateStr = tomorrow.toISOString().split('T')[0];

      const doctor = createMockDoctor({ id: 'doctor_1' });
      prismaMock.user.findMany.mockResolvedValue([
        {
          ...doctor,
          doctorProfile: {
            id: 'profile_1',
            doctorId: doctor.id,
            specialties: ['CARDIOLOGY'],
            timezone: 'UTC',
          },
        },
      ] as any);

      prismaMock.consultation.findMany.mockResolvedValue([]);

      const request = createRequest({
        specialty: 'CARDIOLOGY',
        date: dateStr,
      });
      const response = await GET(request);

      expect(response.status).toBe(200);
      const body = await response.json();
      if (body.slots && body.slots.length > 0) {
        expect(body.slots[0]).toHaveProperty('startTime');
        expect(body.slots[0]).toHaveProperty('endTime');
        expect(body.slots[0]).toHaveProperty('available');
        expect(body.slots[0]).toHaveProperty('doctorId');
      }
    });

    it('should group slots by doctor when multiple doctors available', async () => {
      const patient = createMockUser();
      const session = createMockSession(patient);
      mockGetSession.mockResolvedValue(session);

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dateStr = tomorrow.toISOString().split('T')[0];

      const doctor1 = createMockDoctor({ id: 'doctor_1', name: 'Dr. Smith' });
      const doctor2 = createMockDoctor({ id: 'doctor_2', name: 'Dr. Jones' });

      prismaMock.user.findMany.mockResolvedValue([
        {
          ...doctor1,
          doctorProfile: {
            id: 'profile_1',
            doctorId: doctor1.id,
            specialties: ['CARDIOLOGY'],
            timezone: 'UTC',
          },
        },
        {
          ...doctor2,
          doctorProfile: {
            id: 'profile_2',
            doctorId: doctor2.id,
            specialties: ['CARDIOLOGY'],
            timezone: 'UTC',
          },
        },
      ] as any);

      prismaMock.consultation.findMany.mockResolvedValue([]);

      const request = createRequest({
        specialty: 'CARDIOLOGY',
        date: dateStr,
      });
      const response = await GET(request);

      expect(response.status).toBe(200);
      const body = await response.json();
      // Should have slots from multiple doctors
      expect(body.doctors).toBeDefined();
      expect(body.doctors.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Date Range', () => {
    it('should not allow booking in the past', async () => {
      const patient = createMockUser();
      const session = createMockSession(patient);
      mockGetSession.mockResolvedValue(session);

      // Use single-doctor flow which returns 400 for invalid dates
      const doctor = createMockDoctor({ id: 'doctor_1' });
      prismaMock.user.findUnique.mockResolvedValue({
        ...doctor,
        doctorProfile: {
          id: 'profile_1',
          doctorId: doctor.id,
          specialties: ['CARDIOLOGY'],
          timezone: 'UTC',
        },
      } as any);

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const dateStr = yesterday.toISOString().split('T')[0];

      const request = createRequest({
        specialty: 'CARDIOLOGY',
        date: dateStr,
        doctorId: 'doctor_1',
      });
      const response = await GET(request);

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should limit booking horizon (e.g., max 30 days ahead)', async () => {
      const patient = createMockUser();
      const session = createMockSession(patient);
      mockGetSession.mockResolvedValue(session);

      // Use single-doctor flow which returns 400 for invalid dates
      const doctor = createMockDoctor({ id: 'doctor_1' });
      prismaMock.user.findUnique.mockResolvedValue({
        ...doctor,
        doctorProfile: {
          id: 'profile_1',
          doctorId: doctor.id,
          specialties: ['CARDIOLOGY'],
          timezone: 'UTC',
        },
      } as any);

      const farFuture = new Date();
      farFuture.setDate(farFuture.getDate() + 60);
      const dateStr = farFuture.toISOString().split('T')[0];

      const request = createRequest({
        specialty: 'CARDIOLOGY',
        date: dateStr,
        doctorId: 'doctor_1',
      });
      const response = await GET(request);

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });
  });
});
