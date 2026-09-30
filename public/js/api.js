import { escapeHTML } from './validation.js';

const localKey = 'loanwise-records-v1';
const readLocal = () => { try { return JSON.parse(localStorage.getItem(localKey) || '[]'); } catch { return []; } };
const writeLocal = (records) => localStorage.setItem(localKey, JSON.stringify(records));
const uid = () => `LW-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

const mockAnswers = {
  loan: 'Based on the inputs you shared, your estimate is shaped most by income, existing monthly obligations, credit score, and tenure. Keep the requested amount within the suggested range, compare the rate band, and remember that a lender may use additional checks. This educational explanation is not an approval or offer.',
  credit: 'Your estimated score is a directional starting point, not an official bureau score. Over the next 30 days, protect payment history and reduce utilization; over 60 days, avoid unnecessary applications; over 90 days, review the report for errors and keep the strongest habits consistent.',
  tips: 'A practical next step is to write down monthly take-home income, fixed commitments, and flexible spending. Keep total EMIs comfortable, build a small emergency buffer, and compare total repayment—not only the advertised interest rate. This is educational information, not financial advice.'
};

async function jsonRequest(url, options = {}) {
  const response = await fetch(url, { headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }, ...options });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'The secure service is unavailable right now.');
  return data;
}

export async function askClaude({ kind, prompt, context }) {
  try {
    const data = await jsonRequest('/api/claude', { method: 'POST', body: JSON.stringify({ kind, prompt, context }) });
    return { text: data.text || mockAnswers[kind] || mockAnswers.tips, mode: data.mode || 'live' };
  } catch (error) {
    return { text: mockAnswers[kind] || mockAnswers.tips, mode: 'demo', error: error.message };
  }
}

export async function saveRecord(record) {
  const safeRecord = { ...record, id: record.id || uid(), timestamp: record.timestamp || new Date().toISOString() };
  const records = readLocal();
  writeLocal([safeRecord, ...records].slice(0, 100));
  try {
    const data = await jsonRequest('/api/save-record', { method: 'POST', body: JSON.stringify(safeRecord) });
    return { ...safeRecord, storage: data.mode || 'local+server' };
  } catch (error) {
    return { ...safeRecord, storage: 'local-demo', warning: error.message };
  }
}

export async function getRecords(email = '') {
  const local = readLocal();
  try {
    const data = await jsonRequest(`/api/get-records?email=${encodeURIComponent(email)}`);
    const remote = Array.isArray(data.records) ? data.records : [];
    const merged = [...remote, ...local].filter((record, index, all) => all.findIndex((item) => item.id === record.id) === index);
    return { records: merged, mode: data.mode || 'server' };
  } catch {
    return { records: email ? local.filter((record) => !record.email || record.email.toLowerCase() === email.toLowerCase()) : local, mode: 'local-demo' };
  }
}

export async function deleteRecord(id) {
  writeLocal(readLocal().filter((record) => record.id !== id));
  try { await jsonRequest(`/api/delete-record?id=${encodeURIComponent(id)}`, { method: 'DELETE' }); return { mode: 'server' }; }
  catch { return { mode: 'local-demo' }; }
}

export function recordsToCSV(records) {
  const rows = records.map((record) => ({ id: record.id, timestamp: record.timestamp, module: record.module, email: record.email || '', summary: record.summary || '' }));
  const header = ['id', 'timestamp', 'module', 'email', 'summary'];
  const csv = [header, ...rows.map((row) => header.map((key) => `"${String(row[key] ?? '').replaceAll('"', '""')}"`))].map((row) => row.join(',')).join('\n');
  return new Blob([csv], { type: 'text/csv;charset=utf-8' });
}

export { escapeHTML };
