/**
 * Prisma mock for unit testing
 * Creates a mock Prisma client without needing the actual generated client
 */

// Define a mock Prisma client type
export interface MockPrismaClient {
  consultation: {
    create: jest.Mock;
    findMany: jest.Mock;
    findUnique: jest.Mock;
    update: jest.Mock;
    count: jest.Mock;
  };
  patientIntake: {
    create: jest.Mock;
    findUnique: jest.Mock;
    upsert: jest.Mock;
  };
  auditEvent: {
    create: jest.Mock;
    findMany: jest.Mock;
  };
  user: {
    findUnique: jest.Mock;
    findFirst: jest.Mock;
    findMany: jest.Mock;
    update: jest.Mock;
    count: jest.Mock;
  };
  doctorProfile: {
    findUnique: jest.Mock;
    findFirst: jest.Mock;
    findMany: jest.Mock;
    update: jest.Mock;
    count: jest.Mock;
  };
  payment: {
    create: jest.Mock;
    findUnique: jest.Mock;
    findFirst: jest.Mock;
    update: jest.Mock;
  };
  $transaction: jest.Mock;
}

// Create a deep mock of PrismaClient
export const prismaMock: MockPrismaClient = {
  consultation: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  patientIntake: {
    create: jest.fn(),
    findUnique: jest.fn(),
    upsert: jest.fn(),
  },
  auditEvent: {
    create: jest.fn(),
    findMany: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  doctorProfile: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  payment: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  $transaction: jest.fn(),
};

// Module mock - this will be used when the actual route is implemented
jest.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
}));

/**
 * Reset all mocks between tests
 */
export function resetPrismaMock() {
  Object.values(prismaMock.consultation).forEach(mock => mock.mockReset());
  Object.values(prismaMock.patientIntake).forEach(mock => mock.mockReset());
  Object.values(prismaMock.auditEvent).forEach(mock => mock.mockReset());
  Object.values(prismaMock.user).forEach(mock => mock.mockReset());
  Object.values(prismaMock.doctorProfile).forEach(mock => mock.mockReset());
  prismaMock.$transaction.mockReset();
}

/**
 * Setup common Prisma mock behaviors
 */
export function setupPrismaMock() {
  // Default mock for $transaction
  prismaMock.$transaction.mockImplementation(async (callback: any) => {
    if (typeof callback === 'function') {
      return callback(prismaMock);
    }
    return Promise.all(callback);
  });
}
