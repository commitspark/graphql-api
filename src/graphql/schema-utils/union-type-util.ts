import { EntryData } from '@commitspark/git-adapter'

export class UnionTypeUtil {
  public getUnionTypeNameFromFieldValue(fieldValue: any): string {
    if (typeof fieldValue !== 'object') {
      throw new Error('Expected object as union value')
    }

    // Based on our @oneOf directive, we expect only one field whose name
    // corresponds to the concrete type's name.
    return Object.keys(fieldValue)[0]
  }

  public getUnionValue(fieldValue: any): EntryData {
    if (typeof fieldValue !== 'object') {
      throw new Error('Expected object as union value')
    }

    const firstKey = Object.keys(fieldValue)[0]
    return fieldValue[firstKey]
  }
}
