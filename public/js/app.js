import { calculateLoan, calculateCredit, emi, amortization, simulatePrepayment, clamp } from './calculations.js';
import { validateLoanForm, validateCreditForm, validateEmiForm, escapeHTML, sanitizeText } from './validation.js';
import { askClaude, saveRecord, getRecords, deleteRecord, recordsToCSV } from './api.js';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const money = (value, compact = false) => {
  const number = Number(value) || 0;
  if (compact && number >= 10000000) return `₹${(number / 10000000).toFixed(1)} Cr`;
  if (compact && number >= 100000) return `₹${(number / 100000).toFixed(1)} L`;
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(number);
};
const percent = (value) => `${(Number(value || 0) * 100).toFixed(1)}%`;
const number = (value) => new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(Number(value) || 0);
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function injectChrome() {
  const page = document.body.dataset.page || '';
  const links = [
    ['/', 'Home', 'home'], ['loan.html', 'Loan check', 'loan'], ['credit.html', 'Credit', 'credit'], ['emi.html', 'EMI', 'emi'], ['tips.html', 'AI tips', 'tips'], ['records.html', 'My records', 'records']
  ];
  const header = $('#site-header');
  if (header) header.innerHTML = `<div class="container nav-wrap"><nav class="nav" aria-label="Primary navigation"><a class="brand" href="/" aria-label="LoanWise AI home"><img src="/assets/loanwise-mark.svg" alt=""/><span class="brand-text">LoanWise<small>AI</small></span></a><button class="menu-toggle" aria-expanded="false" aria-controls="primary-links" aria-label="Open menu">☰</button><div class="nav-links" id="primary-links">${links.map(([href, label, key]) => `<a class="${page === key ? 'active' : ''}" href="${href}">${label}</a>`).join('')}<a class="btn btn-primary nav-cta" href="loan.html">Check eligibility <span aria-hidden="true">↗</span></a></div></nav></div>`;
  const menu = $('.menu-toggle'); const navLinks = $('.nav-links');
  menu?.addEventListener('click', () => { const open = navLinks.classList.toggle('open'); menu.setAttribute('aria-expanded', String(open)); menu.textContent = open ? '×' : '☰'; });
  const footer = $('#site-footer');
  if (footer) footer.innerHTML = `<div class="container footer"><div class="footer-grid"><div><a class="brand" href="/"><img src="/assets/loanwise-mark.svg" alt=""/><span class="brand-text">LoanWise<small>AI</small></span></a><p class="footer-note" style="margin-top:14px">A calm second opinion for Indian borrowing decisions. Estimates are directional and never a promise of credit.</p></div><div class="footer-links"><a href="/privacy.html">Privacy</a><a href="/terms.html">Terms</a><a href="/records.html">Delete my data</a><a href="mailto:hello@loanwise.demo">Contact</a></div></div><p class="footer-note" style="margin-top:28px">© ${new Date().getFullYear()} LoanWise AI · Built for transparent financial education.</p></div>`;
}

