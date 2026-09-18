import { seatColourIndex } from '@bliss/shared/seats';

/**
 * Literal class names so Tailwind can see them. Seat colour is assigned by seat number, never chosen
 * and never random, so Seat 2 is the same colour on every device and on the printed bill.
 */
const SEAT_BG = ['bg-seat-1', 'bg-seat-2', 'bg-seat-3', 'bg-seat-4', 'bg-seat-5', 'bg-seat-6', 'bg-seat-7', 'bg-seat-8'] as const;

export function seatBgClass(seatNo: number): string {
  return SEAT_BG[seatColourIndex(seatNo)] ?? 'bg-seat-1';
}

const CATEGORY_EDGE = {
  glacier: 'bg-seat-1',
  ember: 'bg-seat-2',
  leaf: 'bg-seat-3',
  iris: 'bg-seat-4',
  rose: 'bg-seat-5',
  steel: 'bg-seat-6',
  brass: 'bg-seat-7',
  jade: 'bg-seat-8',
} as const;

export type CategoryColour = keyof typeof CATEGORY_EDGE;

export function categoryEdgeClass(token: CategoryColour): string {
  return CATEGORY_EDGE[token];
}
