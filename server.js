import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const root = path.resolve('public');
const port = Number(process.env.PORT || 3000);
const allowedOrigin = process.env.ALLOWED_ORIGIN || '*';
const serverRecords = [];
const rateMap = new Map();
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.xml': 'application/xml; charset=utf-8', '.txt': 'text/plain; charset=utf-8' };

function headers(extra = {}) { return { 'Access-Control-Allow-Origin': allowedOrigin, 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS', 'X-Content-Type-Options': 'nosniff', ...extra }; }
function send(res, status, body, extra = {}) { const payload = typeof body === 'string' ? body : JSON.stringify(body); res.writeHead(status, headers({ 'Content-Type': typeof body === 'string' ? 'text/plain; charset=utf-8' : 'application/json; charset=utf-8', ...extra })); res.end(payload); }
async function body(req) { let value = ''; for await (const chunk of req) value += chunk; if (value.length > 200000) throw new Error('Payload too large.'); return value ? JSON.parse(value) : {}; }
function rateLimited(ip) { const now = Date.now(); const windowMs = 60_000; const limit = Number(process.env.RATE_LIMIT_PER_MINUTE || 20); const current = (rateMap.get(ip) || []).filter((stamp) => now - stamp < windowMs); current.push(now); rateMap.set(ip, current); return current.length > limit; }
function mockText(kind, prompt = '') { const subject = kind === 'credit' ? 'credit profile' : kind === 'loan' ? 'loan estimate' : 'financial question'; return `Here is a practical read on your ${subject}: start with the factor you can change fastest, keep monthly commitments comfortable, and compare the total repayment amount. Your result is an estimate for education only, not a lender approval, offer, or financial advice.${prompt ? ' Ask a qualified adviser or lender for a product-specific decision.' : ''}`; }
async function claude(req, res) {
  if (rateLimited(req.socket.remoteAddress || 'unknown')) return send(res, 429, { error: 'Please wait a moment before trying again.' });
  const data = await body(req); const kind = String(data.kind || 'tips');
  if (!process.env.ANTHROPIC_API_KEY) return send(res, 200, { text: mockText(kind, data.prompt), mode: 'demo' });
  const model = process.env.CLAUDE_MODEL || 'claude-sonnet-4-5';
  const system = 'Act as a friendly, expert Indian personal-finance assistant. Use ₹ and Indian number formatting, be concise and actionable, never guarantee loan approval, never ask for PAN, Aadhaar, OTP, or bank passwords, and end with a short disclaimer that this is educational, not financial advice.';
  const response = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' }, body: JSON.stringify({ model, max_tokens: 600, system, messages: [{ role: 'user', content: `Question: ${String(data.prompt || '').slice(0, 3000)}\nContext: ${JSON.stringify(data.context || {}).slice(0, 6000)}` }] }) });
  const result = await response.json(); if (!response.ok) return send(res, 502, { error: 'Claude could not respond right now.' });
  const text = Array.isArray(result.content) ? result.content.map((item) => item.text || '').join('\n') : '';
  return send(res, 200, { text: text || mockText(kind), mode: 'live' });
}
async function saveRecord(req, res) {
  const record = await body(req); if (!record.module || !record.id) return send(res, 400, { error: 'Record module and id are required.' });
  const clean = { ...record, name: String(record.name || '').slice(0, 80), email: String(record.email || '').slice(0, 160), phone: String(record.phone || '').slice(0, 20), summary: String(record.summary || '').slice(0, 300) };
  const index = serverRecords.findIndex((item) => item.id === clean.id); if (index >= 0) serverRecords[index] = clean; else serverRecords.unshift(clean);
  if (process.env.GOOGLE_APPS_SCRIPT_URL) {
    try { await fetch(process.env.GOOGLE_APPS_SCRIPT_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(clean) }); return send(res, 200, { ok: true, mode: 'google-sheets' }); }
    catch { return send(res, 200, { ok: true, mode: 'local-queue', warning: 'Google Sheets is unavailable; record kept in this session.' }); }
  }
  return send(res, 200, { ok: true, mode: 'demo-memory' });
}
async function getRecords(req, res, url) { const email = String(url.searchParams.get('email') || '').toLowerCase(); const records = email ? serverRecords.filter((item) => !item.email || item.email.toLowerCase() === email) : serverRecords; return send(res, 200, { records, mode: process.env.GOOGLE_APPS_SCRIPT_URL ? 'google-sheets-compatible' : 'demo-memory' }); }
async function deleteRecord(req, res, url) { const id = url.searchParams.get('id'); const index = serverRecords.findIndex((item) => item.id === id); if (index >= 0) serverRecords.splice(index, 1); return send(res, 200, { ok: true, mode: 'demo-memory' }); }

async function staticFile(req, res, urlPath) {
  const requested = urlPath === '/' ? '/index.html' : urlPath;
  const safePath = path.normalize(requested).replace(/^\/+/, '');
  const fullPath = path.join(root, safePath);
  if (!fullPath.startsWith(root)) return send(res, 403, 'Forbidden');
  try { const data = await fs.readFile(fullPath); const ext = path.extname(fullPath); const extra = (ext === '.html' || ext === '.json') ? { 'Cache-Control': 'no-cache' } : { 'Cache-Control': 'public, max-age=3600' }; res.writeHead(200, headers({ 'Content-Type': mime[ext] || 'application/octet-stream', ...extra })); res.end(data); }
  catch { send(res, 404, 'Not found'); }
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'OPTIONS') return send(res, 204, '');
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    if (url.pathname === '/api/claude' && req.method === 'POST') return await claude(req, res);
    if (url.pathname === '/api/save-record' && req.method === 'POST') return await saveRecord(req, res);
    if (url.pathname === '/api/get-records' && req.method === 'GET') return await getRecords(req, res, url);
    if (url.pathname === '/api/delete-record' && req.method === 'DELETE') return await deleteRecord(req, res, url);
    if (url.pathname.startsWith('/api/')) return send(res, 404, { error: 'API route not found.' });
    return await staticFile(req, res, url.pathname);
  } catch (error) { return send(res, 400, { error: error.message || 'Request failed.' }); }
});

server.listen(port, '0.0.0.0', () => console.log(`LoanWise AI listening on http://0.0.0.0:${port}`));
