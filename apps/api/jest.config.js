/** @type {import('jest').Config} */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': ['ts-jest', { tsconfig: { allowJs: true } }],
  },
  transformIgnorePatterns: [
    'node_modules/(?!(@nestjs/(axios|bullmq|bull-shared)|axios)/)',
  ],
  collectCoverageFrom: [
    '**/*.service.ts',
    '**/*.processor.ts',
    '**/*.controller.ts',
    '**/*.gateway.ts',
    '**/*.guard.ts',
    '**/*.strategy.ts',
    '**/*.filter.ts',
    '!prisma/prisma.service.ts',
    '!redis/redis.service.ts',
    '!**/*.spec.ts',
    '!**/*.e2e-spec.ts',
  ],
  coverageDirectory: '../coverage',
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  testEnvironment: 'node',
};
