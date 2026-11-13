import { RequestContext } from '../../../src/client'
import {
  createEmbeddedSource,
  DataSourceContext,
  getDataSourceContext,
} from '../../../src/graphql/resolvers/entry-data-source'

const createRequestContext = (): RequestContext =>
  ({ dataSourceContexts: new WeakMap() }) as unknown as RequestContext

const entryContext: DataSourceContext = {
  entryId: 'article',
  entryType: 'Article',
  path: [],
  errors: [],
}

describe('Entry data source', () => {
  it('should return the information registered for a source within the same request', () => {
    const context = createRequestContext()
    const source = createEmbeddedSource(
      context,
      entryContext,
      { description: 'Text' },
      ['seo'],
    )

    expect(getDataSourceContext(context, source)).toEqual({
      ...entryContext,
      path: ['seo'],
    })
  })

  it('should not share information about sources between requests', () => {
    const firstRequest = createRequestContext()
    const source = createEmbeddedSource(
      firstRequest,
      entryContext,
      { description: 'Text' },
      ['seo'],
    )

    expect(() => getDataSourceContext(createRequestContext(), source)).toThrow(
      expect.objectContaining({
        extensions: expect.objectContaining({ code: 'INTERNAL_ERROR' }),
      }),
    )
  })

  it('should not modify the data a source is created from', () => {
    const context = createRequestContext()
    const data = { description: 'Text' }
    const source = createEmbeddedSource(context, entryContext, data, ['seo'])

    expect(source).not.toBe(data)
    expect(() => getDataSourceContext(context, data)).toThrow()
  })
})
