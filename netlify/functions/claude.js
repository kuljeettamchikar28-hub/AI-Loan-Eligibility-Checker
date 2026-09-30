export async function handler(event) {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed.' }) };
  let input = {};
  try { input = JSON.parse(event.body || '{}'); } catch { return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON.' }) }; }
  const kind = String(input.kind || 'tips');
  if (!process.env.ANTHROPIC_API_KEY) return { statusCode: 200, body: JSON.stringify({ mode: 'demo', text: 'Here is a practical read: keep monthly commitments comfortable, improve the factor you can change fastest, and compare total repayment. This is educational information, not a lender decision or financial advice.' }) };
  const response = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' }, body: JSON.stringify({ model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-5', max_tokens: 600, system: 'Act as a friendly Indian personal-finance assistant. Use ₹, never request PAN, Aadhaar, OTP, or passwords, never guarantee approval, and include an educational disclaimer.', messages: [{ role: 'user', content: `${String(input.prompt || '').slice(0, 3000)}\nContext: ${JSON.stringify(input.context || {}).slice(0, 6000)}` }] }) });
  const data = await response.json(); const text = Array.isArray(data.content) ? data.content.map((item) => item.text || '').join('\n') : '';
  return { statusCode: response.ok ? 200 : 502, body: JSON.stringify(response.ok ? { mode: 'live', text } : { error: 'Claude unavailable.' }) };
}
