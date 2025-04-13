import type { KnipConfig } from 'knip'

const config: KnipConfig = {
  ignoreDependencies: [
    'ts-node', // required for Jest to read `jest.config.ts`
  ],
}

export default config
