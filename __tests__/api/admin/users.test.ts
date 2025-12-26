/**
 * Tests for /api/v1/admin/users endpoints
 * 
 * Tests the admin user management API including:
 * - GET: List all users with pagination and filtering
 * - PATCH: Update user roles and manage doctor profiles
 */

import { NextRequest } from 'next/server';
import {
  createMockUser,
  createMockDoctor,
  createMockAdmin,
  resetFactories,
  UserRole,
} from '../../helpers/factories';
import { createMockSession } from '../../helpers/auth-mock';
import {
  prismaMock,
  resetPrismaMock,
  setupPrismaMock,
} from '../../helpers/prisma-mock';

// Mock auth module
const mockGetSession = jest.fn();
jest.mock('@/lib/auth', () => ({
  auth: {
    api: {
      getSession: (...args: unknown[]) => mockGetSession(...args),
    },
  },
}));

// Import route handlers after mocks are set up
import { GET, PATCH } from '@/app/api/v1/admin/users/route';

describe('GET /api/v1/admin/users', () => {
  beforeEach(() => {
    resetFactories();
    resetPrismaMock();
    setupPrismaMock();
    mockGetSession.mockReset();
  });

  function createGetRequest(params: Record<string, string> = {}): NextRequest {
    const url = new URL('http://localhost:3000/api/v1/admin/users');
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });
    return new NextRequest(url, { method: 'GET' });
  }

  describe('Authentication & Authorization', () => {
    it('should return 401 when not authenticated', async () => {
      mockGetSession.mockResolvedValue(null);

      const request = createGetRequest();
      const response = await GET(request);

      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.error.code).toBe('UNAUTHORIZED');
    });

    it('should return 403 when user is not admin', async () => {
      const patient = createMockUser({ role: UserRole.PATIENT });
      const session = createMockSession(patient);
      mockGetSession.mockResolvedValue(session);

      const request = createGetRequest();
      const response = await GET(request);

      expect(response.status).toBe(403);
      const body = await response.json();
      expect(body.error.code).toBe('FORBIDDEN');
      expect(body.error.message).toContain('Admin access required');
    });

    it('should return 403 when user is a doctor', async () => {
      const doctor = createMockDoctor();
      const session = createMockSession(doctor);
      mockGetSession.mockResolvedValue(session);

      const request = createGetRequest();
      const response = await GET(request);

      expect(response.status).toBe(403);
      const body = await response.json();
      expect(body.error.code).toBe('FORBIDDEN');
    });

    it('should allow admin users to access', async () => {
      const admin = createMockAdmin();
      const session = createMockSession(admin);
      mockGetSession.mockResolvedValue(session);

      prismaMock.user.findMany.mockResolvedValue([]);
      prismaMock.user.count.mockResolvedValue(0);

      const request = createGetRequest();
      const response = await GET(request);

      expect(response.status).toBe(200);
    });
  });

  describe('Pagination', () => {
    it('should return paginated user list with default parameters', async () => {
      const admin = createMockAdmin();
      const session = createMockSession(admin);
      mockGetSession.mockResolvedValue(session);

      const mockUsers = [
        createMockUser({ id: 'user_1', name: 'User 1' }),
        createMockUser({ id: 'user_2', name: 'User 2' }),
      ];

      prismaMock.user.findMany.mockResolvedValue(mockUsers as any);
      prismaMock.user.count.mockResolvedValue(50);

      const request = createGetRequest();
      const response = await GET(request);

      expect(response.status).toBe(200);
      const body = await response.json();
      
      expect(body.data).toHaveLength(2);
      expect(body.meta).toEqual({
        page: 1,
        limit: 20,
        total: 50,
        totalPages: 3,
      });

      expect(prismaMock.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 0,
          take: 20,
        })
      );
    });

    it('should handle custom page and limit parameters', async () => {
      const admin = createMockAdmin();
      const session = createMockSession(admin);
      mockGetSession.mockResolvedValue(session);

      prismaMock.user.findMany.mockResolvedValue([]);
      prismaMock.user.count.mockResolvedValue(100);

      const request = createGetRequest({ page: '3', limit: '10' });
      const response = await GET(request);

      expect(response.status).toBe(200);
      const body = await response.json();
      
      expect(body.meta).toEqual({
        page: 3,
        limit: 10,
        total: 100,
        totalPages: 10,
      });

      expect(prismaMock.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 20,
          take: 10,
        })
      );
    });

    it('should enforce minimum page of 1', async () => {
      const admin = createMockAdmin();
      const session = createMockSession(admin);
      mockGetSession.mockResolvedValue(session);

      prismaMock.user.findMany.mockResolvedValue([]);
      prismaMock.user.count.mockResolvedValue(0);

      const request = createGetRequest({ page: '0' });
      await GET(request);

      expect(prismaMock.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 0, // page 1
        })
      );
    });

    it('should enforce maximum limit of 100', async () => {
      const admin = createMockAdmin();
      const session = createMockSession(admin);
      mockGetSession.mockResolvedValue(session);

      prismaMock.user.findMany.mockResolvedValue([]);
      prismaMock.user.count.mockResolvedValue(0);

      const request = createGetRequest({ limit: '200' });
      await GET(request);

      expect(prismaMock.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 100,
        })
      );
    });
  });

  describe('Filtering', () => {
    it('should filter users by role', async () => {
      const admin = createMockAdmin();
      const session = createMockSession(admin);
      mockGetSession.mockResolvedValue(session);

      prismaMock.user.findMany.mockResolvedValue([]);
      prismaMock.user.count.mockResolvedValue(0);

      const request = createGetRequest({ role: 'DOCTOR' });
      await GET(request);

      expect(prismaMock.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            role: 'DOCTOR',
          }),
        })
      );
    });

    it('should search users by name', async () => {
      const admin = createMockAdmin();
      const session = createMockSession(admin);
      mockGetSession.mockResolvedValue(session);

      prismaMock.user.findMany.mockResolvedValue([]);
      prismaMock.user.count.mockResolvedValue(0);

      const request = createGetRequest({ query: 'John' });
      await GET(request);

      expect(prismaMock.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              { name: { contains: 'John', mode: 'insensitive' } },
              { email: { contains: 'John', mode: 'insensitive' } },
            ],
          }),
        })
      );
    });

    it('should search users by email', async () => {
      const admin = createMockAdmin();
      const session = createMockSession(admin);
      mockGetSession.mockResolvedValue(session);

      const mockUsers = [
        createMockUser({ email: 'john@example.com', name: 'John Doe' }),
      ];

      prismaMock.user.findMany.mockResolvedValue(mockUsers as any);
      prismaMock.user.count.mockResolvedValue(1);

      const request = createGetRequest({ query: 'john@example.com' });
      const response = await GET(request);

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.data).toHaveLength(1);
      expect(body.data[0].email).toBe('john@example.com');
    });

    it('should combine role and query filters', async () => {
      const admin = createMockAdmin();
      const session = createMockSession(admin);
      mockGetSession.mockResolvedValue(session);

      prismaMock.user.findMany.mockResolvedValue([]);
      prismaMock.user.count.mockResolvedValue(0);

      const request = createGetRequest({ role: 'DOCTOR', query: 'Smith' });
      await GET(request);

      expect(prismaMock.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            role: 'DOCTOR',
            OR: expect.arrayContaining([
              expect.objectContaining({ name: expect.objectContaining({ contains: 'Smith' }) }),
            ]),
          }),
        })
      );
    });
  });

  describe('Response Format', () => {
    it('should include doctor profile information for doctors', async () => {
      const admin = createMockAdmin();
      const session = createMockSession(admin);
      mockGetSession.mockResolvedValue(session);

      const doctorUser = {
        ...createMockDoctor({ id: 'doc_1', name: 'Dr. Smith' }),
        doctorProfile: {
          specialties: ['CARDIOLOGY', 'GENERAL'],
          timezone: 'America/New_York',
        },
      };

      prismaMock.user.findMany.mockResolvedValue([doctorUser] as any);
      prismaMock.user.count.mockResolvedValue(1);

      const request = createGetRequest();
      const response = await GET(request);

      expect(response.status).toBe(200);
      const body = await response.json();
      
      expect(body.data[0].doctorProfile).toBeDefined();
      expect(body.data[0].doctorProfile.specialties).toEqual(['CARDIOLOGY', 'GENERAL']);
      expect(body.data[0].doctorProfile.timezone).toBe('America/New_York');
    });

    it('should include expected user fields', async () => {
      const admin = createMockAdmin();
      const session = createMockSession(admin);
      mockGetSession.mockResolvedValue(session);

      const user = createMockUser();
      prismaMock.user.findMany.mockResolvedValue([user] as any);
      prismaMock.user.count.mockResolvedValue(1);

      const request = createGetRequest();
      const response = await GET(request);

      expect(response.status).toBe(200);
      const body = await response.json();
      
      const returnedUser = body.data[0];
      expect(returnedUser).toHaveProperty('id');
      expect(returnedUser).toHaveProperty('name');
      expect(returnedUser).toHaveProperty('email');
      expect(returnedUser).toHaveProperty('role');
      expect(returnedUser).toHaveProperty('createdAt');
      expect(returnedUser).toHaveProperty('emailVerified');
      expect(returnedUser).toHaveProperty('image');
    });

    it('should order users by creation date descending', async () => {
      const admin = createMockAdmin();
      const session = createMockSession(admin);
      mockGetSession.mockResolvedValue(session);

      prismaMock.user.findMany.mockResolvedValue([]);
      prismaMock.user.count.mockResolvedValue(0);

      const request = createGetRequest();
      await GET(request);

      expect(prismaMock.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: 'desc' },
        })
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      const admin = createMockAdmin();
      const session = createMockSession(admin);
      mockGetSession.mockResolvedValue(session);

      prismaMock.user.findMany.mockRejectedValue(new Error('Database connection failed'));

      const request = createGetRequest();
      const response = await GET(request);

      expect(response.status).toBe(500);
      const body = await response.json();
      expect(body.error.code).toBe('INTERNAL_ERROR');
      expect(body.error.message).toContain('Failed to fetch users');
    });
  });
});

