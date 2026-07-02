# Zoom Wordle

A Zoom App prototype that renders a Russian Wordle board into the user's
virtual foreground video. The intended game flow is:

1. The host starts the Zoom App in a meeting.
2. Participants send five-letter Russian words to the public in-meeting chat.
3. Zoom sends `meeting.chat_message_sent` events to the app webhook.
4. The app validates each message against a Russian word list and updates the
   video overlay for the meeting.

## Current Status

The app UI, OAuth install flow, Wordle game loop, Russian word validation, and
webhook endpoint are implemented.

The remaining blocker is Zoom-side delivery of the `meeting.chat_message_sent`
webhook. The event subscription is active and points to the app endpoint, but
Zoom does not currently attempt webhook delivery when public in-meeting chat
messages are sent.

See [docs/zoom-support.md](docs/zoom-support.md) for the support note and
reproduction details.

## Local Setup

```bash
npm install
cp .env.sample .env
npm start
```

Required environment variables:

```ini
ZM_CLIENT_ID=
ZM_CLIENT_SECRET=
ZM_REDIRECT_URL=
PUBLIC_BASE_PATH=/wordle
SESSION_SECRET=
ZOOM_WEBHOOK_SECRET_TOKEN=
```

`ZOOM_WEBHOOK_SECRET_TOKEN` is the Secret Token from Zoom Event Subscriptions.
It is used to validate Zoom webhook URL validation requests and signed webhook
events.

## Public URL Used For Testing

```text
https://if-quests.ru/wordle/
https://if-quests.ru/wordle/auth
https://if-quests.ru/wordle/webhooks/zoom
```

The local development server runs on port `8000` and is exposed through a
reverse SSH tunnel plus nginx.

## Useful Commands

```bash
npm run build
npx eslint app.js config.js server/**/*.js client/src/**/*.js
```

## Word Lists

Russian word lists are generated into `data/wordlists/` from open datasets:

- `danakt/russian-words` (MIT)
- `Harrix/Russian-Nouns` (MIT)
- `Digital-Pushkin-Lab/Russian-Word-Frequency-Lists-for-Children` (CC0)

Regenerate them with:

```bash
npm run build:ru-wordlists
```
