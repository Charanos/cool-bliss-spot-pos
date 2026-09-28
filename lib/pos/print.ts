'use client';

import { primeStationToken, printUrl } from './api';
import { wakeSync } from './sync';

/**
 * Print from a station. The window opens in the same tap (a browser blocks one opened later), the
 * device pushes what it has not sent yet, and the ticket loads once the sign-in is read, so the bill
 * just settled is on the server, or on its way, when the print page asks for it. The print page
 * waits for a record still in transit rather than saying it does not exist.
 */
export function openPrint(path: string): void {
  const win = window.open('', '_blank');
  wakeSync();
  void primeStationToken().then(() => {
    const url = printUrl(path);
    if (win && !win.closed) win.location.href = url;
    else window.open(url, '_blank');
  });
}
