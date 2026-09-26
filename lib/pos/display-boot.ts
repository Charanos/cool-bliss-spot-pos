/** Where a station keeps its display profile. Shared by the inline boot script and lib/pos/display.ts. */
export const DISPLAY_KEY = 'bliss-display';

/**
 * Inline, in <head>, before first paint: the saved choice as data-display, so a Clarity counter never
 * flashes the standard palette. The suggestion follows once the page has read the device.
 */
export const DISPLAY_BOOT = `try{var d=JSON.parse(localStorage.getItem('${DISPLAY_KEY}')||'null');if(Array.isArray(d))document.documentElement.dataset.display=d.length?d.join(' '):'standard'}catch(e){}`;
