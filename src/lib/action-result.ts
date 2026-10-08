/** What every Server Action returns. Raw database errors never reach the user. */
export type ActionResult<TCode extends string = never> =
  { ok: true } | { ok: false; error: string; code?: TCode };

export const ok = { ok: true } as const;

export function fail(error: string): { ok: false; error: string } {
  return { ok: false, error };
}

/** A failure the form reacts to specifically (e.g. offering to resend an email). */
export function failWith<TCode extends string>(
  error: string,
  code: TCode,
): { ok: false; error: string; code: TCode } {
  return { ok: false, error, code };
}
