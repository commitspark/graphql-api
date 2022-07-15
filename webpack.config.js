const path = require('node:path')
module.exports = (options, webpack) => {
  const lazyImports = [
    '@nestjs/microservices/microservices-module',
    '@nestjs/websockets/socket-module',
  ]

  return {
    ...options,
    devtool: 'source-map', // create source map for debugging
    externals: [],
    entry: {
      main: './src/main.ts',
    },
    output: {
      ...options.output,
      libraryTarget: 'commonjs2',
    },
    plugins: [
      ...options.plugins,
      new webpack.IgnorePlugin({
        checkResource(resource) {
          if (lazyImports.includes(resource)) {
            try {
              require.resolve(resource)
            } catch (err) {
              return true
            }
          }
          return false
        },
      }),
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
