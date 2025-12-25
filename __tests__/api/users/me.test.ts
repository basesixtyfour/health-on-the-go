/**
 * Tests for GET /api/v1/users/me
 *
 * TDD: These tests verify the current user profile endpoint.
 */

import { NextRequest } from "next/server";
import {
  createMockUser,
  createMockDoctor,
  createMockAdmin,
  resetFactories,
  UserRole,
} from "../../helpers/factories";
import { createMockSession } from "../../helpers/auth-mock";
import {
  prismaMock,
  resetPrismaMock,
  setupPrismaMock,
} from "../../helpers/prisma-mock";

// Mock auth module
const mockGetSession = jest.fn();
jest.mock("@/auth", () => ({
  auth: {
    api: {
      getSession: (...args: unknown[]) => mockGetSession(...args),
    },
  },
}));

// Import route handler after mocks are set up
import { GET, PATCH } from "@/app/api/v1/users/me/route";

describe("GET /api/v1/users/me", () => {
  beforeEach(() => {
    resetFactories();
    resetPrismaMock();
    setupPrismaMock();
    mockGetSession.mockReset();
  });

  /**
   * Helper to create a mock GET request
   */
  function createGetRequest(): NextRequest {
    return new NextRequest("http://localhost:3000/api/v1/users/me", {
      method: "GET",
    });
  }

  describe("Authentication", () => {
    it("should return 401 when not authenticated", async () => {
      mockGetSession.mockResolvedValue(null);

      const request = createGetRequest();
      const response = await GET(request);

      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.error.code).toBe("UNAUTHORIZED");
    });
  });

  describe("Getting Profile", () => {
    it("should return current user profile", async () => {
      const user = createMockUser({
        id: "user_1",
        name: "John Doe",
        email: "john@example.com",
      });
      const session = createMockSession(user);
      mockGetSession.mockResolvedValue(session);

      prismaMock.user.findUnique.mockResolvedValue(user as any);

      const request = createGetRequest();
      const response = await GET(request);

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.id).toBe("user_1");
      expect(body.name).toBe("John Doe");
      expect(body.email).toBe("john@example.com");

      // SECURITY: Verify query is scoped to authenticated user
      expect(prismaMock.user.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: user.id },
        })
      );
    });

    it("should return doctor profile for doctors", async () => {
      const doctor = createMockDoctor({ id: "doctor_1", name: "Dr. Smith" });
      const session = createMockSession(doctor);
      mockGetSession.mockResolvedValue(session);

      const doctorWithProfile = {
        ...doctor,
        doctorProfile: {
          id: "profile_1",
          doctorId: doctor.id,
          specialties: ["CARDIOLOGY"],
          licenseId: "MD-12345",
          timezone: "UTC",
        },
      };

      prismaMock.user.findUnique.mockResolvedValue(doctorWithProfile as any);

      const request = createGetRequest();
      const response = await GET(request);

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.role).toBe(UserRole.DOCTOR);
      expect(body.doctorProfile).toBeDefined();
      expect(body.doctorProfile.specialties).toContain("CARDIOLOGY");

      // SECURITY: Verify query is scoped to authenticated user and includes doctorProfile
      expect(prismaMock.user.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: doctor.id },
          include: expect.objectContaining({
            doctorProfile: true,
          }),
        })
      );
    });

    it("should return admin flag for admin users", async () => {
      const admin = createMockAdmin({ id: "admin_1" });
      const session = createMockSession(admin);
      mockGetSession.mockResolvedValue(session);

      prismaMock.user.findUnique.mockResolvedValue(admin as any);

      const request = createGetRequest();
      const response = await GET(request);

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.role).toBe(UserRole.ADMIN);
    });
  });

  describe("Security", () => {
    it("should only return data for authenticated user, not other users", async () => {
      const user = createMockUser({ id: "user_1" });
      const session = createMockSession(user);
      mockGetSession.mockResolvedValue(session);

      // Even if database returns another user's data, the query should be scoped correctly
      const otherUser = createMockUser({
        id: "other_user",
        name: "Other User",
      });
      prismaMock.user.findUnique.mockResolvedValue(otherUser as any);

      const request = createGetRequest();
      const response = await GET(request);

      // SECURITY: Verify query was scoped to authenticated user, not the returned data
      expect(prismaMock.user.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: user.id }, // Must query by authenticated user's ID
        })
      );

      // Note: If implementation is correct, it should return 404 or the user's own data
      // This test ensures the WHERE clause is correct regardless of what's returned
    });
  });

  describe("Response Format", () => {
    it("should include expected user fields", async () => {
      const user = createMockUser();
      const session = createMockSession(user);
      mockGetSession.mockResolvedValue(session);

      prismaMock.user.findUnique.mockResolvedValue(user as any);

      const request = createGetRequest();
      const response = await GET(request);

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toHaveProperty("id");
      expect(body).toHaveProperty("name");
      expect(body).toHaveProperty("email");
      expect(body).toHaveProperty("role");
      expect(body).toHaveProperty("emailVerified");
      expect(body).toHaveProperty("image");
      expect(body).toHaveProperty("createdAt");
    });

    it("should not expose sensitive session data", async () => {
      const user = createMockUser();
      const session = createMockSession(user);
      mockGetSession.mockResolvedValue(session);

      prismaMock.user.findUnique.mockResolvedValue(user as any);

      const request = createGetRequest();
      const response = await GET(request);

      expect(response.status).toBe(200);
      const body = await response.json();
      // Should not expose session tokens or internal IDs
      expect(body).not.toHaveProperty("sessions");
      expect(body).not.toHaveProperty("accounts");
    });
  });
});

