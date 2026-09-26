'use client';

/** The rail's search button and the keyboard shortcut both open the one command menu. */
export const COMMAND_EVENT = 'bliss:command-open';

export function openCommandMenu() {
  window.dispatchEvent(new CustomEvent(COMMAND_EVENT));
}
