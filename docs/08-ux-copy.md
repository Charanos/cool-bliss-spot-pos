# UX copy, Bliss

Version 1.0
7 September 2026

---

## 1. Voice

Bliss speaks like a good bar manager: direct, unbothered, precise about money, and never patronising to someone who is busy.

| We are | We are not |
|---|---|
| Plain | Casual |
| Specific | Chatty |
| Calm under failure | Apologetic |
| Neutral about mistakes | Accusatory |
| Confident about numbers | Confident about guesses |

Three tests every string has to pass.

1. Could a waiter read it in one glance while holding a tray? If not, cut it.
2. Does it say what to do next? A message that only describes a state has failed.
3. Would you say it out loud to a colleague at 1am? If it sounds like a form letter, rewrite it.

### Banned

Exclamation marks. Emoji. "Oops", "Uh oh", "Something went wrong". "Please note", "Kindly", "We apologise for the inconvenience". "Are you sure?" as a dialog title. "Invalid input" without saying what would be valid. "Loading..." without saying what is loading. Blaming the user: "You entered an incorrect PIN" becomes "That PIN was not recognised". Blaming the network vaguely: "Connection error" becomes "No connection. Orders are saved on this device."

### Register

English, Kenyan register. 24-hour clock everywhere, because a bar trades past midnight. Dates as `6 Sep 2026`. Money as `KES 12,450.00`.

---

## 2. Terminology lock

The same thing has the same name on every surface, in every report and in every error. Enforced in review.

| Use | Never | Why |
|---|---|---|
| **Tab** | Check, bill (for the container), order | A tab is the running container |
| **Seat** | Cover, guest, person, position | Seat is short, neutral and matches the chip |
| **Shared** | Table, communal, split | For lines belonging to the table rather than a seat |
| **Line** | Item, product (when on an order) | A product is a catalogue thing, a line is a sold thing |
| **Serve** | Pour, measure, tot (generically) | Serve is the sellable unit. A tot is one kind of serve. |
| **Fire** | Send, submit, place | Fire is what tells the bar to pour |
| **Poured** | Served, done, ready, complete | The bar pours. The waiter delivers. |
| **Settle** | Pay, checkout, close (for money) | Settling is the money event |
| **Bill** | Receipt, invoice, check | One bill per settlement. A tab can produce several. |
| **Tender** | Payment method, pay type | A tender is one instrument recorded against one bill |
| **Finished** | Out of stock, sold out, unavailable, 86'd (in the UI) | "Finished" is what the bar actually says |
| **On hold** | 86'd, blocked, disabled | For a manual hold, so it reads differently from running out |
| **Drawer session** | Till, register, shift | A float-to-count period |
| **Business day** | Day, date | Never just "day". Friday ends at 05:00 Saturday. |
| **Movement** | Transaction, entry (for stock) | Every stock change is a movement |
| **Variance** | Loss, shrinkage, discrepancy | Variance is neutral. Loss is an accusation. |
| **Write-off** | Waste, wastage, spoilage | One word, with a category attached |
| **Void** | Delete, remove, cancel (for a line) | Nothing is deleted in this system |

`86` appears nowhere in the interface. It appears in the schema (`stock_holds`) and in this documentation, because engineers know it, but a waiter four months into the job should not have to.

---

## 3. Buttons

Every button is a verb naming its outcome, carrying the amount or count where money or a batch is involved.

| Context | Label | Not |
|---|---|---|
| Send to bar | `Fire order` | Submit, Send, Place |
| Take money, whole tab | `Settle KES 4,200` | Pay, Checkout |
| Take money, one seat | `Settle Seat 3 · KES 650` | Pay seat |
| Add another tender | `Add tender` | Add payment |
| Start a tab | `Open tab` | New, Create |
| Add a seat | `Add seat` | New guest, Add cover |
| Name a seat | `Label this seat` | Rename, Edit |
| Move a line | `Move to another seat` | Reassign, Transfer |
| Cancel a line | `Void the line` | Delete, Remove |
| Keep it as it is | `Keep it` | Cancel, No |
| Stop selling something | `Put on hold` | 86, Disable, Mark unavailable |
| Start selling it again | `Take off hold` | Enable, Restore |
| Mark poured | `Mark poured` | Complete, Done |
| Hand a section over | `Hand over 4 tabs` | Transfer, Assign |
| Start counting | `Start blind count` | Begin, Count |
| Commit a count | `Commit count` | Save, Finish |
| Order from a supplier | `Send to supplier` | Submit PO |
| Receive a delivery | `Post receipt` | Save, Confirm |
| End the day | `Close the day` | End shift, Finish |
| Approve as supervisor | `Approve with your PIN` | Authorise, Confirm |

