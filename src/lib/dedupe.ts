/**
 * Keeps the first row for each key.
 *
 * The admin RPCs already return one row per auth user, but this client-side
 * guard means a retry, a future realtime patch, or an accidental duplicate
 * response can never render the same member twice in the table.
 */
export function dedupeByKey<T>(
  rows: readonly T[],
  getKey: (row: T) => string | null | undefined,
): T[] {
  const seen = new Set<string>()
  const unique: T[] = []

  for (const row of rows) {
    const key = getKey(row)
    if (!key || seen.has(key)) continue
    seen.add(key)
    unique.push(row)
  }

  return unique
}
