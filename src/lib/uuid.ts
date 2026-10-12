const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** True for a well-formed UUID (route params are checked before querying). */
export function isUuid(value: string): boolean {
  return UUID.test(value);
}