Never `OK`. Never `Submit`. Never `Confirm` alone. The cancelling option is never visually dominant and never the default focus on a destructive dialog.

---

## 4. Seat copy

The feature is new to the staff, so its language does the most work.

| Situation | Copy |
|---|---|
| Seat selector, none labelled | Chips only, no heading |
| Seat selector, some labelled | Chip plus label beneath, truncated at 14 characters |
| Labelling a seat | Title `Label Seat 3`. Field placeholder `Cap, birthday, boss`. Helper `Only you and the bar see this.` |
| Adding a seat mid service | `Seat 5 added` as a 2 second inline confirmation in the strip, not a toast |
| Removing a seat with lines | `Seat 3 has 2 lines on it. Move them or void them first.` |
| Shared selected | Chip reads `··` with the word `Shared` beneath |
| Moving a line | Title `Move 1 × Gilbeys to another seat` then the seat picker. No confirmation step. |
| Settling one seat | Title `Settle Seat 3?` Body `This closes KES 650.00 for Seat 3. The rest of tab 14 stays open.` |
| Seat settled, waiter's view | Chip dims to 40%, label appended with `settled` in micro type |
| Last seat settled | `That closes tab 14.` |
| Even split | Title `Split what is left evenly?` Body `KES 2,100.00 across 3 seats. That is KES 700.00 each.` |
| Even split, uneven amount | Body `KES 2,101.00 across 3 seats. Two seats pay KES 700.34, one pays KES 700.33.` Always state the remainder, never hide it. |
| One-seat tab | No seat copy anywhere |

---

## 5. Availability copy

| Situation | Copy |
|---|---|
| Tile, running low | Count in the corner. No words. |
| Tile, last few | Count in the corner in attention colour. No words. |
| Tile, finished by stock | Micro chip `FINISHED` |
| Tile, finished by hold | Micro chip `ON HOLD` |
| Tapping a finished tile | Nothing happens. The tile is not tappable. No error, no shake, no toast. |
| Long pressing a finished tile | `Gilbeys 750ml is finished. A supervisor can put it back if the bar has more.` |
| Putting an item on hold | Title `Put Gilbeys 750ml on hold?` Body `The floor stops being able to sell it straight away.` Field `Reason (at least 10 characters)`. Chips `Bottle broke`, `Not delivered`, `Quality issue`. |
| Taking off hold | Title `Take Gilbeys 750ml off hold?` Body `The floor can sell it again straight away.` |
| Item ran out while a waiter was offline | Line carries `RAN OUT`. Bar ticket shows the flag. Counter void dialog prefills the reason `Ran out while the tablet was offline`. |
| Console, items on hold | Empty state `Nothing on hold. Everything the ledger says you have, the floor can sell.` |

---

## 6. Errors

Structure: what happened, why, what to do. Three short sentences at most, usually one.

