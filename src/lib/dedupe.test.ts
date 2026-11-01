import { describe, expect, it } from 'vitest'
import { dedupeByKey } from './dedupe'

describe('dedupeByKey', () => {
  it('keeps only the first row for each member id', () => {
    const rows = [
      { user_id: 'u-1', name: 'Aarav' },
      { user_id: 'u-2', name: 'Meera' },
      { user_id: 'u-1', name: 'Aarav duplicate' },
      { user_id: 'u-3', name: 'Kabir' },
    ]

    expect(dedupeByKey(rows, (row) => row.user_id)).toEqual([
      { user_id: 'u-1', name: 'Aarav' },
      { user_id: 'u-2', name: 'Meera' },
      { user_id: 'u-3', name: 'Kabir' },
    ])
  })

  it('drops rows with an empty key instead of collapsing them together', () => {
    const rows = [
      { id: '', name: 'Missing id' },
      { id: 'p-1', name: 'Valid' },
      { id: null, name: 'Null id' },
    ]

    expect(dedupeByKey(rows, (row) => row.id)).toEqual([
      { id: 'p-1', name: 'Valid' },
    ])
  })
})