function toast(message, type = 'info') {
  let node = $('#toast');
  if (!node) { node = document.createElement('div'); node.id = 'toast'; node.className = 'toast'; document.body.append(node); }
  node.textContent = message; node.className = `toast show ${type}`;
  clearTimeout(node._timer); node._timer = setTimeout(() => node.classList.remove('show'), 3800);
}
function setText(selector, value, root = document) { const node = $(selector, root); if (node) node.textContent = value; }
function setHTML(selector, value, root = document) { const node = $(selector, root); if (node) node.innerHTML = value; }
function show(node) { node?.classList.remove('hidden'); }
function hide(node) { node?.classList.add('hidden'); }
function getFormData(form) { const data = Object.fromEntries(new FormData(form).entries()); $$('input[type="checkbox"]', form).forEach((input) => { data[input.name] = input.checked; }); return data; }
function renderErrors(form, errors) {
  $$('.field', form).forEach((field) => { field.classList.remove('invalid', 'valid'); const error = $('.error', field); if (error) error.textContent = ''; });
  Object.entries(errors).forEach(([key, message]) => { const field = form.querySelector(`[name="${key}"]`)?.closest('.field') || form.querySelector(`[name="${key}"]`)?.parentElement; field?.classList.add('invalid'); const error = field?.querySelector('.error'); if (error) error.textContent = message; });
  if (!Object.keys(errors).length) $$('.field', form).forEach((field) => field.classList.add('valid'));
}
function animateNumber(node, target, formatter = (value) => number(value)) {
  if (!node) return; const start = Number(node.dataset.value || 0); const duration = 650; const started = performance.now();
  const frame = (now) => { const progress = Math.min(1, (now - started) / duration); const eased = 1 - Math.pow(1 - progress, 3); const value = start + (target - start) * eased; node.textContent = formatter(value); if (progress < 1) requestAnimationFrame(frame); else node.dataset.value = target; };
  requestAnimationFrame(frame);
}
function renderBars(container, items) {
  if (!container) return; container.innerHTML = items.map((item) => `<div class="factor"><span>${escapeHTML(item.label)}</span><div class="bar"><i style="width:${clamp(item.value, 0, 100)}%"></i></div><b>${Math.round(item.value)}%</b></div>`).join('');
}
function statusClass(status) { return status === 'Eligible' || status === 'Low' ? '' : status === 'Conditionally Eligible' || status === 'Medium' ? 'warn' : 'danger'; }

function initHome() {
  const countNodes = $$('.count-up');
  countNodes.forEach((node) => { const target = Number(node.dataset.target || 0); animateNumber(node, target, (value) => `${Math.round(value)}%`); });
  $$('.reveal').forEach((node, index) => { node.style.animationDelay = `${Math.min(index * 60, 360)}ms`; });
}

function initLoan() {
  const form = $('#loan-form'); const result = $('#loan-result'); if (!form || !result) return;
  let latest;
  const updateAI = (text, mode) => { setHTML('#loan-ai-copy', escapeHTML(text).replace(/\n/g, '<br>')); setText('#loan-ai-mode', mode === 'demo' ? 'Demo guidance · add Claude key for live explanations' : 'Claude explanation'); show($('#loan-ai-output')); };
  form.addEventListener('input', () => { const errors = validateLoanForm({ ...getFormData(form), consent: true }); Object.entries(errors).forEach(([key]) => { if (key !== 'consent') { const field = form.querySelector(`[name="${key}"]`)?.closest('.field'); if (field) field.classList.add('invalid'); } }); });
  form.addEventListener('submit', async (event) => {
    event.preventDefault(); const input = getFormData(form); const errors = validateLoanForm(input); renderErrors(form, errors); if (Object.keys(errors).length) { toast('Please review the highlighted fields.', 'error'); return; }
    latest = calculateLoan(input); sessionStorage.setItem('loanwise-latest-profile', JSON.stringify({ ...input, result: latest })); show(result); result.classList.add('reveal');
    setText('#loan-status', latest.status); $('#loan-status').className = `pill ${statusClass(latest.status)}`;
    setText('#loan-band', `${latest.rateBand[0].toFixed(1)}–${latest.rateBand[1].toFixed(1)}% p.a.`); setText('#loan-foir', percent(latest.foir)); setText('#loan-max', money(latest.maxEligible, true));
    setText('#loan-emi', money(latest.proposedEmi)); setText('#loan-maturity', `${latest.maturityAge.toFixed(1)} yrs`); animateNumber($('#loan-score'), latest.score, (v) => Math.round(v)); $('#loan-gauge').style.setProperty('--value', latest.score); setText('#loan-gauge-label', latest.score >= 70 ? 'Strong estimate' : latest.score >= 50 ? 'Review needed' : 'Needs work');
    setHTML('#loan-reasons', latest.reasons.map((item) => `<li>${escapeHTML(item)}</li>`).join('')); setHTML('#loan-improvements', latest.improvements.map((item) => `<li>${escapeHTML(item)}</li>`).join(''));
    renderBars($('#loan-breakdown'), [{ label: 'Income fit', value: clamp(input.income / 100000 * 100, 20, 100) }, { label: 'Credit signal', value: ((Number(input.creditScore) - 300) / 600) * 100 }, { label: 'Repayment room', value: clamp((1 - latest.foir) * 100, 0, 100) }]);
    show($('#loan-ai-btn')); const saved = await saveRecord({ module: 'LoanEligibility', email: input.email, name: input.name, phone: input.phone, summary: `${latest.status} · ${money(latest.maxEligible, true)} max estimate`, inputs: input, result: latest }); toast(saved.storage === 'local-demo' ? 'Result saved to this browser session.' : 'Result saved to My Records.', 'success');
  });
  $('#loan-ai-btn')?.addEventListener('click', async () => { if (!latest) return; const btn = $('#loan-ai-btn'); btn.disabled = true; btn.textContent = 'Thinking…'; const response = await askClaude({ kind: 'loan', prompt: 'Explain my loan estimate in plain language and give three practical next steps.', context: latest }); updateAI(response.text, response.mode); btn.disabled = false; btn.textContent = 'Refresh AI explanation'; });
}

