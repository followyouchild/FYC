# FYC – Daily WhatsApp group message

Posts a message to one WhatsApp group every day, sent from **+91 84319 01365**.

It links to the number the same way WhatsApp Web does ("Linked devices"), so it
can post into normal groups the number is already a member of. The phone only
needs to come online about once every 14 days to keep the link alive.

## 1. Requirements

- An always-on machine with Node.js 20+ (a small VPS, an office PC, a Raspberry Pi,
  Railway/Render with a persistent disk, etc.). The schedule only runs while
  `npm start` is running.
- The phone with +91 84319 01365, to approve the link once.

## 2. Set up

```bash
npm install
cp config.example.json config.json
```

Edit `config.json`:

| field         | meaning |
|---------------|---------|
| `phoneNumber` | Sending number, country code + digits (`918431901365`). |
| `group`       | Exact group name as shown in WhatsApp, or its id (`1203...@g.us`). |
| `schedule`    | Cron time. `0 9 * * *` = 9:00 AM daily. `30 7 * * 1-6` = 7:30 AM Mon–Sat. |
| `timezone`    | `Asia/Kolkata` by default. |
| `messages`    | One or more messages. With several, a different one is sent each day in turn. Placeholders: `{date}`, `{weekday}`, `{day}`, `{month}`, `{year}`. |

## 3. Link the WhatsApp number (one time)

```bash
npm run login
```

It prints an 8-character pairing code. On the phone: **WhatsApp → Settings →
Linked devices → Link a device → "Link with phone number instead"**, then type
the code. The session is saved in `auth/` — keep that folder private; anyone
with it can send messages as this number.

## 4. Pick the group and test

```bash
npm run groups    # lists every group the number is in, with ids
npm run preview   # shows today's message without sending
npm run send      # sends today's message right now (test)
```

## 5. Run it every day

```bash
npm start
```

Keep it running in the background, e.g. with pm2:

```bash
npm install -g pm2
pm2 start npm --name fyc-whatsapp -- start
pm2 save && pm2 startup
```

Alternatively, skip `npm start` and call `npm run send` from the system crontab
at the time you want.

## Notes

- If the log says the session was logged out (e.g. the device was removed from
  Linked devices), delete `auth/` and run `npm run login` again.
- This uses WhatsApp Web's protocol via the open-source Baileys library, not
  Meta's official Business API. One message a day to your own group is low
  risk, but avoid bulk messaging from this number.
