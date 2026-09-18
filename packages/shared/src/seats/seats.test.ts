import { describe, expect, it } from 'vitest';
import {
  canRemoveSeat,
  displaySeatLabel,
  nextSeatNo,
  normaliseSeatLabel,
  remapSeatsForMerge,
  seatColourIndex,
  showsSeatChips,
  showsSeatControls,
} from './seats';

describe('seat colour', () => {
  it('follows the palette table: seats 1, 9 and 17 are Glacier, seat 8 is Jade', () => {
    expect(seatColourIndex(1)).toBe(0);
    expect(seatColourIndex(9)).toBe(0);
    expect(seatColourIndex(17)).toBe(0);
    expect(seatColourIndex(2)).toBe(1);
    expect(seatColourIndex(8)).toBe(7);
  });
});

describe('seat numbers', () => {
  it('never reuses a number, even after a removal', () => {
    const seats = [
      { seatNo: 1, status: 'active' },
      { seatNo: 2, status: 'removed' },
      { seatNo: 3, status: 'active' },
    ];
    expect(nextSeatNo(seats)).toBe(4);
  });

  it('hides seat controls when exactly one seat is active', () => {
    expect(showsSeatControls([{ status: 'active' }])).toBe(false);
    expect(showsSeatControls([{ status: 'active' }, { status: 'removed' }])).toBe(false);
    expect(showsSeatControls([{ status: 'active' }, { status: 'settled' }])).toBe(false);
    expect(showsSeatControls([{ status: 'active' }, { status: 'active' }])).toBe(true);
  });

  it('keeps chips on settled seat groups', () => {
    expect(showsSeatChips([{ status: 'active' }])).toBe(false);
    expect(showsSeatChips([{ status: 'active' }, { status: 'settled' }])).toBe(true);
  });
});

describe('seat removal', () => {
  it('is refused while non-voided lines are attached', () => {
    const lines = [
      { tabSeatId: 's3', status: 'pending' as const },
      { tabSeatId: 's3', status: 'served' as const },
      { tabSeatId: 's3', status: 'voided' as const },
    ];
    expect(canRemoveSeat('s3', lines)).toEqual({ ok: false, lineCount: 2 });
    expect(canRemoveSeat('s4', lines)).toEqual({ ok: true });
  });
});

describe('seat labels', () => {
  it('trims and caps at 24 characters', () => {
    expect(normaliseSeatLabel('   ')).toBeNull();
    expect(normaliseSeatLabel('  Cap  ')).toBe('Cap');
    expect(normaliseSeatLabel('a'.repeat(30))).toHaveLength(24);
  });

  it('truncates for display at 14 characters', () => {
    expect(displaySeatLabel('Birthday')).toBe('Birthday');
    expect(displaySeatLabel('Birthday table by the door')).toBe('Birthday tabl…');
  });
});

describe('merge', () => {
  it('renumbers merged seats above the surviving maximum and keeps order', () => {
    const surviving = [{ seatNo: 1 }, { seatNo: 2 }, { seatNo: 3 }, { seatNo: 4 }];
    const merged = [
      { id: 'b2', seatNo: 2, status: 'active' as const },
      { id: 'b1', seatNo: 1, status: 'active' as const },
      { id: 'b3', seatNo: 3, status: 'removed' as const },
    ];
    expect(remapSeatsForMerge(surviving, merged)).toEqual([
      { seatId: 'b1', fromSeatNo: 1, toSeatNo: 5, colourIndex: 4 },
      { seatId: 'b2', fromSeatNo: 2, toSeatNo: 6, colourIndex: 5 },
    ]);
  });
});
