const memory = globalThis.__loanwiseRecords || (globalThis.__loanwiseRecords = []);
export async function handler(event) {
  const method = event.httpMethod || 'GET';
  const params = event.queryStringParameters || {};
  if (method === 'GET') { const email = String(params.email || '').toLowerCase(); const records = email ? memory.filter((item) => !item.email || String(item.email).toLowerCase() === email) : memory; return { statusCode: 200, body: JSON.stringify({ records, mode: 'demo-memory' }) }; }
  if (method === 'DELETE') { const id = String(params.id || ''); const index = memory.findIndex((item) => item.id === id); if (index >= 0) memory.splice(index, 1); return { statusCode: 200, body: JSON.stringify({ ok: true, mode: 'demo-memory' }) }; }
  return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed.' }) };
}
