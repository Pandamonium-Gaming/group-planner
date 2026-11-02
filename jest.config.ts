import type { Config } from 'jest'

// Jest configuration for Next.js project
const config: Config = {
  coverageProvider: 'v8',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    // Handle module aliases (from tsconfig.json)
    '^@/(.*)$': '<rootDir>/src/$1',
    
    // Handle CSS imports (Jest doesn't handle CSS)
    '^.+\\.module\\.(css|sass|scss)$': 'identity-obj-proxy',
    
    // Handle CSS imports (with pure CSS)
    '^.+\\.(css|sass|scss)$': '<rootDir>/__mocks__/styleMock.js',
    
    // Handle image imports
    '^.+\\.(png|jpg|jpeg|gif|webp|avif|ico|bmp|svg)$/i': '<rootDir>/__mocks__/fileMock.js',
  },
  testMatch: [
    '**/__tests__/**/*.test.[jt]s?(x)',
    '**/?(*.)+(spec|test).[jt]s?(x)',
  ],
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.stories.{js,jsx,ts,tsx}',
    '!src/app/**', // Exclude Next.js app directory (mostly layouts/pages)
    '!src/components/**', // Exclude components initially (can add later)
  ],
  coverageThreshold: {
    global: {
      branches: 45,
      functions: 49,
      lines: 32,
      statements: 32,
    },
  },
  transformIgnorePatterns: [
    '/node_modules/',
    '^.+\\.module\\.(css|sass|scss)$',
  ],
  testPathIgnorePatterns: ['<rootDir>/node_modules/', '<rootDir>/.next/'],
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      tsconfig: {
        jsx: 'react',
        rootDir: '.',
        moduleResolution: 'bundler',
        module: 'esnext',
        ignoreDeprecations: '6.0',
      },
    }],
  },
}

export default config

