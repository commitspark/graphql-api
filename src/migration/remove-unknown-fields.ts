import { EntryDraft } from '@commitspark/git-adapter'
import { makeExecutableSchema } from '@graphql-tools/schema'
import { RequestContext } from '../client.ts'
import { CommitInput } from '../graphql/resolvers/types.ts'
import { generateSchemaFromString } from '../graphql/schema-generator.ts'
import { validateEntry } from '../validation/entry-validator.ts'
import { ViolationCode } from '../validation/violation.ts'
import { migrate, MigrationResponse } from './migrate.ts'

/**
 * Removes all data stored under keys that are not fields in the schema, i.e. data reported as `UNKNOWN_FIELD` by
 * `validate()`, and all metadata except the entry type, in a single commit.
 */
export async function removeUnknownFields(
  context: RequestContext,
  commit?: CommitInput,
): Promise<MigrationResponse> {
  return migrate(
    context,
    (snapshot) => {
      const generatedSchema = makeExecutableSchema(
        generateSchemaFromString(context, snapshot.schema),
      )
      const getEntryType = (id: string) =>
        snapshot.entries.get(id)?.metadata.type

      const entries: EntryDraft[] = []
      for (const entry of snapshot.entries.values()) {
        const unknownFieldPaths = validateEntry(
          generatedSchema,
          entry,
          getEntryType,
        )
          .filter((violation) => violation.code === ViolationCode.UNKNOWN_FIELD)
          .map((violation) => violation.path)
        const hasUnknownMetadata = Object.keys(entry.metadata).some(
          (key) => key !== 'type',
        )
        if (unknownFieldPaths.length === 0 && !hasUnknownMetadata) {
          continue
        }
        // the snapshot holds copies of the entries, so they can be changed in place
        for (const path of unknownFieldPaths) {
          removeValueAtPath(entry.data, path)
        }
        entries.push({
          ...entry,
          metadata: { type: entry.metadata.type },
          deletion: false,
        })
      }
      return { entries, commit }
    },
    'Remove unknown fields',
  )
}

function removeValueAtPath(data: unknown, path: (string | number)[]): void {
  let parent = data as Record<string | number, unknown>
  for (const segment of path.slice(0, -1)) {
    parent = parent[segment] as Record<string | number, unknown>
  }
  delete parent[path[path.length - 1]]
}
