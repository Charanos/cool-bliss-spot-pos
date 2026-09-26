/**
 * Which columns fold when the card is narrower than the table. The first column and fixed columns
 * never fold, nor does one marked `fold: 0`; the rest go by `fold`, highest first, then text before
 * figures. Text folds from the right and figures from the left, since the rightmost figure is the total.
 */
export function foldColumns<C extends { key: string; fixed?: boolean; fold?: number; align?: 'left' | 'right' }>(columns: readonly C[], available: number | null, widthOf: (cols: readonly C[]) => number): Set<string> {
  const out = new Set<string>();
  if (available === null || widthOf(columns) <= available) return out;
  const candidates = columns
    .map((c, index) => ({ c, index }))
    .filter(({ c, index }) => index > 0 && !c.fixed && c.fold !== 0)
    .sort((a, b) => (b.c.fold ?? 0) - (a.c.fold ?? 0) || (a.c.align === 'right' ? 1 : 0) - (b.c.align === 'right' ? 1 : 0) || (a.c.align === 'right' ? a.index - b.index : b.index - a.index));
  for (const { c } of candidates) {
    out.add(c.key);
    if (widthOf(columns.filter((x) => !out.has(x.key))) <= available) break;
  }
  return out;
}
