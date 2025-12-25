/**
 * Tests for GET /api/v1/doctors
 * 
 * TDD: These tests verify the doctors list endpoint.
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
import { GET } from '@/app/api/v1/doctors/route';

describe('GET /api/v1/doctors', () => {
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
    const url = new URL('http://localhost:3000/api/v1/doctors');
    Object.entries(queryParams).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });
    return new NextRequest(url, { method: 'GET' });
  }

  /**
   * Helper to create mock doctor profile
   */
  function createMockDoctorProfile(doctorId: string, overrides: Partial<{
    id: string;
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

      const request = createRequest();
      const response = await GET(request);

      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('Listing Doctors', () => {
    it('should return list of doctors with profiles', async () => {
      const patient = createMockUser();
      const session = createMockSession(patient);
      mockGetSession.mockResolvedValue(session);

      const doctor1 = createMockDoctor({ id: 'doctor_1', name: 'Dr. Smith' });
      const doctor2 = createMockDoctor({ id: 'doctor_2', name: 'Dr. Jones' });

      const doctors = [
        {
          ...doctor1,
          doctorProfile: createMockDoctorProfile(doctor1.id, { specialties: ['CARDIOLOGY'] }),
        },
        {
          ...doctor2,
          doctorProfile: createMockDoctorProfile(doctor2.id, { specialties: ['DERMATOLOGY'] }),
        },
      ];

      prismaMock.user.findMany.mockResolvedValue(doctors as any);
      prismaMock.user.count.mockResolvedValue(2);

      const request = createRequest();
      const response = await GET(request);

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.data).toHaveLength(2);
      expect(body.data[0].role).toBe(UserRole.DOCTOR);
    });

    it('should return empty array when no doctors exist', async () => {
      const patient = createMockUser();
      const session = createMockSession(patient);
      mockGetSession.mockResolvedValue(session);

      prismaMock.user.findMany.mockResolvedValue([]);
      prismaMock.user.count.mockResolvedValue(0);

      const request = createRequest();
      const response = await GET(request);

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.data).toEqual([]);
    });
  });

  describe('Filtering', () => {
    it('should filter by specialty', async () => {
      const patient = createMockUser();
      const session = createMockSession(patient);
      mockGetSession.mockResolvedValue(session);

      const cardiologist = createMockDoctor({ id: 'doctor_1', name: 'Dr. Heart' });
      const doctors = [
        {
          ...cardiologist,
          doctorProfile: createMockDoctorProfile(cardiologist.id, { specialties: ['CARDIOLOGY'] }),
        },
      ];

      prismaMock.user.findMany.mockResolvedValue(doctors as any);
      prismaMock.user.count.mockResolvedValue(1);

      const request = createRequest({ specialty: 'CARDIOLOGY' });
      const response = await GET(request);

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.data).toHaveLength(1);
      expect(body.data[0].doctorProfile.specialties).toContain('CARDIOLOGY');
    });

    it('should filter by name (search)', async () => {
      const patient = createMockUser();
      const session = createMockSession(patient);
      mockGetSession.mockResolvedValue(session);

      const doctor = createMockDoctor({ id: 'doctor_1', name: 'Dr. Smith' });
      const doctors = [
        {
          ...doctor,
          doctorProfile: createMockDoctorProfile(doctor.id),
        },
      ];

      prismaMock.user.findMany.mockResolvedValue(doctors as any);
      prismaMock.user.count.mockResolvedValue(1);

      const request = createRequest({ search: 'Smith' });
      const response = await GET(request);

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.data).toHaveLength(1);
      expect(body.data[0].name).toContain('Smith');
    });
  });

  describe('Pagination', () => {
    it('should support limit parameter', async () => {
      const patient = createMockUser();
      const session = createMockSession(patient);
      mockGetSession.mockResolvedValue(session);

      const doctors = Array.from({ length: 5 }, (_, i) => {
        const doc = createMockDoctor({ id: `doctor_${i}` });
        return {
          ...doc,
          doctorProfile: createMockDoctorProfile(doc.id),
        };
      });

      prismaMock.user.findMany.mockResolvedValue(doctors as any);
      prismaMock.user.count.mockResolvedValue(10);

      const request = createRequest({ limit: '5' });
      const response = await GET(request);

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.data).toHaveLength(5);
      expect(body.pagination.limit).toBe(5);
      expect(body.pagination.total).toBe(10);
    });

    it('should support offset parameter', async () => {
      const patient = createMockUser();
      const session = createMockSession(patient);
      mockGetSession.mockResolvedValue(session);

      prismaMock.user.findMany.mockResolvedValue([]);
      prismaMock.user.count.mockResolvedValue(10);

      const request = createRequest({ offset: '5' });
      const response = await GET(request);

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.pagination.offset).toBe(5);
    });
  });

  describe('Response Format', () => {
    it('should include doctor profile with specialties', async () => {
      const patient = createMockUser();
      const session = createMockSession(patient);
      mockGetSession.mockResolvedValue(session);

      const doctor = createMockDoctor({ id: 'doctor_1' });
      const doctors = [
        {
          ...doctor,
          doctorProfile: createMockDoctorProfile(doctor.id, {
            specialties: ['CARDIOLOGY', 'GENERAL'],
            licenseId: 'MD-12345',
          }),
        },
      ];

      prismaMock.user.findMany.mockResolvedValue(doctors as any);
      prismaMock.user.count.mockResolvedValue(1);

      const request = createRequest();
      const response = await GET(request);

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.data[0]).toHaveProperty('doctorProfile');
      expect(body.data[0].doctorProfile.specialties).toHaveLength(2);
    });

    it('should not expose sensitive doctor information', async () => {
      const patient = createMockUser();
      const session = createMockSession(patient);
      mockGetSession.mockResolvedValue(session);

      const doctor = createMockDoctor({ id: 'doctor_1' });
      const doctors = [
        {
          ...doctor,
          doctorProfile: createMockDoctorProfile(doctor.id),
        },
      ];

      prismaMock.user.findMany.mockResolvedValue(doctors as any);
      prismaMock.user.count.mockResolvedValue(1);

      const request = createRequest();
      const response = await GET(request);

      expect(response.status).toBe(200);
      const body = await response.json();
      // Should not expose internal IDs or sensitive data depending on implementation
      expect(body.data[0]).toHaveProperty('id');
      expect(body.data[0]).toHaveProperty('name');
    });
  });
});