| Situation | Copy |
|---|---|
| PIN not recognised | `That PIN was not recognised. Two attempts left before this PIN locks for 15 minutes.` |
| PIN locked | `This PIN is locked until 21:14. A manager can unlock it in the Console.` |
| Device not registered | `This device is not registered to Cool Bliss Spot. A manager needs to add it in Console, Settings, Devices.` |
| Device withdrawn | `This device was withdrawn on 28 Aug. Orders held on it are safe and a manager can recover them.` |
| No connection | `No connection. Orders are saved on this device and will send when it returns.` |
| Reconnecting | `Back online. Sending 4 orders.` |
| Catalogue changed while offline | `Prices changed while you were offline. Updating now, this takes a few seconds.` |
| Tab already settled | `Tab 14 was settled at 22:07 by Kevin. Nothing was lost. Here is the bill.` |
| Tab held by another device | `Kevin has tab 14 open at the counter. It will free up when he is done.` |
| Seat already settled | `Seat 3 was settled at 22:41. Add this to another seat or to Shared.` |
| Settle with nothing to settle | `Nothing on this tab yet.` |
| Drawer variance over threshold | `The count is KES 1,240 under the expected figure. Write what you think happened before closing.` |
| Day close with open tabs | `2 tabs are still open. They must be settled or voided first.` |
| Stock would go negative | `This would take Gilbeys 750ml below zero. Post a delivery first, or record a count adjustment with a reason.` |
| Insufficient permission | `Your role does not include changing prices. A manager can do this, or change your permissions.` |
| Reason too short | `Reason needs at least 10 characters. Say what happened, not just "mistake".` |
| Printer offline | `The bar printer is not responding. The order is fired and the bar screen has it. Reprint from the order when it is back.` |
| Sync rejected, needs a human | `4 orders could not be sent. A manager can see why in Console, Settings, Sync.` |

None of these apologise. Every one names the specific thing, says what is safe, and ends with an action.

---

## 7. Empty states

Structure: what this is, why it is empty, how to start. One line of body, one action, or no action if nothing is wrong.

| Screen | Title | Body | Action |
|---|---|---|---|
| No open tabs | `No tabs open` | `Pick a table to start one.` | `Open tab` |
| Nothing on a tab | `Nothing on this tab yet` | `Pick a seat, then add serves from the grid.` | |
| Bar view, nothing waiting | `Nothing waiting` | `Everything fired has been poured.` | |
| No stock counts | `No counts yet` | `A blind count compares what you have against what the ledger says you should have.` | `Start blind count` |
| No purchase orders | `No orders raised` | `Raise an order to a supplier, then receive against it when it arrives.` | `Raise order` |
| No variance in period | `No variance to report` | `Everything counted within tolerance for this period.` | |
| Nothing on hold | `Nothing on hold` | `Everything the ledger says you have, the floor can sell.` | |
| Empty catalogue | `Your catalogue is empty` | `Import a CSV, or add your first product by hand.` | `Import catalogue` |
| Filtered to nothing | `No results for these filters` | `Try widening the date range or clearing the category.` | `Clear filters` |
| No unresolved sync items | `Nothing stuck` | `Every device has sent everything it holds.` | |
| No audit events in range | `No activity in this period` | `Widen the date range to see earlier events.` | `Clear filters` |

Note the two kinds: empty because nothing has happened yet, which offers an action; and empty because everything is fine, which explains why and offers nothing. Conflating them makes a healthy system look broken.

---

## 8. Reason dialogs

One shape, everywhere.

```
TITLE       Void 2 × Tusker from Seat 2?
BODY        This removes KES 700.00 from tab 14. It cannot be undone.
QUICK       [Wrong item] [Customer changed mind] [Ran out]
FIELD       Reason (at least 10 characters)
ACTIONS     [ Keep it ]              [ Void the line ]
```

| Action | Title | Consequence |
|---|---|---|
| Void a line | `Void 2 × Tusker from Seat 2?` | `This removes KES 700.00 from tab 14. It cannot be undone.` |
| Void a whole tab | `Void tab 14 entirely?` | `This voids 7 lines worth KES 4,200.00 across 4 seats and frees table 7.` |
| Discount | `Discount 10% on tab 14?` | `This takes KES 420.00 off. It appears in the discounts report against your name.` |
| Write off stock | `Write off 1 × Gilbeys 750ml?` | `This removes KES 1,200.00 of stock at cost and shows in tonight's variance.` |
| Put on hold | `Put Gilbeys 750ml on hold?` | `The floor stops being able to sell it straight away.` |
| Remove a device | `Withdraw Floor 3?` | `Floor 3 stops working within a minute. Any orders it is holding can still be recovered.` |
| Commit a count | `Commit this count?` | `24 lines, KES 8,400 total variance. Committing writes adjustments and locks the count.` |
| Close the day | `Close the business day?` | `2 tabs are still open. They must be settled or voided first.` |
| Refund | `Refund KES 4,200.00?` | `This reverses the stock and takes cash out of the drawer.` |

Quick chips populate the field rather than replacing it, so a person can start from a common reason and add the detail. Chips alone are never accepted.

---

