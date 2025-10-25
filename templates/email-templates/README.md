# Tech2Global Auth Email Templates

These HTML templates are ready to upload into Firebase Authentication's **Email Templates** customisation panel. Each template works with the Tech2Global Web Dialer URL structure and the React auth flows already implemented in this repository.

## Available templates

| File | Intended email | Action URL |
| --- | --- | --- |
| `email-verification.html` | Verify email | `https://<your-domain>/auth/action?mode=verifyEmail&oobCode=...` |
| `password-reset.html` | Password reset | `https://<your-domain>/auth/action?mode=resetPassword&oobCode=...` |
| `email-change-alert.html` | Email change alert | No action link – informational only |
| `restore-email.html` | Restore deleted email | `https://<your-domain>/auth/action?mode=recoverEmail&oobCode=...` |

Replace `<your-domain>` with either your Firebase Hosting domain (for example `umsgans-6c49c.web.app`) or a custom domain you have mapped to Firebase Hosting (for example `dialer.tech2global.com`). Firebase automatically appends the correct `mode`, `oobCode`, and `continueUrl` query parameters when it sends the message.

## How to apply the templates

1. **Open Firebase Console → Authentication → Templates.**
2. Select the template you want to update (Verify email, Password reset, etc.).
3. Click **"Customize email"** and then **"Edit HTML"**.
4. Paste the contents of the matching HTML file from this directory.
5. Confirm the **Action URL** points to your hosted app: `https://<your-domain>/auth/action`.
6. Save the template and send yourself a test email to confirm styling and links.

> The Tech2Global auth screens at `/auth` and `/auth/action` handle verification, password resets, and email recovery with Firebase-generated links, so no additional hosting rewrites are required.

## Authorised domains checklist

To avoid `auth/unauthorized-domain` errors when Firebase renders these links:

- Add your production hostname (for example `umsgans-6c49c.web.app` or `dialer.tech2global.com`) to **Authentication → Settings → Authorised domains**.
- Include local development hosts like `localhost` and `127.0.0.1` if you test locally.
- If you are using a custom domain, complete the DNS verification steps in Firebase Hosting so HTTPS is active before enabling the template links.

## Testing the flows

After updating each template, use the **Send test email** button in Firebase to preview the message. Each email includes a CTA button that will redirect the operator back to `https://<your-domain>/auth/action`. The React page detects the action mode, guides the operator through verification or password reset, and then links back to `/auth` for sign-in.

For password resets, remember that the Tech2Global workspace only allows verified, password-based accounts to request a reset. If the email is unverified or registered through Google, the auth page will display guidance instead of dispatching a reset email.
