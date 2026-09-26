/** What every Console action answers: done (with anything it made), or a sentence saying why not. */
export type ActionResult<T extends object = object> = ({ ok: true } & T) | { ok: false; message: string };
