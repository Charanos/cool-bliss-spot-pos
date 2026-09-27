/**
 * Where a guest is. docs/14 section 2: the Counter is a staff station, so places at the bar are
 * stools. One function names every place on every surface, so a place never reads "T4" in one view
 * and "Table 4" in another.
 */
const PREFIX: Record<string, string> = { T: 'Table', S: 'Stool' };

export function placeLabel(label: string): string {
  const match = /^([A-Z])(\d+)$/.exec(label.trim());
  if (!match) return label;
  const word = PREFIX[match[1]!];
  return word ? `${word} ${match[2]}` : label;
}

/** A walk up's name for people: Walk up 7. Numbered per business day, without limit. */
export function walkUpLabel(walkUpNo?: number | null): string {
  return typeof walkUpNo === 'number' && walkUpNo > 0 ? `Walk up ${walkUpNo}` : 'Walk up';
}

/** A tab's name for people: its place, else its own name, else its walk up number. */
export function tabLabel(input: { tableLabel?: string | null; name?: string | null; walkUpNo?: number | null }): string {
  if (input.tableLabel) return placeLabel(input.tableLabel);
  return input.name?.trim() || walkUpLabel(input.walkUpNo);
}

/** The next walk up number for a business day, from the tabs already known for it. */
export function nextWalkUpNo(tabs: readonly { businessDate: string; walkUpNo?: number | null }[], businessDate: string): number {
  return tabs.reduce((max, t) => (t.businessDate === businessDate ? Math.max(max, t.walkUpNo ?? 0) : max), 0) + 1;
}
