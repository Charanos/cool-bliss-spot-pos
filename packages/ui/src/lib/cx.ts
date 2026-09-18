type ClassValue = string | false | null | undefined | 0;

/** Join class names, dropping falsy values. No merging magic: tokens do not overlap by design. */
export function cx(...values: ClassValue[]): string {
  let out = '';
  for (const v of values) {
    if (!v) continue;
    out = out ? `${out} ${v}` : v;
  }
  return out;
}
