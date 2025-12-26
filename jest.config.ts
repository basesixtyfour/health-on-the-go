import type { Config } from 'jest';
import nextJest from 'next/jest.js';


// Ensure environment variables are set before any imports
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.BETTER_AUTH_SECRET = 'test-secret-for-jest';
process.env.BETTER_AUTH_URL = 'http://localhost:3000';
// Avoid actual Square token requirement if any
process.env.SQUARE_ACCESS_TOKEN = 'mock-token';
process.env.GOOGLE_CLIENT_ID = 'mock-google-id';
process.env.GOOGLE_CLIENT_SECRET = 'mock-google-secret';
process.env.SQUARE_LOCATION_ID = 'mock-location-id';

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files
  dir: './',
});

const config: Config = {
  displayName: 'health-on-the-go',
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/__tests__/helpers/setup.ts'],
  testMatch: ['**/__tests__/**/*.test.{ts,tsx}'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  clearMocks: true,
  collectCoverageFrom: [
    'app/api/**/*.ts',
    '!app/api/**/route.ts', // Exclude route handlers from coverage initially
  ],
  coverageDirectory: 'coverage',
  verbose: true,
};

export default createJestConfig(config);
