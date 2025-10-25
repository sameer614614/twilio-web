# Twilio Browser Dialer Starter

Modern React + TypeScript starter for building a Twilio Programmable Voice powered browser dialer. The project stitches together the Twilio Voice SDK, a small Node/Express token service, Firebase Auth/Firestore, and a multi-surface operator console with dedicated areas for call handling, event monitoring, voice policy management, and developer tooling.

## Features

- 🎯 **Authentication** – Firebase email/password auth with verification, password resets, and optional Google registration/sign-in.
- ☎️ **Twilio Softphone** – Outbound and inbound calling through the Twilio Voice SDK with mute/hold/DTMF controls.
- 🗒️ **Call Notes & Logs** – Firestore-backed logging with duration, status, and note capture; live event feed for troubleshooting.
- 🛠️ **Voice Workspace** – Per-agent toggles for outbound/inbound permissions, recording policy, and caller ID configuration.
- 📊 **Operational Dashboard** – Overview tiles and recent activity to highlight next actions.
- 🧰 **Advanced Config** – Checklist linking to Twilio webhooks, TwiML, and Voice Insights integrations.
- 🎨 **Tailwind UI** – Responsive, dark-themed layout ready for brand customization.

## Getting Started

### 1. Prerequisites

- Node.js 18+
- npm, pnpm, or yarn
- A Twilio account with:
  - Account SID & Auth Token
  - Programmable Voice API Key SID/Secret
  - TwiML App SID configured with your voice webhook URL
  - Verified caller ID or purchased Twilio phone number
- A Firebase project with Authentication and Firestore enabled

### 2. Install dependencies

```bash
npm install
```

> If your environment blocks access to `npm`, mirror the dependencies to an internal registry or vendor them ahead of time.

### 3. Environment variables

Create a `.env` file at the project root with the following keys:

```bash
VITE_FIREBASE_API_KEY=your-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=sender-id
VITE_FIREBASE_APP_ID=app-id
VITE_TWILIO_SERVER_URL=http://localhost:3001

TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your-auth-token
TWILIO_API_KEY_SID=SKxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_API_KEY_SECRET=your-api-key-secret
TWILIO_TWIML_APP_SID=APxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_CALLER_ID=+12025550123
TWILIO_DEFAULT_CLIENT_IDENTITY=agent
```

The server uses the `TWILIO_*` credentials to mint access tokens and respond to voice webhooks. Never ship these values to the browser.

### 4. Firebase setup

1. Enable Email/Password authentication in Firebase.
2. Enable the Google sign-in provider (optional) and add authorized domains (localhost + production host).
3. Create a Firestore collection named `voiceProfiles` — each document ID should match a Firebase user ID.
4. Seed documents with fields such as `allowOutbound`, `allowInbound`, `recordCalls`, `callerId`, and `identityAlias`. The UI can create/update these values after the first save.
5. (Optional) Upload the branded email templates in [`templates/email-templates`](./templates/email-templates) to Firebase Authentication if you want consistent verification/reset messaging.

### 5. Firestore security rules

Deploy the rules in [`firestore.rules`](./firestore.rules) to scope call/activity data to the signed-in operator:

```bash
firebase deploy --only firestore:rules
```

The ruleset allows each user to read/write only their own `voiceProfiles/{uid}` document and personal call logs. Automated webhook processors should run with elevated credentials.

### 6. Local development

In one terminal start the Vite dev server:

```bash
npm run dev
```

In a second terminal start the Twilio token/webhook service:

```bash
npm run server
```

Open http://localhost:5173 to sign in and explore the workspace. By default the server listens on port `3001` — adjust `VITE_TWILIO_SERVER_URL` if you change it.

### 7. Deploying the frontend

1. Install the Firebase CLI if you have not already: `npm install -g firebase-tools`.
2. Authenticate the CLI: `firebase login`.
3. Initialise hosting in this workspace (skip if already configured): `firebase init hosting`.
4. Build the production bundle: `npm run build`.
5. Deploy the compiled site: `firebase deploy --only hosting`.

For the Twilio token service deploy to your preferred Node host (Render, Railway, Cloud Run, etc.) and update the `.env`/hosting configuration accordingly.

## Authentication Workflow

- **Sign up** – Operators provide their name, email, and password or register with Google. A verification email is sent for password-based accounts.
- **Sign in** – Email/password accounts can sign in immediately. Google-based accounts must exist before first login to prevent unauthorized access.
- **Password recovery** – Password resets require a verified email. Google-linked users receive guidance to recover via Google.
- **Profile management** – Operators can edit their display name, update credentials, resend verification emails, and view verification status from Settings.

## Project Structure

```
src/
 ├─ components/      # UI primitives and layout chrome
 ├─ context/         # Auth + Twilio providers
 ├─ lib/             # Firebase helpers, Twilio voice profile utilities
 ├─ pages/           # Route-level screens
 ├─ routes/          # React Router definitions
 ├─ services/        # Firestore call log helpers
 ├─ styles/          # Tailwind entrypoint
└─ server/           # Express server for Twilio tokens and webhooks
```

## Twilio Integration Notes

- `src/context/TwilioClientContext.tsx` wraps the Twilio Voice SDK. It fetches access tokens from `/api/twilio/token`, registers the device, listens for inbound calls, and exposes helpers (`makeCall`, `acceptIncomingCall`, `toggleMute`, etc.).
- `server/index.js` is a lightweight Express service that:
  - Mints access tokens using your API key/secret.
  - Responds to voice webhooks with TwiML to bridge calls to PSTN numbers or web clients.
  - Logs call/recording status callbacks (extend to persist in Firestore or analytics platforms).
- The Voice Workspace page stores per-agent policies (allow inbound/outbound, auto-recording, caller ID). Use these fields to drive access control or Twilio Function logic.
- Firestore call logs are created by the dialer and finalised automatically when the call completes. Extend `src/services` to enrich logs with webhook data or analytics metrics.

## Roadmap Ideas

- Supervisor monitoring and call barging.
- SLA dashboards built on Twilio Voice Insights.
- Automated QA via recording download and transcription.
- Multi-tenant admin console with team segmentation.
- Integration with CRM platforms for click-to-call.

This starter is designed to accelerate Twilio browser dialer builds—providing a tested local setup, clear extension points, and production-friendly defaults.
