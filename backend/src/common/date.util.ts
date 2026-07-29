// Python's `date` fields (issue_date, due_date, start_date, next_due_date)
// serialize as plain "YYYY-MM-DD" strings via pydantic. Prisma stores them as
// DateTime, so response builders format them back down to date-only strings
// to match the original JSON contract. `datetime` fields (created_at,
// updated_at, sent_at, ...) keep full ISO timestamps in both versions.

export function toDateOnly(date: Date | null | undefined): string | null {
  if (!date) return null;
  return date.toISOString().slice(0, 10);
}
