const memory = globalThis.__loanwiseRecords || (globalThis.__loanwiseRecords = []);
export async function handler(event) {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed.' }) };
  let record = {};
  try { record = JSON.parse(event.body || '{}'); } catch { return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON.' }) }; }
  if (!record.id || !record.module) return { statusCode: 400, body: JSON.stringify({ error: 'Record module and id are required.' }) };
  const index = memory.findIndex((item) => item.id === record.id); if (index >= 0) memory[index] = record; else memory.unshift(record);
  if (process.env.GOOGLE_APPS_SCRIPT_URL) { try { await fetch(process.env.GOOGLE_APPS_SCRIPT_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(record) }); return { statusCode: 200, body: JSON.stringify({ ok: true, mode: 'google-sheets' }) }; } catch {} }
  return { statusCode: 200, body: JSON.stringify({ ok: true, mode: 'demo-memory' }) };
}
