/**
 * Shared types and enums for test helpers
 * This file exists to break circular dependencies between auth-mock.ts and factories.ts
 */

// Define enums locally to match Prisma schema (avoids import issues in tests)
export enum UserRole {
  PATIENT = 'PATIENT',
  DOCTOR = 'DOCTOR',
  ADMIN = 'ADMIN',
}

export enum ConsultationStatus {
  CREATED = 'CREATED',
  PAYMENT_PENDING = 'PAYMENT_PENDING',
  PAID = 'PAID',
  IN_CALL = 'IN_CALL',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED',
  PAYMENT_FAILED = 'PAYMENT_FAILED',
}

/**
 * Mock session user for testing
 */
export interface MockSessionUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  emailVerified: boolean;
  image: string | null;
  createdAt: Date;
  updatedAt: Date;
  doctorProfile?: any; // Allow mocking doctor details
}
