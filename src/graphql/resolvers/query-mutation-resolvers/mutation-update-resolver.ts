import {
  assertExpectedVersion,
  findByTypeId,
} from '../../../persistence/persistence.ts'
import { GraphQLObjectType, isObjectType } from 'graphql'
import { EntryData, EntryDraft } from '@commitspark/git-adapter'
import { QueryMutationResolver } from '../types.ts'
import { createError, ErrorCode } from '../../errors.ts'
import { getCommitMessage } from '../commit-message.ts'
import { commitWithRetry } from '../../../persistence/commit-with-retry.ts'
import { assertValidEntryDrafts } from '../../../validation/repository-validator.ts'
import { createEntrySource } from '../entry-data-source.ts'
import { getMergedObjectType } from '../../schema-utils/entry-type-util.ts'

function isDataObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Merges the given data into the stored data. Values of fields holding a single embedded object are merged
 * recursively, all other values given replace the stored value, including lists, unions and references. Keys that are
 * not fields of the type are retained.
 */
function mergeData(
  type: GraphQLObjectType,
  storedData: EntryData,
  updateData: EntryData,
): EntryData {
  const mergedData: Record<string, unknown> = isDataObject(storedData)
    ? { ...storedData }
    : {}
  if (!isDataObject(updateData)) {
    return mergedData
  }
  const fields = type.getFields()
  for (const [key, value] of Object.entries(updateData)) {
    const field = fields[key]
    const mergedType =
      field !== undefined ? getMergedObjectType(field.type) : undefined
    if (
      mergedType !== undefined &&
      isDataObject(value) &&
      isDataObject(mergedData[key])
    ) {
      mergedData[key] = mergeData(mergedType, mergedData[key], value)
    } else {
      mergedData[key] = value
    }
  }
  return mergedData
}

export const mutationUpdateResolver: QueryMutationResolver<EntryData> = async (
  source,
  args,
  context,
  info,
) => {
  if (!isObjectType(context.type)) {
    throw createError(
      `Type "${context.type.name}" cannot be mutated as is not an ObjectType.`,
      ErrorCode.INTERNAL_ERROR,
      {},
    )
  }
  const entryType = context.type
  const commitMessage = getCommitMessage(
    args.commit,
    'Update',
    context.type.name,
    args.id,
  )

  await commitWithRetry(context, async () => {
    const existingEntry = await findByTypeId(
      context,
      context.type.name,
      args.id,
    )
    await assertExpectedVersion(context, args.id, args.expectedVersion)

    const entryDraft: EntryDraft = {
      id: existingEntry.id,
      // other metadata is retained like unknown keys of the data and only removed by `removeUnknownFields()`
      metadata: existingEntry.metadata,
      // unknown keys of the existing data are retained
      data: mergeData(entryType, existingEntry.data ?? null, args.data ?? null),
      deletion: false,
    }
    await assertValidEntryDrafts(context, info.schema, [entryDraft])
    // no commit is made if the update does not change the entry, where no stored data equals an empty object;
    // compared in serialized form, as the stored file also changes if only the order of keys changes
    if (
      JSON.stringify(entryDraft.data) ===
      JSON.stringify(existingEntry.data ?? {})
    ) {
      return undefined
    }

    return {
      ref: context.branch,
      parentSha: context.getCurrentHash(),
      entries: [entryDraft],
      ...commitMessage,
    }
  })

  const updatedEntry = await findByTypeId(context, context.type.name, args.id)
  return createEntrySource(context, info.schema, updatedEntry)
}
