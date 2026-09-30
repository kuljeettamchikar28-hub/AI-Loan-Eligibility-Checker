# Serverless adapter notes

The managed preview uses `server.js` for the same-origin API routes. When exporting to Netlify or Vercel, place provider-specific handlers here (or in `netlify/functions/`) and preserve these contracts:

- `POST /api/claude` → `{ kind, prompt, context }` → `{ text, mode }`
- `POST /api/save-record` → record object → `{ ok, mode }`
- `GET /api/get-records?email=...` → `{ records, mode }`
- `DELETE /api/delete-record?id=...` → `{ ok, mode }`

Keep provider secrets server-side and return private/no-store responses for personal data.
