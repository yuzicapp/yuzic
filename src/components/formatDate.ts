/**
 * Shared date formatting for the app.
 *
 * Two shapes:
 * - short: "Jan 5, 2026" — for options sheets where space is tight
 * - long: toLocaleDateString() — for shares and podcasts where the full date reads better
 *
 * Four-digit years pass through unchanged (they are already display strings).
 */
export function formatDate(
  value: string | number | Date | undefined,
  options?: { short?: boolean; fallback?: string }
): string {
  const { short = false, fallback = '' } = options ?? {}
  if (!value) return fallback

  // A bare 4-digit year is already a display string — "2026" reads fine as-is.
  if (typeof value === 'string' && /^\d{4}$/.test(value.trim())) return value

  const d = value instanceof Date ? value : new Date(value)
  if (isNaN(d.getTime())) return fallback

  if (short) {
    const year = d.getFullYear()
    const month = d.toLocaleString('default', { month: 'short' })
    const day = d.getDate()
    return `${month} ${day}, ${year}`
  }

  return d.toLocaleDateString()
}
