/** Where a station keeps its display profile. Shared by the inline boot script and lib/pos/display.ts. */
export const DISPLAY_KEY = 'bliss-display';

/**
 * Inline, in <head>, before first paint: the saved choice as data-display, so a Clarity counter never
 * flashes the standard palette. With no choice yet it starts in Clarity, every station's default; Lite
 * follows once the page has read the device.
 */
export const DISPLAY_BOOT = `try{var d=JSON.parse(localStorage.getItem('${DISPLAY_KEY}')||'null');document.documentElement.dataset.display=Array.isArray(d)?(d.length?d.join(' '):'standard'):'clarity'}catch(e){document.documentElement.dataset.display='clarity'}`;