describe("PATCH /api/v1/users/me", () => {
  beforeEach(() => {
    resetFactories();
    resetPrismaMock();
    setupPrismaMock();
    mockGetSession.mockReset();
  });

  /**
   * Helper to create a mock PATCH request
   */
  function createPatchRequest(body: object): NextRequest {
    return new NextRequest("http://localhost:3000/api/v1/users/me", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  }

  describe("Authentication", () => {
    it("should return 401 when not authenticated", async () => {
      mockGetSession.mockResolvedValue(null);

      const request = createPatchRequest({ name: "New Name" });
      const response = await PATCH(request);

      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.error.code).toBe("UNAUTHORIZED");
    });
  });

  describe("Updating Profile", () => {
    it("should update user name", async () => {
      const user = createMockUser({ id: "user_1", name: "Old Name" });
      const session = createMockSession(user);
      mockGetSession.mockResolvedValue(session);

      prismaMock.user.update.mockResolvedValue({
        ...user,
        name: "New Name",
      } as any);

      const request = createPatchRequest({ name: "New Name" });
      const response = await PATCH(request);

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.name).toBe("New Name");

      // SECURITY: Verify update is scoped to authenticated user only
      expect(prismaMock.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: user.id },
          data: expect.objectContaining({
            name: "New Name",
          }),
        })
      );
    });

    it("should update user image", async () => {
      const user = createMockUser({ id: "user_1" });
      const session = createMockSession(user);
      mockGetSession.mockResolvedValue(session);

      const newImageUrl = "https://example.com/new-avatar.jpg";
      prismaMock.user.update.mockResolvedValue({
        ...user,
        image: newImageUrl,
      } as any);

      const request = createPatchRequest({ image: newImageUrl });
      const response = await PATCH(request);

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.image).toBe(newImageUrl);
    });

    it("should not allow updating email", async () => {
      const user = createMockUser({ id: "user_1", email: "old@example.com" });
      const session = createMockSession(user);
      mockGetSession.mockResolvedValue(session);

      const request = createPatchRequest({ email: "new@example.com" });
      const response = await PATCH(request);

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error.code).toBe("VALIDATION_ERROR");
    });

    it("should not allow updating role", async () => {
      const user = createMockUser({ id: "user_1", role: UserRole.PATIENT });
      const session = createMockSession(user);
      mockGetSession.mockResolvedValue(session);

      const request = createPatchRequest({ role: "ADMIN" });
      const response = await PATCH(request);

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error.code).toBe("VALIDATION_ERROR");
    });
  });

  describe("Doctor Profile Updates", () => {
    it("should allow doctor to update their specialties", async () => {
      const doctor = createMockDoctor({ id: "doctor_1" });
      const session = createMockSession(doctor);
      mockGetSession.mockResolvedValue(session);

      const doctorWithProfile = {
        ...doctor,
        doctorProfile: {
          id: "profile_1",
          doctorId: doctor.id,
          specialties: ["CARDIOLOGY", "GENERAL"],
          licenseId: "MD-12345",
          timezone: "UTC",
        },
      };

      prismaMock.user.findUnique.mockResolvedValue(doctorWithProfile as any);
      prismaMock.doctorProfile.update.mockResolvedValue({
        ...doctorWithProfile.doctorProfile,
        specialties: ["CARDIOLOGY", "DERMATOLOGY"],
      } as any);

      const request = createPatchRequest({
        doctorProfile: {
          specialties: ["CARDIOLOGY", "DERMATOLOGY"],
        },
      });
      const response = await PATCH(request);

      expect(response.status).toBe(200);

      // SECURITY: Verify user lookup is scoped to authenticated doctor
      expect(prismaMock.user.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: doctor.id },
          include: expect.objectContaining({
            doctorProfile: true,
          }),
        })
      );

      // SECURITY: Verify doctor profile update is scoped to authenticated doctor's profile
      expect(prismaMock.doctorProfile.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { doctorId: doctor.id },
          data: expect.objectContaining({
            specialties: ["CARDIOLOGY", "DERMATOLOGY"],
          }),
        })
      );
    });

    it("should allow doctor to update their timezone", async () => {
      const doctor = createMockDoctor({ id: "doctor_1" });
      const session = createMockSession(doctor);
      mockGetSession.mockResolvedValue(session);

      const doctorWithProfile = {
        ...doctor,
        doctorProfile: {
          id: "profile_1",
          doctorId: doctor.id,
          specialties: ["CARDIOLOGY"],
          licenseId: "MD-12345",
          timezone: "UTC",
        },
      };

      prismaMock.user.findUnique.mockResolvedValue(doctorWithProfile as any);
      prismaMock.doctorProfile.update.mockResolvedValue({
        ...doctorWithProfile.doctorProfile,
        timezone: "America/New_York",
      } as any);

      const request = createPatchRequest({
        doctorProfile: {
          timezone: "America/New_York",
        },
      });
      const response = await PATCH(request);

      expect(response.status).toBe(200);

      // SECURITY: Verify doctor profile update is scoped to authenticated doctor's profile
      expect(prismaMock.doctorProfile.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { doctorId: doctor.id },
          data: expect.objectContaining({
            timezone: "America/New_York",
          }),
        })
      );
    });

    it("should not allow patient to update doctor profile fields", async () => {
      const patient = createMockUser({
        id: "patient_1",
        role: UserRole.PATIENT,
      });
      const session = createMockSession(patient);
      mockGetSession.mockResolvedValue(session);

      prismaMock.user.findUnique.mockResolvedValue(patient as any);

      const request = createPatchRequest({
        doctorProfile: {
          specialties: ["CARDIOLOGY"],
        },
      });
      const response = await PATCH(request);

      expect(response.status).toBe(403);
      const body = await response.json();
      expect(body.error.code).toBe("FORBIDDEN");
    });

    it("should not allow updating other users profiles", async () => {
      const user = createMockUser({ id: "user_1" });
      const session = createMockSession(user);
      mockGetSession.mockResolvedValue(session);

      prismaMock.user.findUnique.mockResolvedValue(user as any);
      prismaMock.user.update.mockResolvedValue({
        ...user,
        name: "Hacked Name",
      } as any);

      const request = createPatchRequest({ name: "Hacked Name" });
      const response = await PATCH(request);

      // SECURITY: Verify update is scoped to authenticated user only
      // Even if the request somehow includes another user ID, the WHERE clause must use session.user.id
      expect(prismaMock.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: user.id }, // Must use authenticated user's ID, not any ID from request
        })
      );
    });
  });

  describe("Validation", () => {
    it("should validate name length", async () => {
      const user = createMockUser();
      const session = createMockSession(user);
      mockGetSession.mockResolvedValue(session);

      const request = createPatchRequest({ name: "" }); // Empty name
      const response = await PATCH(request);

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error.code).toBe("VALIDATION_ERROR");
    });

    it("should validate image URL format", async () => {
      const user = createMockUser();
      const session = createMockSession(user);
      mockGetSession.mockResolvedValue(session);

      const request = createPatchRequest({ image: "not-a-valid-url" });
      const response = await PATCH(request);

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error.code).toBe("VALIDATION_ERROR");
    });
  });
});
