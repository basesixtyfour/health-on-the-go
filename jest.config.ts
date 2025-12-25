import type { Config } from 'jest';
import nextJest from 'next/jest.js';

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files
  dir: './',
});

const config: Config = {
  displayName: 'health-on-the-go',
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/__tests__/helpers/setup.ts'],
  testMatch: ['**/__tests__/**/*.test.ts'],
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
