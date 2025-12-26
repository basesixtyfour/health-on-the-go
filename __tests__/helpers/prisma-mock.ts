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
    upsert: jest.Mock;
  };
  payment: {
    create: jest.Mock;
    findUnique: jest.Mock;
    findFirst: jest.Mock;
    update: jest.Mock;
  };
  videoSession: {
    create: jest.Mock;
    findUnique: jest.Mock;
    findFirst: jest.Mock;
    update: jest.Mock;
  };
  $transaction: jest.Mock;
  $queryRaw: jest.Mock;
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
    upsert: jest.fn(),
  },
  payment: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  videoSession: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  $transaction: jest.fn(),
  $queryRaw: jest.fn(),
};

// Mock the Prisma module
jest.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
}));

/**
 * Reset all mocks to their initial state
 */
export function resetPrismaMock() {
  Object.values(prismaMock).forEach((mockObj) => {
    if (typeof mockObj === 'object' && mockObj !== null) {
      Object.values(mockObj).forEach((mockFn) => {
        if (jest.isMockFunction(mockFn)) {
          mockFn.mockReset();
        }
      });
    }
  });
}

/**
 * Setup common mock responses
 */
export function setupPrismaMock() {
  // Setup default $transaction behavior
  prismaMock.$transaction.mockImplementation(async (callback: any) => {
    if (typeof callback === 'function') {
      return await callback(prismaMock);
    }
    return Promise.all(callback);
  });
}
