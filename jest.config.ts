/*
 * For a detailed explanation regarding each configuration property and type check, visit:
 * https://jestjs.io/docs/configuration
 */
import type { Config } from 'jest'

const jestConfig: Config = {
  moduleFileExtensions: ['js', 'ts'],
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
  },
  moduleNameMapper: {
    // must match `tsconfig.json` compilerOptions.paths
    // see also https://kulshekhar.github.io/ts-jest/docs/getting-started/paths-mapping/
    '^@/(.*)$': '<rootDir>/src/$1',
  },
}

export default jestConfig
