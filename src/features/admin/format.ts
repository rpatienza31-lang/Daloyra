/** Date and time for the admin area, in Philippine time. */
export function formatWhen(iso: string | null, withTime = false): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    ...(withTime ? { timeStyle: "short" } : {}),
    timeZone: "Asia/Manila",
  }).format(new Date(iso));
}
