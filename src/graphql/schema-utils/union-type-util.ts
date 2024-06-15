import { Entry } from '../../persistence/persistence.service'

export class UnionTypeUtil {
  public getUnionTypeNameFromFieldValue(fieldValue: any): string {
    if (typeof fieldValue !== 'object') {
      throw new Error('Expected object as union value')
    }

    // Based on our @oneOf directive, we expect only one field whose name
    // corresponds to the concrete type's name.
    const firstKey = Object.keys(fieldValue)[0]
    return firstKey.slice(0, 1).toUpperCase() + firstKey.slice(1)
  }

  public getUnionValue(fieldValue: any): Entry {
    if (typeof fieldValue !== 'object') {
      throw new Error('Expected object as union value')
    }

    const firstKey = Object.keys(fieldValue)[0]
    return fieldValue[firstKey]
  }
}
