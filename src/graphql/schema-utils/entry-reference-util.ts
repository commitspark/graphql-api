import {
  GraphQLNullableType,
  GraphQLObjectType,
  isListType,
  isNonNullType,
  isObjectType,
  isUnionType,
} from 'graphql'
import { ApolloContext } from '../../app/api.service'
import { GraphQLError } from 'graphql/error/GraphQLError'
import { PersistenceService } from '../../persistence/persistence.service'
import { UnionTypeUtil } from './union-type-util'
import { EntryTypeUtil } from './entry-type-util'

export class EntryReferenceUtil {
  constructor(
    private readonly persistence: PersistenceService,
    private readonly entryTypeUtil: EntryTypeUtil,
    private readonly unionTypeUtil: UnionTypeUtil,
  ) {}

  public isPermittedReferenceType(
    referencedTypeName: string,
    fieldType: GraphQLNullableType,
  ): boolean {
    if (isNonNullType(fieldType)) {
      return this.isPermittedReferenceType(referencedTypeName, fieldType.ofType)
    } else if (isListType(fieldType)) {
      return this.isPermittedReferenceType(referencedTypeName, fieldType.ofType)
    } else if (isUnionType(fieldType)) {
      return fieldType
        .getTypes()
        .map((concreteType) => concreteType.name)
        .includes(referencedTypeName)
    } else if (isObjectType(fieldType)) {
      return fieldType.name === referencedTypeName
    }
    return false
  }

  public async getReferencedEntryIds(
    rootType: GraphQLObjectType,
    context: ApolloContext,
    type: GraphQLNullableType,
    data: any,
  ): Promise<string[]> {
    if (isNonNullType(type)) {
      return this.getReferencedEntryIds(rootType, context, type.ofType, data)
    } else if (isListType(type)) {
      let referencedEntryIds: string[] = []
      for (const element of data) {
        referencedEntryIds = [
          ...referencedEntryIds,
          ...(await this.getReferencedEntryIds(
            rootType,
            context,
            type.ofType,
            element,
          )),
        ]
      }
      // deduplicate
      referencedEntryIds = [...new Set(referencedEntryIds)]
      return referencedEntryIds
    } else if (isUnionType(type)) {
      if (this.entryTypeUtil.isUnionOfEntryTypes(type)) {
        await this.validateReference(context, '', type, data)
        return [data.id]
      }

      const unionTypeName =
        this.unionTypeUtil.getUnionTypeNameFromFieldValue(data)
      const unionType = type
        .getTypes()
        .find((type) => type.name === unionTypeName)
      if (!unionType) {
        throw new Error(
          `Type "${unionTypeName}" found in field data is not a valid type for union type "${type.name}".`,
        )
      }
      const unionValue = this.unionTypeUtil.getUnionValue(data)
      return this.getReferencedEntryIds(
        rootType,
        context,
        unionType,
        unionValue,
      )
    } else if (isObjectType(type)) {
      if (
        type.name !== rootType.name &&
        this.entryTypeUtil.hasEntryDirective(type)
      ) {
        await this.validateReference(context, type.name, type, data)
        return [data.id]
      } else {
        let referencedEntryIds: string[] = []
        for (const [fieldsKey, field] of Object.entries(type.getFields())) {
          const fieldValue = data[fieldsKey] ?? undefined
          if (fieldValue !== undefined) {
            const nestedResult = await this.getReferencedEntryIds(
              rootType,
              context,
              field.type,
              fieldValue,
            )
            referencedEntryIds = [...referencedEntryIds, ...nestedResult]
          }
        }
        // deduplicate
        referencedEntryIds = [...new Set(referencedEntryIds)]
        return referencedEntryIds
      }
    }

    return []
  }

  private async validateReference(
    context: ApolloContext,
    fieldName: string,
    fieldType: GraphQLNullableType,
    fieldValue: any,
  ): Promise<void> {
    if (isNonNullType(fieldType)) {
      await this.validateReference(
        context,
        fieldName,
        fieldType.ofType,
        fieldValue,
      )
      return
    } else if (isListType(fieldType)) {
      if (!Array.isArray(fieldValue)) {
        throw new Error(`Expected array value in field "${fieldName}"`)
      }
      for (const fieldListElement of fieldValue) {
        await this.validateReference(
          context,
          fieldName,
          fieldType.ofType,
          fieldListElement,
        )
      }
      return
    } else if (isUnionType(fieldType) || isObjectType(fieldType)) {
      if (!('id' in fieldValue)) {
        throw new Error('Expected key "id"')
      }
      const referencedId = fieldValue.id
      const referencedTypeName = await this.persistence.getTypeById(
        context.gitAdapter,
        context.getCurrentRef(),
        referencedId,
      )
      if (referencedTypeName === undefined) {
        throw new GraphQLError(
          `Reference with id "${referencedId}" points to non-existing entry`,
          {
            extensions: {
              code: 'BAD_USER_INPUT',
              fieldName: fieldName,
            },
          },
        )
      }
      if (!this.isPermittedReferenceType(referencedTypeName, fieldType)) {
        throw new GraphQLError(
          `Reference with id "${referencedId}" points to entry of incompatible type`,
          {
            extensions: {
              code: 'BAD_USER_INPUT',
              fieldName: fieldName,
            },
          },
        )
      }
    }
  }
}
