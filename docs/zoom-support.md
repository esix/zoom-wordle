# Zoom Support Note

We are building a small Zoom App game that reads public in-meeting chat messages
through the `meeting.chat_message_sent` event.

## App Details

- App name: `Wordle`
- App type: Zoom App / General OAuth app, user-managed
- Marketplace app URL:
  `https://marketplace.zoom.us/apps/dHEusRXgTW2m5g6QMjjCZw`
- App status: Development
- Public app URL: `https://if-quests.ru/wordle/`
- OAuth redirect URL: `https://if-quests.ru/wordle/auth`
- Webhook URL: `https://if-quests.ru/wordle/webhooks/zoom`
- Event subscription name: `MyChatListener`
- Event subscription scope: `user`
- Subscribed event: `meeting.chat_message_sent`

## Minimal Permissions

The app currently requests:

- `zoomapp:inmeeting`
- `meeting:read:chat_message`
- `meeting:read:meeting_chat`

We removed unrelated webinar, RTMS audio/video/status, Team Chat, and emoji
reaction permissions.

## What Works

- The Zoom App installs successfully.
- The Zoom App opens inside a Zoom meeting.
- The app endpoint is reachable over HTTPS.
- Zoom webhook URL validation succeeds.
- The app validates regular webhook request signatures using
  `x-zm-signature`, `x-zm-request-timestamp`, and the app Secret Token.
- The Marketplace Event Subscription API shows the active subscription:

```json
{
  "event_subscription_name": "MyChatListener",
  "subscription_scope": "user",
  "event_webhook_url": "https://if-quests.ru/wordle/webhooks/zoom",
  "events": ["meeting.chat_message_sent"]
}
```

## What Does Not Work

When a logged-in user starts the app inside a meeting and sends a public
in-meeting chat message such as `город`, Zoom does not make any HTTP request to
the configured webhook URL.

Observed server-side behavior:

- nginx access logs show the Zoom App loading `/wordle/`.
- nginx access logs show no `POST /wordle/webhooks/zoom` after public
  in-meeting chat messages are sent.
- Zoom Marketplace "Webhook Only apps Logs" shows no data.

## Request

Please enable or confirm delivery for the in-meeting chat webhook event
`meeting.chat_message_sent` for this app/account.

If this event requires in-meeting chat DLP enablement or any other support-side
configuration, please enable it or advise which account/app setting is missing.
