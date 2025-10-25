# Agents Guide

## Release History
- **v3 (2025-10-25)** – Migrated the browser dialer from Telnyx to Twilio Programmable Voice, introduced the Twilio token/webhook service, refreshed call handling UI, and added the Voice Workspace configuration page.

## Voice Requirements
- Outbound calls must originate from a verified/purchased Twilio caller ID.
- Inbound calls to the Twilio number should ring the web dialer and allow accept/decline actions.
- Recording should start automatically once the call is answered (dual channel where possible).
- Call logs must capture direction (inbound/outbound/missed/declined), duration, status, and agent notes.

## Firebase & Admin Requirements
- Continue using Firebase Auth + Firestore for user management, call logs, and workspace settings.
- Only admins should have access to call recordings stored in Firebase Storage (future admin console work).
- Admin panel (future implementation):
  - View/add/edit/delete users, usage stats, and call logs.
  - Badge/notification model showing per-agent activity counts.
  - Ability to toggle outbound/inbound permissions per agent (default to disabled until approved).
  - Hard-coded fallback admin credentials: 'robbin / Nbb@1245' (replace with secure storage when the real admin panel ships).

## Twilio Credentials & Environment
Store the following secrets (never expose to the frontend):
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_API_KEY_SID`
- `TWILIO_API_KEY_SECRET`
- `TWILIO_TWIML_APP_SID`
- `TWILIO_CALLER_ID`
- `TWILIO_DEFAULT_CLIENT_IDENTITY`
- Frontend references the token server via `VITE_TWILIO_SERVER_URL`.

## Documentation Expectations
- Update `README.md` with Twilio-focused setup steps, env vars, and deployment notes every time functionality changes.
- Record new milestones in this file with version numbers (`v4`, `v5`, ...).
- Keep a concise list of Twilio references and onboarding notes for quick access.

## Helpful Twilio References
- Outbound calls: https://www.twilio.com/docs/voice/tutorials/how-to-make-outbound-phone-calls/node
- Recording: https://www.twilio.com/docs/voice/tutorials/how-to-record-phone-calls/node and https://github.com/twilio/twilio-node
- Voice SDK JS: https://www.twilio.com/docs/voice/sdks/javascript/get-started
- Incoming calls: https://www.twilio.com/docs/voice/tutorials/how-to-respond-to-incoming-phone-calls/node
- Voice API reference: https://www.twilio.com/docs/voice/api and https://www.twilio.com/docs/voice/api/call-resource
- Programmable Voice quickstart: https://www.twilio.com/docs/voice/quickstart/server
