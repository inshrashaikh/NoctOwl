/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: "jsdom",
  modulePathIgnorePatterns: ["<rootDir>/.next/"],
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        tsconfig: {
          jsx: "react-jsx",
        },
      },
    ],
  },
  testMatch: ["**/*.spec.ts", "**/*.spec.tsx"],
  collectCoverageFrom: [
    "src/lib/**/*.ts",
    "src/hooks/**/*.ts",
    "!src/**/*.spec.ts",
    "!src/**/*.spec.tsx",
  ],
  coverageThreshold: {
    global: {
      statements: 60,
      branches: 50,
      functions: 60,
      lines: 60,
    },
  },
};
