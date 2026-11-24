/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  testMatch: ['**/*.spec.ts', '**/*.test.ts'],
  collectCoverageFrom: [
    'src/db/**/*.ts',
    'src/sync/**/*.ts',
    'src/location/**/*.ts',
    '!src/db/schema.ts',
    '!src/db/migrations.ts',
    '!src/location/permissions.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
};
