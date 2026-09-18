import 'server-only';
import { dataset } from '../_data/source';

/** Sync owns cursors and the outbox dead letters. */
export const syncTables = () => ({ deadLetters: dataset().deadLetters });
