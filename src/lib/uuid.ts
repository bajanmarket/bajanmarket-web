const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** True when a route param is a well-formed UUID and safe to send to the database. */
export function isUuid(value: string | undefined | null): boolean {
  return !!value && UUID_RE.test(value);
}
