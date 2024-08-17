import {
  GraphQLFieldResolver,
  GraphQLOutputType,
} from 'graphql/type/definition'
import { ApolloContext } from '../../app/api.service'
import { EntryData } from '@commitspark/git-adapter'
import {
  GraphQLField,
  GraphQLObjectType,
  GraphQLSchema,
  isListType,
  isNonNullType,
  isObjectType,
  isUnionType,
} from 'graphql'
import { ResolvedEntryData } from '../field-resolver/fieldResolver'
import { FieldDefaultValueResolver } from '../field-resolver/field-default-value-resolver'

export class ObjectTypeFieldDefaultValueResolverGenerator {
  constructor(
    private readonly fieldDefaultValueResolver: FieldDefaultValueResolver,
  ) {}

  public createResolver(
    schema: GraphQLSchema,
  ): Record<
    string,
    Record<
      string,
      GraphQLFieldResolver<
        any,
        ApolloContext,
        any,
        Promise<ResolvedEntryData<EntryData | EntryData[] | null>>
      >
    >
  > {
    const resolvers: Record<
      string,
      Record<
        string,
        GraphQLFieldResolver<
          any,
          ApolloContext,
          any,
          Promise<ResolvedEntryData<EntryData | EntryData[] | null>>
        >
      >
    > = {}
    for (const typeName of Object.keys(schema.getTypeMap())) {
      const type = schema.getType(typeName)
      if (!isObjectType(type) || type.name.startsWith('__')) {
        continue
      }
      const objectType = type as GraphQLObjectType
      const fieldsForCustomDefaultValueResolver =
        this.getFieldsForCustomDefaultValueResolver(objectType)

      const fieldResolvers: Record<
        string,
        GraphQLFieldResolver<
          any,
          ApolloContext,
          any,
          Promise<ResolvedEntryData<EntryData | EntryData[] | null>>
        >
      > = {}
      for (const field of fieldsForCustomDefaultValueResolver) {
        fieldResolvers[field.name] = (
          obj,
          args,
          context,
          info,
        ): Promise<ResolvedEntryData<EntryData | EntryData[] | null>> =>
          this.fieldDefaultValueResolver.resolve(
            field.name in obj ? obj[field.name] : undefined,
            args,
            {
              gitAdapter: context.gitAdapter,
              getCurrentRef: context.getCurrentRef,
            },
            info,
          )
      }

      if (Object.keys(fieldResolvers).length > 0) {
        resolvers[typeName] = fieldResolvers
      }
    }

    return resolvers
  }

  private getFieldsForCustomDefaultValueResolver(
    objectType: GraphQLObjectType,
  ): GraphQLField<any, any>[] {
    const fields = []
    for (const fieldsKey in objectType.getFields()) {
      const field: GraphQLField<any, any> = objectType.getFields()[fieldsKey]
      if (this.requiresCustomDefaultValueResolver(field.type)) {
        fields.push(field)
      }
    }
    return fields
  }

  private requiresCustomDefaultValueResolver(type: GraphQLOutputType): boolean {
    if (isNonNullType(type)) {
      return this.requiresCustomDefaultValueResolver(type.ofType)
    } else if (isListType(type)) {
      return true
    } else if (isUnionType(type)) {
      return true
    } else if (isObjectType(type)) {
      return true
    }
    return false
  }
}
