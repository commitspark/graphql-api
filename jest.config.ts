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
  // relative ".ts" imports are rewritten to ".js" by TypeScript's rewriteRelativeImportExtensions
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
}

export default jestConfig
