module.exports = {
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/test/setup.ts'],
  moduleNameMapper: {
    '^@utils/(.*)$': '<rootDir>/src/utils/$1',
    '^@customTypes/(.*)$': '<rootDir>/src/types/$1',
    '^@constant/(.*)$': '<rootDir>/src/constant/$1',
  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest', {
        tsconfig: '<rootDir>/tsconfig.test.json',
      }],
  },
}
