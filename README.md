# LoanWise AI

LoanWise AI is a dark-glassmorphism Indian BFSI web platform for transparent financial planning. It combines a **Loan Eligibility Checker**, **Credit Score Analyzer**, **EMI Calculator**, **AI Financial Tips**, and **My Records** in one responsive interface.

> All outputs are educational estimates only. They are not an offer, guarantee of credit, official bureau score, or financial advice.

## Features

- Indian number formatting (`₹12,50,000`) and 10-digit mobile validation.
- Rule-based loan estimate with FOIR/DTI, score, rate band, maximum amount, reasons, and suggestions.
- Weighted estimated credit score with factor bars, risk level, and improvement insights.
- Live EMI calculator with amortization, prepayment savings, and compare mode.
- AI tips chat with safe boundaries, consent-aware context, typing/error states, and mock mode.
- My Records search/filter/CSV export/delete with localStorage fallback.
- Server-side Claude and Google Sheets-compatible proxy routes; no API keys in frontend code.
- Responsive at mobile, tablet, and desktop widths with reduced-motion support.

## Run locally

```bash
pnpm install # no runtime dependency is required; installs only if your workspace expects a lockfile
pnpm start
# open http://localhost:3000
pnpm test
pnpm run check
```

The app works immediately without credentials. In mock mode, AI responses are deterministic and records stay in browser storage plus a demo-memory server store.

## Environment variables

Copy `.env.example` to your deployment environment. Never commit real values.

- `ANTHROPIC_API_KEY` — enables live Claude responses through `/api/claude`.
- `CLAUDE_MODEL` — optional Claude model override; defaults to `claude-sonnet-4-5`.
- `GOOGLE_APPS_SCRIPT_URL` — optional web-app endpoint for record writes.
- `GOOGLE_SHEET_ID` and `GOOGLE_SERVICE_ACCOUNT_JSON` — reserved for a service-account implementation when using the Google Sheets API directly.
- `ALLOWED_ORIGIN` — deployed origin for CORS.
- `RATE_LIMIT_PER_MINUTE` — request limit for the Claude proxy.
- `PORT` — local server port, default `3000`.

## Google Sheets setup

### Apps Script web app (simplest)

1. Create a Google Sheet with tabs `LoanEligibility`, `CreditScore`, `EMIHistory`, and `AIChats`.
2. Open **Extensions → Apps Script**.
3. Add a `doPost(e)` handler that validates the JSON shape, chooses the tab from `module`, and appends a row with timestamp, record ID, identity fields when supplied, inputs, results, and summary.
4. Add a `doGet(e)` handler for email-filtered reads if you want remote record retrieval.
5. Deploy as a Web app, choose an access policy appropriate for your organization, and place the URL in the protected `GOOGLE_APPS_SCRIPT_URL` environment variable.
6. Restrict the Apps Script implementation to the required columns; do not add PAN, Aadhaar, OTP, or bank credentials.

### Service account route

1. Create a Google Cloud project and enable the Google Sheets API.
2. Create a service account and download its JSON key only into a protected secret manager.
3. Share the sheet with the service-account email as an editor.
4. Configure `GOOGLE_SHEET_ID` and the complete `GOOGLE_SERVICE_ACCOUNT_JSON` secret.
5. Replace the demo-memory branch in `server.js` with a server-only Sheets API client; never bundle the key into `public/`.

## Claude setup

1. Create an Anthropic API key in the Anthropic console.
2. Store it through the hosting platform's protected secret flow as `ANTHROPIC_API_KEY`.
3. Optionally set `CLAUDE_MODEL` to the current Claude Sonnet model available to your account.
4. Test `/api/claude` with a non-sensitive prompt; the app should return `mode: live`.
5. Keep the system guardrails in `server.js` and review outputs before any production use.

## Architecture

See [`docs/architecture.mmd`](docs/architecture.mmd) and [`docs/user-flow.mmd`](docs/user-flow.mmd).

- `public/` is the static frontend.
- `public/js/calculations.js` is pure business logic and is unit tested.
- `server.js` is the local/server-capable API proxy.
- `api/` is reserved for provider-specific serverless adapters when exporting to Netlify/Vercel.

## Deployment

### Managed web project

1. Start `node server.js` on the configured port for Preview.
2. Configure the static build output as `public/` and route `/api/*` to the server.
3. Add protected production secrets only through the platform secret workflow.
4. Save a checkpoint, publish, and verify `/`, `/loan.html`, `/emi.html`, `/manus-routes.json`, and the API fallback behavior.

### Netlify/Vercel handoff

The included `netlify.toml` describes static publishing, `/api/*` routing, asset caching, and private API responses. For Netlify, move the provider-specific handlers into `netlify/functions/`; for Vercel, expose equivalent handlers in `api/`. Keep the same JSON contracts and environment variable names.

## Testing

```bash
pnpm test
pnpm run check
```

The test suite covers EMI known cases, amortization closure, prepayment savings, loan hard rejects and approvals, credit weighting/bands, and validation edge cases. Add provider mock tests before enabling live credentials in production.

## Future enhancements

- User authentication with Firebase/Auth0.
- ML prediction models using Python/scikit-learn behind a versioned API.
- PDF report generation.
- Hindi and Marathi localization.
- Bank-partner integrations.
- Credit bureau API integration with explicit consent.
- Real queue/retry storage and audited remote deletion.
