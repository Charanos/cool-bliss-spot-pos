import { describe, expect, it } from 'vitest';
import { tableStage } from './lifecycle';

const open = { status: 'open' as const, clearedAt: null, billAskedAt: null };
const none = () => false;
const all = () => true;

describe('table stage', () => {
  it('reads a table with nothing sent as empty, drafts included', () => {
    expect(tableStage(open, [], none)).toBe('empty');
    expect(tableStage(open, [{ status: 'draft', orderId: 'a' }], none)).toBe('empty');
  });

  it('waits on the bar while anything fired is still to pour', () => {
    expect(tableStage(open, [{ status: 'served', orderId: 'a' }, { status: 'pending', orderId: 'b' }], none)).toBe('at_bar');
  });

  it('asks for a round to be carried once it is poured and not at the table', () => {
    expect(tableStage(open, [{ status: 'served', orderId: 'a' }], none)).toBe('to_serve');
    expect(tableStage(open, [{ status: 'served', orderId: 'a' }, { status: 'served', orderId: 'b' }], (id) => id === 'a')).toBe('to_serve');
  });

  it('is served when every poured round is at the table, and ignores voids', () => {
    expect(tableStage(open, [{ status: 'served', orderId: 'a' }, { status: 'voided', orderId: 'c' }], all)).toBe('served');
  });

  it('puts an asked bill ahead of anything still pouring', () => {
    expect(tableStage({ ...open, billAskedAt: 1 }, [{ status: 'pending', orderId: 'a' }], none)).toBe('bill');
  });

  it('holds a paid table until it is cleared', () => {
    expect(tableStage({ status: 'settled', clearedAt: null, billAskedAt: 1 }, [], all)).toBe('seated');
    expect(tableStage({ status: 'settled', clearedAt: 5 }, [], all)).toBe('cleared');
  });
});
