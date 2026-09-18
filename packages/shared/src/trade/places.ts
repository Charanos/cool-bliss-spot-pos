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

/** A tab's name for people: its place, else its own name, else "Walk up". */
export function tabLabel(input: { tableLabel?: string | null; name?: string | null }): string {
  if (input.tableLabel) return placeLabel(input.tableLabel);
  return input.name?.trim() || 'Walk up';
}