function initCredit() {
  const form = $('#credit-form'); const result = $('#credit-result'); if (!form || !result) return;
  let latest;
  form.addEventListener('submit', async (event) => {
    event.preventDefault(); const input = getFormData(form); const errors = validateCreditForm(input); renderErrors(form, errors); if (Object.keys(errors).length) { toast('Please review the highlighted fields.', 'error'); return; }
    latest = calculateCredit(input); sessionStorage.setItem('loanwise-latest-profile', JSON.stringify({ ...input, result: latest })); show(result); setText('#credit-band', latest.band); $('#credit-band').className = `pill ${statusClass(latest.risk)}`; setText('#credit-risk', latest.risk); $('#credit-risk').className = `pill ${statusClass(latest.risk)}`; animateNumber($('#credit-score'), latest.estimatedScore, (v) => Math.round(v)); $('#credit-gauge').style.setProperty('--value', ((latest.estimatedScore - 300) / 600) * 100); setText('#credit-score-label', 'ESTIMATED · NOT AN OFFICIAL BUREAU SCORE');
    renderBars($('#credit-factors'), latest.factors.map((factor) => ({ label: factor.label, value: factor.score }))); setHTML('#credit-insights', latest.insights.map((item) => `<li>${escapeHTML(item)}</li>`).join('')); show($('#credit-ai-btn')); const saved = await saveRecord({ module: 'CreditScore', email: input.email || '', name: input.name || '', summary: `${latest.estimatedScore} estimated · ${latest.risk} risk`, inputs: input, result: latest }); toast(saved.storage === 'local-demo' ? 'Estimate saved to this browser session.' : 'Estimate saved to My Records.', 'success');
  });
  $('#credit-ai-btn')?.addEventListener('click', async () => { if (!latest) return; const btn = $('#credit-ai-btn'); btn.disabled = true; btn.textContent = 'Building plan…'; const response = await askClaude({ kind: 'credit', prompt: 'Create a personalised 30/60/90-day credit improvement plan with measurable actions.', context: latest }); setHTML('#credit-ai-copy', escapeHTML(response.text).replace(/\n/g, '<br>')); setText('#credit-ai-mode', response.mode === 'demo' ? 'Demo guidance · add Claude key for live plans' : 'Claude improvement plan'); show($('#credit-ai-output')); btn.disabled = false; btn.textContent = 'Refresh improvement plan'; });
}

