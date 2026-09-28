# 20. WhatsApp alerts

The owner hears about what matters on WhatsApp, as it happens, without opening the Console.

## What is sent, and when

| Alert | Template | Sent |
| --- | --- | --- |
| Night summary | `bliss_night_summary` | When the last drawer of the business day closes. If a night traded and no drawer was closed, the morning after, once the business day has moved on. Net sales, bills, cash, M-Pesa, card, voided, and how each drawer closed. |
| Drawer over or short | `bliss_drawer_variance` | When a drawer closes further out than the outlet's allowance (Settings, Outlet). Counted, expected, who closed it and what they said. |
| Void or refund | `bliss_void_refund` | A voided line, a voided bill or a refund at or above the amount set on the WhatsApp page (KES 1,000 at first). |
| Item finished | `bliss_stock_out` | A counted item runs out during service. Once per item a night. Items never counted do not run out (D-30). |
| Trade cleared | `bliss_trade_cleared` | An owner clears trade from Settings, Sync. |

Each can be switched off on Console, Settings, WhatsApp, where the numbers are set too. Until they
are, alerts go to +254 140 490 464 and +254 118 933 850.

## How it works

- **Queued with what caused it.** An alert is written in the same database transaction as the
  void, the drawer close or the order that raised it (modules/_data/events.ts, modules/notify/
  triggers.ts). It cannot be lost, and a key per alert and number means it is never sent twice.
- **Sent after the response.** The sender (modules/notify/send.ts) runs with `after()` once a
  station's sync, a Console action or the Console's heartbeat has been answered, so no screen waits
  on WhatsApp. It claims due messages under the write lock with a one minute lease, so two server
  instances never send the same one.
- **Retried.** A failure is tried again after 1, 5 and 15 minutes, then hourly, six tries in all. A
  refusal retrying cannot fix (no such template, not a WhatsApp number) stops at once.
- **Delivery comes back.** WhatsApp calls `/api/whatsapp/webhook` as each message is sent,
  delivered, read or fails; every call must carry a valid signature from the app secret.
- **Every message is in the log** on the WhatsApp page with its status and any error. Clearing
  trade clears it with the rest.

## Connecting the business number

WhatsApp only lets a business start a conversation with a template it has approved, sent through the
WhatsApp Business Platform (Cloud API). Once, by whoever manages the venue's Meta business account:

1. In Meta Business Suite, create a WhatsApp Business account and add the number alerts come from.
   It cannot be a number in use on the WhatsApp app at the same time.
2. In the Meta developer app, make a permanent access token for a system user with the
   `whatsapp_business_messaging` permission, and copy the number's Phone number ID and the app
   secret.
3. In WhatsApp Manager, create the five templates, category Utility, language English, exactly as
   shown on the WhatsApp page (modules/notify/config.ts), with the examples it shows.
4. On the server, set `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_VERIFY_TOKEN` (any long
   phrase) and `WHATSAPP_APP_SECRET`, and redeploy.
5. In the developer app, under WhatsApp, Configuration, set the webhook URL to
   `https://<the site>/api/whatsapp/webhook` with the same verify token, and subscribe to
   `messages`.
6. Send a test from the WhatsApp page. It uses WhatsApp's own `hello_world` template, so it works
   before the five are approved. Alerts raised before the connection wait and go out once it is.
