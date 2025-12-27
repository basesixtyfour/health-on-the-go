/**
 * Test factory utilities for creating mock data
 * These avoid direct Prisma imports to prevent module resolution issues in Jest
 */

import { UserRole, ConsultationStatus, MockSessionUser } from './types';

// Re-export for backwards compatibility
export { UserRole, ConsultationStatus };

let idCounter = 0;

/**
 * Generate a unique ID for test entities
 */
function generateId(prefix: string = 'test'): string {
  idCounter++;
  return `${prefix}_${Date.now()}_${idCounter}`;
}

/**
 * Reset the ID counter (call in beforeEach)
 */
export function resetFactories() {
  idCounter = 0;
}

/**
 * Create a mock user
 */
export function createMockUser(overrides: Partial<MockSessionUser> = {}): MockSessionUser {
  const id = generateId('user');
  return {
    id,
    name: 'Test User',
    email: `${id}@test.com`,
    role: UserRole.PATIENT,
    emailVerified: true,
    image: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

/**
 * Create a mock doctor user
 */
export function createMockDoctor(overrides: Partial<MockSessionUser> = {}): MockSessionUser {
  return createMockUser({
    name: 'Dr. Test',
    role: UserRole.DOCTOR,
    ...overrides,
  });
}

/**
 * Create a mock admin user
 */
export function createMockAdmin(overrides: Partial<MockSessionUser> = {}): MockSessionUser {
  return createMockUser({
    name: 'Admin User',
    role: UserRole.ADMIN,
    ...overrides,
  });
}

/**
 * Create a mock consultation
 */
export function createMockConsultation(overrides: Partial<{
  id: string;
  patientId: string;
  doctorId: string | null;
  specialty: string;
  status: ConsultationStatus;
  scheduledStartAt: Date | null;
  startedAt: Date | null;
  endedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  patientIntake: any; // Allow mocking relations
}> = {}) {
  const id = generateId('consult');
  return {
    id,
    patientId: generateId('patient'),
    doctorId: null,
    specialty: 'GENERAL',
    status: ConsultationStatus.CREATED,
    scheduledStartAt: null,
    startedAt: null,
    endedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

/**
 * Create a mock patient intake
 */
export function createMockPatientIntake(consultationId: string, overrides: Partial<{
  id: string;
  nameOrAlias: string;
  ageRange: string;
  chiefComplaint: string;
  consentAcceptedAt: Date;
  createdAt: Date;
}> = {}) {
  return {
    id: generateId('intake'),
    consultationId,
    nameOrAlias: 'Test Patient',
    ageRange: '18-39',
    chiefComplaint: 'Test complaint',
    consentAcceptedAt: new Date(),
    createdAt: new Date(),
    ...overrides,
  };
}

/**
 * Create a mock video session
 */
export function createMockVideoSession(consultationId: string, overrides: Partial<{
  id: string;
  provider: string;
  roomName: string;
  roomUrl: string;
  createdAt: Date;
  endedAt: Date | null;
}> = {}) {
  const roomName = overrides.roomName || `room_${consultationId}`;
  return {
    id: generateId('video'),
    consultationId,
    provider: 'DAILY',
    roomName,
    roomUrl: `https://test.daily.co/${roomName}`,
    createdAt: new Date(),
    endedAt: null,
    ...overrides,
  };
}

/**
 * Valid specialties for testing
 */
export const VALID_SPECIALTIES = [
  'GENERAL',
  'CARDIOLOGY',
  'DERMATOLOGY',
  'PEDIATRICS',
  'PSYCHIATRY',
  'ORTHOPEDICS',
] as const;
