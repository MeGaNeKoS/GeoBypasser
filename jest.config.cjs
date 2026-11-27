module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/test'],
  testPathIgnorePatterns: ['/node_modules/', '/dist/', '/.chrome-profile/', '/.chrome-cdp-work/'],
  modulePathIgnorePatterns: ['/.chrome-profile/', '/.chrome-cdp-work/'],
  setupFilesAfterEnv: ['<rootDir>/test/setup.ts'],
  moduleNameMapper: {
    '^@utils/(.*)$': '<rootDir>/src/utils/$1',
    '^@core/(.*)$': '<rootDir>/src/core/$1',
    '^@customTypes/(.*)$': '<rootDir>/src/types/$1',
    '^@constant/(.*)$': '<rootDir>/src/constant/$1',
    '^@schemas/(.*)$': '<rootDir>/src/schemas/$1',
  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest', {
        tsconfig: '<rootDir>/tsconfig.test.json',
      }],
  },
}