function initEMI() {
  const form = $('#emi-form'); if (!form) return;
  const amount = $('#emi-amount'); const rate = $('#emi-rate'); const months = $('#emi-months'); const amountRange = $('#emi-amount-range'); const rateRange = $('#emi-rate-range'); const monthsRange = $('#emi-months-range');
  const sync = (source, target) => source?.addEventListener('input', () => { target.value = source.value; render(); });
  let unit = 'months';
  const render = () => {
    const input = { amount: amount.value, rate: rate.value, months: months.value }; const errors = validateEmiForm(input); if (Object.keys(errors).length) return;
    const P = Number(input.amount); const r = Number(input.rate); const n = Number(input.months); const monthly = emi(P, r, n); const rows = amortization(P, r, n); const interest = rows.reduce((sum, row) => sum + row.interest, 0); const total = P + interest;
    setText('#emi-value', money(monthly)); setText('#emi-interest', money(interest)); setText('#emi-total', money(total)); setText('#emi-principal', money(P)); setText('#emi-rate-label', `${r.toFixed(2)}% p.a.`); setText('#emi-tenure-label', `${n} months`); setText('#donut-principal', `${Math.round(P / Math.max(total, 1) * 100)}% principal`); $('#donut').style.background = `conic-gradient(var(--cyan) 0 ${P / Math.max(total, 1) * 100}%, var(--violet) ${P / Math.max(total, 1) * 100}% 100%)`;
    const yearly = []; rows.forEach((row) => { const year = Math.ceil(row.month / 12); if (!yearly[year - 1]) yearly[year - 1] = { year, principal: 0, interest: 0, closing: 0 }; yearly[year - 1].principal += row.principal; yearly[year - 1].interest += row.interest; yearly[year - 1].closing = row.balance; });
    setHTML('#amortization-body', yearly.map((row) => `<tr><td>Year ${row.year}</td><td>${money(row.principal)}</td><td>${money(row.interest)}</td><td>${money(row.closing)}</td></tr>`).join(''));
    const prepay = simulatePrepayment(P, r, n, $('#extra-payment')?.value, $('#lump-sum')?.value); setText('#prepay-interest', money(prepay.interestSaved)); setText('#prepay-tenure', `${prepay.monthsReduced} months`); setText('#prepay-note', prepay.monthsReduced ? 'A little extra each month can make a meaningful difference.' : 'Add a monthly extra payment or lump sum to simulate savings.');
    const compareAmount = Number($('#compare-amount')?.value || 0); const compareRate = Number($('#compare-rate')?.value || 0); const compareMonths = Number($('#compare-months')?.value || 0); if (compareAmount && compareRate && compareMonths) { const compareEmi = emi(compareAmount, compareRate, compareMonths); setText('#compare-emi', money(compareEmi)); setText('#compare-interest', money(Math.max(0, compareEmi * compareMonths - compareAmount))); }
  };
  sync(amount, amountRange); sync(amountRange, amount); sync(rate, rateRange); sync(rateRange, rate); sync(months, monthsRange); sync(monthsRange, months); ['input', 'change'].forEach((event) => form.addEventListener(event, render));
  $$('.unit-btn').forEach((button) => button.addEventListener('click', () => { $$('.unit-btn').forEach((item) => item.classList.remove('active')); button.classList.add('active'); unit = button.dataset.unit; const value = Number(months.value); months.value = unit === 'years' ? Math.round(value / 12) : Math.round(value * 12); render(); }));
  $('#save-emi')?.addEventListener('click', async () => { const saved = await saveRecord({ module: 'EMIHistory', summary: `${money(Number($('#emi-value').textContent.replace(/[^0-9.]/g, '')))} monthly EMI estimate`, inputs: { amount: amount.value, rate: rate.value, months: months.value }, result: { emi: emi(amount.value, rate.value, months.value) } }); toast(saved.storage === 'local-demo' ? 'EMI saved to this browser session.' : 'EMI saved to My Records.', 'success'); });
  render();
}

