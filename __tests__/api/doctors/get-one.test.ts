/**
 * Tests for GET /api/v1/doctors/:id
 * 
 * TDD: These tests verify the single doctor get endpoint.
 */

import { NextRequest } from 'next/server';
import { createMockUser, createMockDoctor, createMockAdmin, resetFactories, UserRole } from '../../helpers/factories';
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
import { GET } from '@/app/api/v1/doctors/[id]/route';

describe('GET /api/v1/doctors/:id', () => {
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
    return new NextRequest(`http://localhost:3000/api/v1/doctors/${id}`, {
      method: 'GET',
    });
  }

  /**
   * Helper to create route params
   */
  function createParams(id: string) {
    return { params: Promise.resolve({ id }) };
  }

  /**
   * Helper to create mock doctor profile
   */
  function createMockDoctorProfile(doctorId: string, overrides: Partial<{
    specialties: string[];
    licenseId: string;
    timezone: string;
  }> = {}) {
    return {
      id: `profile_${doctorId}`,
      doctorId,
      specialties: ['GENERAL'],
      licenseId: 'MD-12345',
      timezone: 'UTC',
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };
  }

  describe('Authentication', () => {
    it('should return 401 when not authenticated', async () => {
      mockGetSession.mockResolvedValue(null);

      const request = createRequest('doctor_1');
      const response = await GET(request, createParams('doctor_1'));

      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('Getting Doctor Details', () => {
    it('should return doctor details with profile', async () => {
      const patient = createMockUser();
      const session = createMockSession(patient);
      mockGetSession.mockResolvedValue(session);

      const doctor = createMockDoctor({ id: 'doctor_1', name: 'Dr. Smith' });
      const doctorWithProfile = {
        ...doctor,
        doctorProfile: createMockDoctorProfile(doctor.id, {
          specialties: ['CARDIOLOGY', 'GENERAL'],
        }),
      };

      prismaMock.user.findFirst.mockResolvedValue(doctorWithProfile as any);

      const request = createRequest('doctor_1');
      const response = await GET(request, createParams('doctor_1'));

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.id).toBe('doctor_1');
      expect(body.name).toBe('Dr. Smith');
      expect(body.doctorProfile).toBeDefined();
      expect(body.doctorProfile.specialties).toContain('CARDIOLOGY');
    });

    it('should return 404 when doctor does not exist', async () => {
      const patient = createMockUser();
      const session = createMockSession(patient);
      mockGetSession.mockResolvedValue(session);

      prismaMock.user.findFirst.mockResolvedValue(null);

      const request = createRequest('non_existent');
      const response = await GET(request, createParams('non_existent'));

      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body.error.code).toBe('NOT_FOUND');
    });

    it('should return 404 when user is not a doctor', async () => {
      const patient = createMockUser();
      const session = createMockSession(patient);
      mockGetSession.mockResolvedValue(session);

      // The route queries with role: DOCTOR, so findFirst returns null when
      // the ID belongs to a non-doctor user
      prismaMock.user.findFirst.mockResolvedValue(null);

      const request = createRequest('user_1');
      const response = await GET(request, createParams('user_1'));

      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('Response Format', () => {
    it('should include all doctor profile fields', async () => {
      const patient = createMockUser();
      const session = createMockSession(patient);
      mockGetSession.mockResolvedValue(session);

      const doctor = createMockDoctor({ id: 'doctor_1' });
      const doctorWithProfile = {
        ...doctor,
        doctorProfile: createMockDoctorProfile(doctor.id, {
          specialties: ['CARDIOLOGY'],
          licenseId: 'MD-12345',
          timezone: 'America/New_York',
        }),
      };

      prismaMock.user.findFirst.mockResolvedValue(doctorWithProfile as any);

      const request = createRequest('doctor_1');
      const response = await GET(request, createParams('doctor_1'));

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.doctorProfile).toHaveProperty('specialties');
      expect(body.doctorProfile).toHaveProperty('timezone');
    });

    it('should include consultation statistics for admin', async () => {
      const admin = createMockAdmin();
      const session = createMockSession(admin);
      mockGetSession.mockResolvedValue(session);

      const doctor = createMockDoctor({ id: 'doctor_1' });
      const doctorWithProfile = {
        ...doctor,
        doctorProfile: createMockDoctorProfile(doctor.id),
        _count: {
          consultationsAsDoctor: 25,
        },
      };

      prismaMock.user.findFirst.mockResolvedValue(doctorWithProfile as any);

      const request = createRequest('doctor_1');
      const response = await GET(request, createParams('doctor_1'));

      expect(response.status).toBe(200);
      const body = await response.json();
      // Admin should see consultation count
      expect(body._count).toBeDefined();
    });
  });
});
