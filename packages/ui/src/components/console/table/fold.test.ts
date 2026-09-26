import { describe, expect, it } from 'vitest';
import { foldColumns } from './fold';

type C = { key: string; width: number; fixed?: boolean; fold?: number; align?: 'left' | 'right' };
const widthOf = (cols: readonly C[]) => cols.reduce((n, c) => n + c.width, 0);
const cols: C[] = [
  { key: 'bill', width: 200 },
  { key: 'table', width: 120 },
  { key: 'waiter', width: 140 },
  { key: 'items', width: 80, align: 'right' },
  { key: 'total', width: 120, align: 'right' },
];

describe('foldColumns', () => {
  it('folds nothing while every column fits, or before the width is known', () => {
    expect(foldColumns(cols, 660, widthOf).size).toBe(0);
    expect(foldColumns(cols, null, widthOf).size).toBe(0);
  });

  it('folds text before figures, the last text column first, and stops as soon as the rest fit', () => {
    expect([...foldColumns(cols, 600, widthOf)]).toEqual(['waiter']);
    expect([...foldColumns(cols, 450, widthOf)]).toEqual(['waiter', 'table']);
    expect([...foldColumns(cols, 380, widthOf)]).toEqual(['waiter', 'table', 'items']);
  });

  it('never folds the first column, a fixed one or one marked fold 0, and honours an explicit order', () => {
    const marked: C[] = [cols[0]!, { ...cols[1]!, fold: 0 }, { ...cols[2]!, fixed: true }, { ...cols[3]!, fold: 2 }, cols[4]!];
    expect([...foldColumns(marked, 100, widthOf)]).toEqual(['items', 'total']);
  });
});