function addMessage(role, text) { const list = $('#messages'); if (!list) return; const node = document.createElement('div'); node.className = `message ${role === 'user' ? 'user' : ''}`; node.innerHTML = `<small>${role === 'user' ? 'You' : 'LoanWise AI'}</small>${escapeHTML(text).replace(/\n/g, '<br>')}`; list.append(node); list.scrollTop = list.scrollHeight; }
function initTips() {
  const form = $('#chat-form'); const input = $('#chat-input'); if (!form || !input) return; const history = [];
  const send = async (text) => { const clean = sanitizeText(text, 500); if (!clean) return; history.push({ role: 'user', text: clean }); addMessage('user', clean); input.value = ''; const typing = document.createElement('div'); typing.className = 'message typing'; typing.innerHTML = '<i></i><i></i><i></i>'; $('#messages').append(typing); $('#messages').scrollTop = $('#messages').scrollHeight; let context = {}; try { context = $('#use-profile')?.checked ? JSON.parse(sessionStorage.getItem('loanwise-latest-profile') || '{}') : {}; } catch {} const response = await askClaude({ kind: 'tips', prompt: clean, context }); typing.remove(); history.push({ role: 'assistant', text: response.text }); addMessage('assistant', response.text); if (response.mode === 'demo') setText('#chat-mode', 'Demo guidance · add Claude key for live answers'); };
  $$('.chip').forEach((chip) => chip.addEventListener('click', () => send(chip.textContent)));
  form.addEventListener('submit', (event) => { event.preventDefault(); send(input.value); });
  $('#save-chat')?.addEventListener('click', async () => { if (!history.length) { toast('Ask at least one question before saving.', 'error'); return; } const saved = await saveRecord({ module: 'AIChats', summary: `${history.length} message chat`, inputs: { messages: history }, result: { messages: history } }); toast(saved.storage === 'local-demo' ? 'Chat saved to this browser session.' : 'Chat saved to My Records.', 'success'); });
}

function initRecords() {
  const form = $('#records-form'); const list = $('#records-list'); if (!form || !list) return;
  let records = [];
  const render = () => { const query = ($('#record-search')?.value || '').toLowerCase(); const module = $('#record-filter')?.value || 'all'; const filtered = records.filter((record) => (!query || JSON.stringify(record).toLowerCase().includes(query)) && (module === 'all' || record.module === module)); if (!filtered.length) { list.innerHTML = '<div class="empty-state">No matching records yet. Run a calculator or analyzer and save the result here.</div>'; return; } list.innerHTML = filtered.map((record) => `<article class="glass card-sm record-card"><header><div><strong>${escapeHTML(record.module || 'LoanWise')}</strong><div class="record-meta">${new Date(record.timestamp).toLocaleString('en-IN')} · ${escapeHTML(record.id || '')}</div></div><button class="btn btn-danger delete-record" data-id="${escapeHTML(record.id)}">Delete</button></header><p>${escapeHTML(record.summary || 'Saved estimate')}</p><span class="badge">${record.storage === 'local-demo' ? 'This browser session' : 'Saved record'}</span></article>`).join(''); $$('.delete-record', list).forEach((button) => button.addEventListener('click', async () => { const id = button.dataset.id; const result = await deleteRecord(id); records = records.filter((record) => record.id !== id); render(); toast(result.mode === 'local-demo' ? 'Deleted from this browser.' : 'Record deleted.', 'success'); })); };
  form.addEventListener('submit', async (event) => { event.preventDefault(); const data = await getRecords($('#record-email').value); records = data.records; render(); setText('#records-mode', data.mode === 'local-demo' ? 'Showing browser-session records' : 'Showing synced records'); });
  ['input', 'change'].forEach((event) => { $('#record-search')?.addEventListener(event, render); $('#record-filter')?.addEventListener(event, render); });
  $('#export-records')?.addEventListener('click', () => { const blob = recordsToCSV(records); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = 'loanwise-records.csv'; link.click(); URL.revokeObjectURL(link.href); toast('CSV export downloaded.', 'success'); });
  $('#delete-all')?.addEventListener('click', () => { localStorage.removeItem('loanwise-records-v1'); records = []; render(); toast('Browser-session records deleted.', 'success'); });
  render();
}

function init() { injectChrome(); const page = document.body.dataset.page; ({ home: initHome, loan: initLoan, credit: initCredit, emi: initEMI, tips: initTips, records: initRecords }[page] || (() => {}))(); }

document.addEventListener('DOMContentLoaded', init);
