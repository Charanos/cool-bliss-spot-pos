# 17. Persistence

Bliss keeps the outlet in Postgres (Neon). Every tab, line, bill, drawer, movement, count and
audit event survives a restart, a deploy and a cold start, and every device sees one outlet no
matter which server instance answers it.

## 1. The shape

| Table | Holds |
| --- | --- |
| `bliss_record` | every entity: `collection`, `id`, `ord` (its place in its collection), `data` (jsonb), `version` (the write that last touched it) |
| `bliss_change` | the device change feed behind `pull ?since` (`seq`, `tbl`, `id`) |
| `bliss_applied` | outbox entry ids already applied, so a retried entry has no second effect |
| `bliss_meta` | `version`, `epoch`, `changeSeq`, `catalogueVersion`, `availabilityVersion`, `firstBusinessDate`, `seededAt` |

Money is bigint throughout; in jsonb a bigint is written as `{"$n":"12345"}` and read back as a
bigint wherever it sits (`modules/_data/records.ts`), so nothing depends on a field's name.

## 2. How a change becomes permanent

`modules/_data/store.ts`. Each server instance loads the whole working set once when it starts
(`instrumentation.ts`, before it takes a request) and the module services keep reading and changing
it synchronously, exactly as before. A change is made permanent in one Postgres transaction:

1. `pg_advisory_xact_lock`: writes across all instances happen one at a time.
2. Catch up: if another instance has written since, load only the rows with a newer `version`.
3. Run the command against a tracked view of the working set. Every row it pushes, or whose fields
   (or anything inside them) it sets, is recorded, with a copy of what it was.
4. Write exactly those rows, the new change feed entries, the applied ids and the counters; commit.

If the command throws, or the write fails, the working set is put back as it was and nothing is
written. Inside a push, each outbox entry is its own checkpoint: an entry the server refuses is
undone completely and only its dead letter is kept.

Entry points:

- **Writes** (`withWrite`): sync push, drawer count and close, the stock simulator, every Console
  action.
- **Fresh reads** (`fresh`): sync pull, history, identity, drawer preflight, the landing page and
  the Console layout. One single-row read of the version; the rows only when something changed.
- Any other read catches up in the background at most a second behind.

## 3. Seeding

```
pnpm db:seed
```

Builds eight weeks of trading up to now (tonight in progress, with live tabs) and replaces what is
stored, in one transaction. The version always rises and the epoch changes, so running server
instances reload in full and devices reset their local trade copy on the next pull. Staff, devices
and the menu keep their ids, so devices stay bound. Run it shortly before a walkthrough so tonight
is tonight.

## 4. Configuration

- `DATABASE_URL`: the Neon pooled connection string, in `.env.local` locally and in the Vercel
  project's environment variables in production. TLS is verified in full.
- `BLISS_STORE=memory`: run on a dataset generated in memory instead (the tests set this).
- Without `DATABASE_URL` the app falls back to memory, as before this existed.

## 5. Limits worth knowing

- A cold start loads the whole working set: about 57,000 rows, a few seconds from a nearby region.
  Warm instances answer in milliseconds.
- Writes are serialised outlet-wide. At one venue's volume that is invisible; a multi-outlet
  deployment would shard the lock per outlet.
- PIN lockouts are per instance.