## 9. Loading and pending

| Duration | Treatment |
|---|---|
| Under 100ms | Nothing. Do not flash a spinner. |
| 100ms to 1s | Inline spinner in the control, control disabled, label unchanged |
| 1s to 10s | Skeleton matching the final layout, never a centred spinner over a blank page |
| Over 10s | Determinate progress with a count: `Sending 4 of 12 orders` |

Never "Loading...". Say what is loading.

---

## 10. Printed output

### Bill, 80mm

```
        Cool Bliss Spot
         Nairobi

Tab 14 · Table 7          6 Sep 2026
Seat 2 · Kofi             22:41
Served by Amina

1 × Gilbeys 750ml tot       500.00
                       -----------
TOTAL                KES   500.00

Cash                        1,000.00
Change                        500.00

        Asante
```

A seat bill names the seat and its label. A whole-tab bill lists every line with its seat number in a leading column. An even-split bill states plainly `Even split, 1 of 3` so nobody argues about whose beer was whose.

### Bar ticket

```
TAB 14 · T7 · 22:41
Amina

[1]  2  Tusker 500ml
[2]  1  Gilbeys double     NO ICE
[3]  1  Smirnoff + Coke
[4]  1  Tusker Lite        ** RAN OUT **

--- fired 22:41:07 ---
```

Large, sparse, no prices. Seat numbers lead every line, because that is the whole point. The bar does not need prices and printing them slows the read.

---

## 11. Onboarding

Three screens on first run, not a tour.

| # | Title | Body |
|---|---|---|
| 1 | `This is your tab list` | `Every table with an open bill lives here. Tap one to add to it.` |
| 2 | `Every drink belongs to someone` | `Pick a seat, then pick the drink. The bar sees who it is for.` |
| 3 | `It works without internet` | `If the connection drops, keep going. Everything sends itself when it comes back.` |

No tooltips, no coach marks, nothing that reappears. A waiter who has to be taught the interface twice has been given the wrong interface.

Training material is a single laminated A5 card per role, printed, written by whoever ran discovery rather than whoever wrote the code.

---

## 12. Review checklist

Applied to every string before merge.

- [ ] Uses the locked terminology, no synonyms
- [ ] Sentence case, no title case, no all caps except the `micro` chip style
- [ ] No exclamation mark, no emoji, no "please", no apology
- [ ] Says what to do next where the person can do something
- [ ] Names the specific object, amount, seat or time rather than a generic
- [ ] Buttons are verbs matching the outcome
- [ ] Under 90 characters for anything on Floor
- [ ] Readable at 200% zoom without truncating
- [ ] Money as `KES 12,450.00`, time in 24-hour, dates as `6 Sep 2026`
- [ ] No em dashes


---

## Console

The Console is read at a desk, not on a tray, but the voice is the same: plain, specific, calm, and exact about money. `scripts/check-copy.mjs` checks these in `pnpm lint`; the rewrite table is in `19-console-system.md` section 5.

- **Titles are the nouns people use at the bar.** Overview, Bills, Open tabs, Stock, Deliveries, Staff. Not "Executive Overview", not "Tender Settlement Mix", not "Operational Intelligence".
- **One sentence of purpose under a title**: what the page answers or lets you do. Never how the system works; mechanics go in a "How this is worked out" note or in the docs.
- **Sentence case everywhere.** Capitals are presentation (`label-caps`), so the source string is always sentence case and a screen reader reads words.
- **The terminology lock holds.** Tab, seat, line, bill, tender, variance, write-off, void, drawer session, business day. A delivery is received; a line is voided, never deleted.
- **Buttons name their outcome**, with the count or amount where there is one: "Receive 12 lines", "Commit count", "Add a person", "Export".
- **Every table has its own empty and filtered copy.** "No bills yet tonight." "No bills match these filters. Clear the filters to see them all."
- **Errors say what happened, then what to do**, and never show an internal message. Services refuse with a `DomainError` written in this voice.
- **No invented figures or placeholders.** A number on screen is real, or the line says it is not tracked yet. No stock photos of staff; initials until a photo is uploaded.
- **Out of scope stays out of the interface.** No KRA, eTIMS or fiscal wording anywhere; a Bliss bill says it is not a tax invoice.