describe('PATCH /api/v1/admin/users', () => {
  beforeEach(() => {
    resetFactories();
    resetPrismaMock();
    setupPrismaMock();
    mockGetSession.mockReset();
  });

  function createPatchRequest(body: object): NextRequest {
    return new NextRequest('http://localhost:3000/api/v1/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  describe('Authentication & Authorization', () => {
    it('should return 401 when not authenticated', async () => {
      mockGetSession.mockResolvedValue(null);

      const request = createPatchRequest({ userId: 'user_1', role: 'DOCTOR' });
      const response = await PATCH(request);

      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.error.code).toBe('UNAUTHORIZED');
    });

    it('should return 403 when user is not admin', async () => {
      const patient = createMockUser({ role: UserRole.PATIENT });
      const session = createMockSession(patient);
      mockGetSession.mockResolvedValue(session);

      const request = createPatchRequest({ userId: 'user_1', role: 'DOCTOR' });
      const response = await PATCH(request);

      expect(response.status).toBe(403);
      const body = await response.json();
      expect(body.error.code).toBe('FORBIDDEN');
    });

    it('should allow admin users to update roles', async () => {
      const admin = createMockAdmin();
      const session = createMockSession(admin);
      mockGetSession.mockResolvedValue(session);

      const targetUser = createMockUser({ id: 'user_1' });
      const updatedUser = { ...targetUser, role: UserRole.DOCTOR };

      prismaMock.$transaction.mockImplementation(async (callback: any) => {
        return await callback({
          user: {
            findUnique: jest.fn().mockResolvedValue(targetUser),
            update: jest.fn().mockResolvedValue(updatedUser),
          },
          doctorProfile: {
            upsert: jest.fn().mockResolvedValue({}),
          },
        });
      });

      const request = createPatchRequest({ userId: 'user_1', role: 'DOCTOR', specialty: 'CARDIOLOGY' });
      const response = await PATCH(request);

      expect(response.status).toBe(200);
    });
  });

  describe('Validation', () => {
    it('should require userId', async () => {
      const admin = createMockAdmin();
      const session = createMockSession(admin);
      mockGetSession.mockResolvedValue(session);

      const request = createPatchRequest({ role: 'DOCTOR' });
      const response = await PATCH(request);

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(body.error.message).toContain('userId is required');
    });

    it('should reject invalid JSON', async () => {
      const admin = createMockAdmin();
      const session = createMockSession(admin);
      mockGetSession.mockResolvedValue(session);

      const request = new NextRequest('http://localhost:3000/api/v1/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json{',
      });

      const response = await PATCH(request);

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(body.error.message).toContain('Invalid JSON body');
    });

    it('should return 404 for non-existent user', async () => {
      const admin = createMockAdmin();
      const session = createMockSession(admin);
      mockGetSession.mockResolvedValue(session);

      prismaMock.$transaction.mockImplementation(async (callback: any) => {
        return await callback({
          user: {
            findUnique: jest.fn().mockResolvedValue(null),
          },
        });
      });

      const request = createPatchRequest({ userId: 'nonexistent', role: 'DOCTOR' });
      const response = await PATCH(request);

      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('Role Updates', () => {
    it('should update user role to DOCTOR', async () => {
      const admin = createMockAdmin();
      const session = createMockSession(admin);
      mockGetSession.mockResolvedValue(session);

      const targetUser = createMockUser({ id: 'user_1', role: UserRole.PATIENT });
      const updatedUser = { ...targetUser, role: UserRole.DOCTOR };

      prismaMock.$transaction.mockImplementation(async (callback: any) => {
        return await callback({
          user: {
            findUnique: jest.fn()
              .mockResolvedValueOnce(targetUser) // Initial fetch
              .mockResolvedValueOnce({ ...updatedUser, doctorProfile: null }), // Final fetch
            update: jest.fn().mockResolvedValue({ ...updatedUser, doctorProfile: null }),
          },
          doctorProfile: {
            upsert: jest.fn().mockResolvedValue({
              doctorId: 'user_1',
              specialties: ['GENERAL'],
              timezone: 'UTC',
            }),
          },
        });
      });

      const request = createPatchRequest({ userId: 'user_1', role: 'DOCTOR' });
      const response = await PATCH(request);

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.role).toBe('DOCTOR');
    });

    it('should update user role to PATIENT', async () => {
      const admin = createMockAdmin();
      const session = createMockSession(admin);
      mockGetSession.mockResolvedValue(session);

      const targetUser = createMockDoctor({ id: 'doc_1' });
      const updatedUser = { ...targetUser, role: UserRole.PATIENT };

      prismaMock.$transaction.mockImplementation(async (callback: any) => {
        return await callback({
          user: {
            findUnique: jest.fn()
              .mockResolvedValueOnce(targetUser)
              .mockResolvedValueOnce(updatedUser),
            update: jest.fn().mockResolvedValue(updatedUser),
          },
        });
      });

      const request = createPatchRequest({ userId: 'doc_1', role: 'PATIENT' });
      const response = await PATCH(request);

      expect(response.status).toBe(200);
    });

    it('should skip role update if role not provided', async () => {
      const admin = createMockAdmin();
      const session = createMockSession(admin);
      mockGetSession.mockResolvedValue(session);

      const targetUser = createMockDoctor({ id: 'doc_1' });

      let updateCalled = false;
      prismaMock.$transaction.mockImplementation(async (callback: any) => {
        return await callback({
          user: {
            findUnique: jest.fn()
              .mockResolvedValueOnce({ ...targetUser, doctorProfile: { specialties: ['CARDIOLOGY'] } })
              .mockResolvedValueOnce({ ...targetUser, doctorProfile: { specialties: ['CARDIOLOGY', 'GENERAL'] } }),
            update: jest.fn().mockImplementation(() => {
              updateCalled = true;
              return { ...targetUser, doctorProfile: null };
            }),
          },
          doctorProfile: {
            upsert: jest.fn().mockResolvedValue({
              specialties: ['CARDIOLOGY', 'GENERAL'],
            }),
          },
        });
      });

      const request = createPatchRequest({ userId: 'doc_1', specialty: 'GENERAL' });
      await PATCH(request);

      expect(updateCalled).toBe(false);
    });

    it('should validate role is a valid UserRole', async () => {
      const admin = createMockAdmin();
      const session = createMockSession(admin);
      mockGetSession.mockResolvedValue(session);

      const targetUser = createMockUser({ id: 'user_1' });

      let roleUpdated = false;
      prismaMock.$transaction.mockImplementation(async (callback: any) => {
        return await callback({
          user: {
            findUnique: jest.fn()
              .mockResolvedValueOnce({ ...targetUser, doctorProfile: null })
              .mockResolvedValueOnce({ ...targetUser, doctorProfile: null }),
            update: jest.fn().mockImplementation(() => {
              roleUpdated = true;
              return targetUser;
            }),
          },
        });
      });

      const request = createPatchRequest({ userId: 'user_1', role: 'INVALID_ROLE' });
      await PATCH(request);

      // Should not update role with invalid value
      expect(roleUpdated).toBe(false);
    });
  });

  describe('Doctor Profile Management', () => {
    it('should create doctor profile when promoting to DOCTOR with specialty', async () => {
      const admin = createMockAdmin();
      const session = createMockSession(admin);
      mockGetSession.mockResolvedValue(session);

      const targetUser = createMockUser({ id: 'user_1', role: UserRole.PATIENT });

      let upsertCalled = false;
      let upsertData: any = null;

      prismaMock.$transaction.mockImplementation(async (callback: any) => {
        return await callback({
          user: {
            findUnique: jest.fn()
              .mockResolvedValueOnce({ ...targetUser, doctorProfile: null })
              .mockResolvedValueOnce({
                ...targetUser,
                role: UserRole.DOCTOR,
                doctorProfile: { specialties: ['CARDIOLOGY'], timezone: 'UTC' },
              }),
            update: jest.fn().mockResolvedValue({
              ...targetUser,
              role: UserRole.DOCTOR,
              doctorProfile: null,
            }),
          },
          doctorProfile: {
            upsert: jest.fn().mockImplementation((data) => {
              upsertCalled = true;
              upsertData = data;
              return Promise.resolve({
                doctorId: 'user_1',
                specialties: data.create.specialties,
                timezone: 'UTC',
              });
            }),
          },
        });
      });

      const request = createPatchRequest({
        userId: 'user_1',
        role: 'DOCTOR',
        specialty: 'CARDIOLOGY',
      });
      await PATCH(request);

      expect(upsertCalled).toBe(true);
      expect(upsertData.create.specialties).toContain('CARDIOLOGY');
      expect(upsertData.create.timezone).toBe('UTC');
    });

    it('should add specialty to existing doctor profile', async () => {
      const admin = createMockAdmin();
      const session = createMockSession(admin);
      mockGetSession.mockResolvedValue(session);

      const targetUser = createMockDoctor({ id: 'doc_1' });
      const existingProfile = {
        doctorId: 'doc_1',
        specialties: ['CARDIOLOGY'],
        timezone: 'UTC',
      };

      let updatedSpecialties: string[] = [];

      prismaMock.$transaction.mockImplementation(async (callback: any) => {
        return await callback({
          user: {
            findUnique: jest.fn()
              .mockResolvedValueOnce({ ...targetUser, doctorProfile: existingProfile })
              .mockResolvedValueOnce({
                ...targetUser,
                doctorProfile: { ...existingProfile, specialties: ['CARDIOLOGY', 'DERMATOLOGY'] },
              }),
          },
          doctorProfile: {
            upsert: jest.fn().mockImplementation((data) => {
              updatedSpecialties = data.update.specialties;
              return Promise.resolve({
                ...existingProfile,
                specialties: data.update.specialties,
              });
            }),
          },
        });
      });

      const request = createPatchRequest({
        userId: 'doc_1',
        specialty: 'DERMATOLOGY',
      });
      await PATCH(request);

      expect(updatedSpecialties).toEqual(['CARDIOLOGY', 'DERMATOLOGY']);
    });

    it('should not duplicate specialty if already exists', async () => {
      const admin = createMockAdmin();
      const session = createMockSession(admin);
      mockGetSession.mockResolvedValue(session);

      const targetUser = createMockDoctor({ id: 'doc_1' });
      const existingProfile = {
        doctorId: 'doc_1',
        specialties: ['CARDIOLOGY', 'DERMATOLOGY'],
        timezone: 'UTC',
      };

      let updatedSpecialties: string[] = [];

      prismaMock.$transaction.mockImplementation(async (callback: any) => {
        return await callback({
          user: {
            findUnique: jest.fn()
              .mockResolvedValueOnce({ ...targetUser, doctorProfile: existingProfile })
              .mockResolvedValueOnce({ ...targetUser, doctorProfile: existingProfile }),
          },
          doctorProfile: {
            upsert: jest.fn().mockImplementation((data) => {
              updatedSpecialties = data.update.specialties;
              return Promise.resolve(existingProfile);
            }),
          },
        });
      });

      const request = createPatchRequest({
        userId: 'doc_1',
        specialty: 'CARDIOLOGY',
      });
      await PATCH(request);

      expect(updatedSpecialties).toEqual(['CARDIOLOGY', 'DERMATOLOGY']);
    });

    it('should replace specialties when specialties array is provided', async () => {
      const admin = createMockAdmin();
      const session = createMockSession(admin);
      mockGetSession.mockResolvedValue(session);

      const targetUser = createMockDoctor({ id: 'doc_1' });
      const existingProfile = {
        doctorId: 'doc_1',
        specialties: ['CARDIOLOGY'],
        timezone: 'UTC',
      };

      let replacedSpecialties: string[] = [];

      prismaMock.$transaction.mockImplementation(async (callback: any) => {
        return await callback({
          user: {
            findUnique: jest.fn()
              .mockResolvedValueOnce({ ...targetUser, doctorProfile: existingProfile })
              .mockResolvedValueOnce({
                ...targetUser,
                doctorProfile: { ...existingProfile, specialties: ['PEDIATRICS', 'PSYCHIATRY'] },
              }),
          },
          doctorProfile: {
            upsert: jest.fn().mockImplementation((data) => {
              replacedSpecialties = data.update.specialties;
              return Promise.resolve({
                ...existingProfile,
                specialties: data.update.specialties,
              });
            }),
          },
        });
      });

      const request = createPatchRequest({
        userId: 'doc_1',
        specialties: ['PEDIATRICS', 'PSYCHIATRY'],
      });
      await PATCH(request);

      expect(replacedSpecialties).toEqual(['PEDIATRICS', 'PSYCHIATRY']);
    });

    it('should use GENERAL specialty as default if no specialties provided when creating profile', async () => {
      const admin = createMockAdmin();
      const session = createMockSession(admin);
      mockGetSession.mockResolvedValue(session);

      const targetUser = createMockUser({ id: 'user_1' });

      let createdSpecialties: string[] = [];

      prismaMock.$transaction.mockImplementation(async (callback: any) => {
        return await callback({
          user: {
            findUnique: jest.fn()
              .mockResolvedValueOnce({ ...targetUser, doctorProfile: null })
              .mockResolvedValueOnce({
                ...targetUser,
                role: UserRole.DOCTOR,
                doctorProfile: { specialties: ['GENERAL'], timezone: 'UTC' },
              }),
            update: jest.fn().mockResolvedValue({
              ...targetUser,
              role: UserRole.DOCTOR,
              doctorProfile: null,
            }),
          },
          doctorProfile: {
            upsert: jest.fn().mockImplementation((data) => {
              createdSpecialties = data.create.specialties;
              return Promise.resolve({
                doctorId: 'user_1',
                specialties: data.create.specialties,
                timezone: 'UTC',
              });
            }),
          },
        });
      });

      const request = createPatchRequest({
        userId: 'user_1',
        role: 'DOCTOR',
      });
      await PATCH(request);

      expect(createdSpecialties).toEqual(['GENERAL']);
    });

    it('should prioritize specialties array over specialty field', async () => {
      const admin = createMockAdmin();
      const session = createMockSession(admin);
      mockGetSession.mockResolvedValue(session);

      const targetUser = createMockDoctor({ id: 'doc_1' });
      const existingProfile = {
        doctorId: 'doc_1',
        specialties: ['CARDIOLOGY'],
        timezone: 'UTC',
      };

      let updatedSpecialties: string[] = [];

      prismaMock.$transaction.mockImplementation(async (callback: any) => {
        return await callback({
          user: {
            findUnique: jest.fn()
              .mockResolvedValueOnce({ ...targetUser, doctorProfile: existingProfile })
              .mockResolvedValueOnce({
                ...targetUser,
                doctorProfile: { ...existingProfile, specialties: ['ORTHOPEDICS'] },
              }),
          },
          doctorProfile: {
            upsert: jest.fn().mockImplementation((data) => {
              updatedSpecialties = data.update.specialties;
              return Promise.resolve({
                ...existingProfile,
                specialties: data.update.specialties,
              });
            }),
          },
        });
      });

      const request = createPatchRequest({
        userId: 'doc_1',
        specialty: 'DERMATOLOGY',
        specialties: ['ORTHOPEDICS'],
      });
      await PATCH(request);

      // Should use specialties array, not specialty field
      expect(updatedSpecialties).toEqual(['ORTHOPEDICS']);
    });

    it('should not modify profile for non-DOCTOR roles', async () => {
      const admin = createMockAdmin();
      const session = createMockSession(admin);
      mockGetSession.mockResolvedValue(session);

      const targetUser = createMockUser({ id: 'user_1', role: UserRole.PATIENT });

      let profileUpsertCalled = false;

      prismaMock.$transaction.mockImplementation(async (callback: any) => {
        return await callback({
          user: {
            findUnique: jest.fn()
              .mockResolvedValueOnce({ ...targetUser, doctorProfile: null })
              .mockResolvedValueOnce({ ...targetUser, doctorProfile: null }),
          },
          doctorProfile: {
            upsert: jest.fn().mockImplementation(() => {
              profileUpsertCalled = true;
              return Promise.resolve({});
            }),
          },
        });
      });

      const request = createPatchRequest({
        userId: 'user_1',
        specialty: 'CARDIOLOGY',
      });
      await PATCH(request);

      expect(profileUpsertCalled).toBe(false);
    });
  });

  describe('Response Format', () => {
    it('should return updated user with doctor profile', async () => {
      const admin = createMockAdmin();
      const session = createMockSession(admin);
      mockGetSession.mockResolvedValue(session);

      const targetUser = createMockUser({ id: 'user_1' });
      const doctorProfile = {
        specialties: ['CARDIOLOGY'],
        timezone: 'UTC',
      };

      prismaMock.$transaction.mockImplementation(async (callback: any) => {
        return await callback({
          user: {
            findUnique: jest.fn()
              .mockResolvedValueOnce({ ...targetUser, doctorProfile: null })
              .mockResolvedValueOnce({
                id: 'user_1',
                name: targetUser.name,
                role: UserRole.DOCTOR,
                doctorProfile,
              }),
            update: jest.fn().mockResolvedValue({
              ...targetUser,
              role: UserRole.DOCTOR,
              doctorProfile: null,
            }),
          },
          doctorProfile: {
            upsert: jest.fn().mockResolvedValue(doctorProfile),
          },
        });
      });

      const request = createPatchRequest({
        userId: 'user_1',
        role: 'DOCTOR',
        specialty: 'CARDIOLOGY',
      });
      const response = await PATCH(request);

      expect(response.status).toBe(200);
      const body = await response.json();
      
      expect(body).toHaveProperty('id');
      expect(body).toHaveProperty('name');
      expect(body).toHaveProperty('role');
      expect(body).toHaveProperty('doctorProfile');
      expect(body.doctorProfile.specialties).toContain('CARDIOLOGY');
    });
  });

  describe('Error Handling', () => {
    it('should handle database transaction errors', async () => {
      const admin = createMockAdmin();
      const session = createMockSession(admin);
      mockGetSession.mockResolvedValue(session);

      prismaMock.$transaction.mockRejectedValue(new Error('Transaction failed'));

      const request = createPatchRequest({ userId: 'user_1', role: 'DOCTOR' });
      const response = await PATCH(request);

      expect(response.status).toBe(500);
      const body = await response.json();
      expect(body.error.code).toBe('INTERNAL_ERROR');
      expect(body.error.message).toContain('Failed to update user');
    });

    it('should handle Prisma P2025 error as 404', async () => {
      const admin = createMockAdmin();
      const session = createMockSession(admin);
      mockGetSession.mockResolvedValue(session);

      const error = new Error('Record not found');
      (error as any).code = 'P2025';
      prismaMock.$transaction.mockRejectedValue(error);

      const request = createPatchRequest({ userId: 'nonexistent', role: 'DOCTOR' });
      const response = await PATCH(request);

      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body.error.code).toBe('NOT_FOUND');
      expect(body.error.message).toContain('User not found');
    });
  });
});