import 'server-only';

import type { CatalogueStatus, PriceList, PriceListItem, PriceRule } from '@bliss/shared/domain';
import { createUuidV7 } from '@bliss/shared/id';
import { type Actor, requireReasoned } from '@bliss/shared/reason';
import { DomainError } from '../_data/errors';
import { bumpCatalogueVersion } from '../_data/source';
import * as audit from '../audit/service';
import * as catalogue from '../catalogue/service';
import * as identity from '../identity/service';
import * as trade from '../trade/service';
import { pricingTables } from './schema';

/**
 * Managing price lists and time rules. docs/19, plan C1. A list or a rule is never deleted, since a
 * fired line records which one priced it: it is archived, and the price engine stops using it.
 * Every change bumps the catalogue version, so tablets price offline with the same lists.
 */

const createId = createUuidV7();

function listName(value: string): string {
  const clean = value.trim().replace(/\s+/g, ' ');
  if (clean.length < 2 || clean.length > 40) throw new DomainError('A name is 2 to 40 characters.');
  return clean;
}

function priority(value: number): number {
  if (!Number.isInteger(value) || value < 0 || value > 1000) throw new DomainError('Priority is a whole number from 0 to 1,000. Higher wins.');
  return value;
}

function record(actor: Actor, action: string, entityType: string, entityId: string, before: object | null, after: object | null, reason: string | null = null) {
  audit.record({ outletId: identity.outlet().id, actorStaffId: actor.staffId, action, entityType, entityId, before, after, reason, severity: reason ? 'notable' : 'info' });
}

/** The base list the floor prices from: the active base list with the highest priority. */
export function defaultList(): PriceList | null {
  return (
    pricingTables()
      .priceLists.filter((l) => l.kind === 'base' && l.status === 'active')
      .sort((a, b) => b.priority - a.priority)[0] ?? null
  );
}

/* ----------------------------------------------------------------- price lists */

export function savePriceList(input: { id?: string | null; name: string; kind: 'base' | 'overlay'; priority: number; actor: Actor }): PriceList {
  identity.assertCan(input.actor.staffId, 'price.write', 'changing prices');
  const t = pricingTables();
  const name = listName(input.name);
  const clash = t.priceLists.find((l) => l.name.toLowerCase() === name.toLowerCase() && l.id !== input.id && l.status === 'active');
  if (clash) throw new DomainError(`There is already a price list called ${clash.name}.`);
  const level = priority(input.priority);

  if (!input.id) {
    if (input.kind !== 'base' && input.kind !== 'overlay') throw new DomainError('Choose a base list or an overlay.');
    const list: PriceList = { id: createId(), outletId: identity.outlet().id, name, kind: input.kind, priority: level, effectiveFrom: null, effectiveTo: null, status: 'active' };
    t.priceLists.push(list);
    bumpCatalogueVersion();
    record(input.actor, 'price_list.created', 'price_list', list.id, null, { name, kind: list.kind, priority: level });
    return list;
  }
  const list = t.priceLists.find((l) => l.id === input.id);
  if (!list) throw new DomainError('That price list is no longer here.');
  const before = { name: list.name, priority: list.priority };
  if (before.name === name && before.priority === level) return list;
  Object.assign(list, { name, priority: level });
  bumpCatalogueVersion();
  record(input.actor, 'price_list.updated', 'price_list', list.id, before, { name, priority: level });
  return list;
}

/**
 * Archive a list or bring it back. The last base list cannot go (every item needs a base price),
 * nor a list a zone prices from or an active time rule switches on.
 */
export function setPriceListStatus(input: { id: string; status: CatalogueStatus; reason: string; actor: Actor }): void {
  const { reason, actor } = requireReasoned(input);
  identity.assertCan(actor.staffId, 'price.write', 'changing prices');
  const t = pricingTables();
  const list = t.priceLists.find((l) => l.id === input.id);
  if (!list) throw new DomainError('That price list is no longer here.');
  if (list.status === input.status) return;
  if (input.status === 'archived') {
    if (list.kind === 'base' && t.priceLists.filter((l) => l.kind === 'base' && l.status === 'active').length === 1) throw new DomainError(`${list.name} is the only base list. Every item needs a base price, so add another base list first.`);
    const zones = trade.zones().filter((z) => z.defaultPriceListId === list.id && z.status === 'active');
    if (zones.length > 0) throw new DomainError(`${zones.map((z) => z.name).join(' and ')} ${zones.length === 1 ? 'prices' : 'price'} from ${list.name}. Choose another list for ${zones.length === 1 ? 'it' : 'them'} in People, Zones and tables first.`);
    const rules = t.rules.filter((r) => r.priceListId === list.id && r.status === 'active');
    if (rules.length > 0) throw new DomainError(`${rules.map((r) => r.name).join(' and ')} ${rules.length === 1 ? 'switches' : 'switch'} ${list.name} on. Archive ${rules.length === 1 ? 'that rule' : 'those rules'} first.`);
  }
  const before = { status: list.status };
  list.status = input.status;
  bumpCatalogueVersion();
  record(actor, input.status === 'archived' ? 'price_list.archived' : 'price_list.restored', 'price_list', list.id, before, { status: list.status }, reason);
}

/**
 * Copy prices from one list onto another: every item the source prices, at the source's price.
 * `onlyMissing` leaves items the target already prices alone. The old prices are archived, as with
 * any price change, so each stays readable. Returns how many prices were written.
 */
