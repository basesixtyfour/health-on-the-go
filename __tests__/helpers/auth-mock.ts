import { UserRole } from './factories';

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
}

/**
 * Creates a mock session object for testing
 */
export function createMockSession(user: MockSessionUser) {
  return {
    user,
    session: {
      id: `session_${user.id}`,
      userId: user.id,
      token: `token_${user.id}`,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  };
}

/**
 * Mock the auth.api.getSession function
 */
export function mockGetSession(session: ReturnType<typeof createMockSession> | null) {
  const mockAuth = {
    api: {
      getSession: jest.fn().mockResolvedValue(session),
    },
  };

  jest.mock('@/auth', () => ({
    auth: mockAuth,
  }));

  return mockAuth;
}

/**
 * Create mock headers for authenticated requests
 */
export function createAuthHeaders(sessionToken: string = 'test-session-token') {
  return new Headers({
    'Content-Type': 'application/json',
    Cookie: `better-auth.session_token=${sessionToken}`,
  });
}
