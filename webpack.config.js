const path = require('node:path')
module.exports = (options, webpack) => {
  return {
    ...options,
    devtool: 'source-map', // create source map for debugging
    externals: [],
    entry: {
      main: './src/index.ts',
    },
    output: {
      ...options.output,
      libraryTarget: 'commonjs2',
    },
    plugins: [
      ...options.plugins,
    ],
    resolve: {
      // @see https://github.com/apollographql/apollo-server/issues/4983
      extensions: ['.ts', '.js'],
      alias: {
        graphql$: path.resolve(__dirname, 'node_modules/graphql/index.js'),
      },
    },
  }
}