export function copyPrices(input: { fromId: string; toId: string; onlyMissing: boolean; reason: string; actor: Actor }): { copied: number } {
  const { reason, actor } = requireReasoned(input);
  identity.assertCan(actor.staffId, 'price.write', 'changing prices');
  const t = pricingTables();
  const from = t.priceLists.find((l) => l.id === input.fromId && l.status === 'active');
  const to = t.priceLists.find((l) => l.id === input.toId && l.status === 'active');
  if (!from || !to) throw new DomainError('Choose two active price lists.');
  if (from.id === to.id) throw new DomainError('Choose a different list to copy from.');
  const current = new Map(t.items.filter((i) => i.priceListId === to.id && i.status === 'active').map((i) => [i.productVariantId, i]));
  let copied = 0;
  for (const source of t.items.filter((i) => i.priceListId === from.id && i.status === 'active')) {
    if (!catalogue.variantById(source.productVariantId)) continue;
    const existing = current.get(source.productVariantId);
    if (existing && (input.onlyMissing || existing.priceCents === source.priceCents)) continue;
    if (existing) existing.status = 'archived';
    const item: PriceListItem = { id: createId(), priceListId: to.id, productVariantId: source.productVariantId, priceCents: source.priceCents, minQty: existing?.minQty ?? null, status: 'active' };
    t.items.push(item);
    copied += 1;
  }
  if (copied === 0) throw new DomainError(`${to.name} already has every price ${from.name} has.`);
  bumpCatalogueVersion();
  record(actor, 'price_list.copied', 'price_list', to.id, null, { from: from.name, to: to.name, copied, onlyMissing: input.onlyMissing }, reason);
  return { copied };
}

/* ------------------------------------------------------------------ time rules */

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export interface RuleInput {
  id?: string | null;
  name: string;
  priceListId: string;
  daysOfWeek: readonly number[];
  startTime: string;
  endTime: string;
  priority: number;
  actor: Actor;
}

/** Add a time rule (happy hour on weekdays, 17:00 to 19:00), or change one. */
export function saveRule(input: RuleInput): PriceRule {
  identity.assertCan(input.actor.staffId, 'price.write', 'changing prices');
  const t = pricingTables();
  const name = listName(input.name);
  const list = t.priceLists.find((l) => l.id === input.priceListId && l.status === 'active');
  if (!list) throw new DomainError('Choose an active price list for the rule to switch on.');
  if (list.kind !== 'overlay') throw new DomainError(`${list.name} is a base list. A time rule switches on an overlay, such as happy hour.`);
  const days = [...new Set(input.daysOfWeek)].sort();
  if (days.length === 0 || days.some((d) => !Number.isInteger(d) || d < 1 || d > 7)) throw new DomainError('Choose at least one day.');
  if (!TIME.test(input.startTime) || !TIME.test(input.endTime)) throw new DomainError('Enter times as hours and minutes, such as 17:00.');
  if (input.startTime === input.endTime) throw new DomainError('A rule needs to start and end at different times.');
  const fields = { name, priceListId: list.id, daysOfWeek: days, startTime: input.startTime, endTime: input.endTime, crossesMidnight: input.endTime < input.startTime, priority: priority(input.priority) };

  if (!input.id) {
    const rule: PriceRule = { id: createId(), outletId: identity.outlet().id, ...fields, appliesTo: 'all', targetIds: [], effectiveFrom: null, effectiveTo: null, status: 'active' };
    t.rules.push(rule);
    bumpCatalogueVersion();
    record(input.actor, 'price_rule.created', 'price_rule', rule.id, null, { ...fields, list: list.name });
    return rule;
  }
  const rule = t.rules.find((r) => r.id === input.id);
  if (!rule) throw new DomainError('That time rule is no longer here.');
  const before = { name: rule.name, priceListId: rule.priceListId, daysOfWeek: rule.daysOfWeek, startTime: rule.startTime, endTime: rule.endTime, crossesMidnight: rule.crossesMidnight, priority: rule.priority };
  if (JSON.stringify(before) === JSON.stringify(fields)) return rule;
  Object.assign(rule, fields);
  bumpCatalogueVersion();
  record(input.actor, 'price_rule.updated', 'price_rule', rule.id, before, fields);
  return rule;
}

/** Switch a rule off (archive) or on again. */
export function setRuleStatus(input: { id: string; status: CatalogueStatus; reason: string; actor: Actor }): void {
  const { reason, actor } = requireReasoned(input);
  identity.assertCan(actor.staffId, 'price.write', 'changing prices');
  const t = pricingTables();
  const rule = t.rules.find((r) => r.id === input.id);
  if (!rule) throw new DomainError('That time rule is no longer here.');
  if (rule.status === input.status) return;
  if (input.status === 'active' && !t.priceLists.some((l) => l.id === rule.priceListId && l.status === 'active')) throw new DomainError('Its price list is archived. Bring the list back first.');
  const before = { status: rule.status };
  rule.status = input.status;
  bumpCatalogueVersion();
  record(actor, input.status === 'archived' ? 'price_rule.archived' : 'price_rule.restored', 'price_rule', rule.id, before, { status: rule.status }, reason);
}

/** Rules that share a day and an overlapping window with this one, so the form can warn. */
export function overlapping(rule: Pick<PriceRule, 'id' | 'daysOfWeek' | 'startTime' | 'endTime'>): PriceRule[] {
  const minutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3));
  const spans = (r: Pick<PriceRule, 'startTime' | 'endTime'>): [number, number][] => {
    const s = minutes(r.startTime);
    const e = minutes(r.endTime);
    return e > s ? [[s, e]] : [[s, 1440], [0, e]];
  };
  const mine = spans(rule);
  return pricingTables().rules.filter(
    (r) => r.id !== rule.id && r.status === 'active' && r.daysOfWeek.some((d) => rule.daysOfWeek.includes(d)) && spans(r).some(([a, b]) => mine.some(([c, d]) => a < d && c < b)),
  );
}
