/**
 * How the station search decides what a query means. Pure, so it is tested on its own.
 */

/**
 * Lower case, no accents, no apostrophes, everything else that is not a letter or a number a space:
 * "Jack Daniel's 750ml" and "jack daniels 750 ml" meet in the middle.
 */
export function normalise(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’`.]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export interface Haystack {
  /** Words, for a prefix match: "lag" finds "Tusker Lager". */
  words: string[];
  /** The same text run together, for a substring match that ignores spaces: "250ml" finds "250 ml". */
  compact: string;
}

export function haystack(...fields: (string | number | null | undefined)[]): Haystack {
  const text = normalise(fields.filter((f) => f !== null && f !== undefined && f !== '').join(' '));
  return { words: text.split(' ').filter(Boolean), compact: text.replace(/ /g, '') };
}

/**
 * How well a query fits: every word of it must be found, or it is no match at all. A word that starts
 * a word of the text scores highest, one found inside the text next, and a query that opens the whole
 * text a little more, so "tusker" puts Tusker Lager above "Extra Tusker". Zero is no match.
 */
/** One typo away, insertion, deletion, substitution or a swap of neighbours: "guiness" for "guinness". */
function nearlyEqual(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i += 1;
  if (i === a.length && i === b.length) return true;
  const rest = (x: string, y: string) => x === y;
  return (
    rest(a.slice(i + 1), b.slice(i + 1)) || // one letter different
    rest(a.slice(i + 1), b.slice(i)) || // one letter too many in a
    rest(a.slice(i), b.slice(i + 1)) || // one letter missing from a
    (a[i] === b[i + 1] && a[i + 1] === b[i] && rest(a.slice(i + 2), b.slice(i + 2))) // two letters swapped
  );
}

export function score(query: string[], text: Haystack): number {
  let total = 0;
  for (const token of query) {
    if (text.words.some((w) => w === token)) total += 4;
    else if (text.words.some((w) => w.startsWith(token))) total += 3;
    else if (text.compact.includes(token)) total += 1;
    // A slip of the finger still finds it, for a word long enough that one slip is not another word.
    else if (token.length >= 4 && text.words.some((w) => nearlyEqual(token, w.slice(0, token.length)) || nearlyEqual(token, w))) total += 0.5;
    else return 0;
  }
  if (query.length > 0 && text.compact.startsWith(query.join(''))) total += 2;
  return total;
}
