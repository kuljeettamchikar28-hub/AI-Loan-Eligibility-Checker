import test from 'node:test';
import assert from 'node:assert/strict';
import { emi, amortization, simulatePrepayment, calculateLoan, calculateCredit } from '../public/js/calculations.js';
import { validateLoanForm, validateCreditForm, validateEmiForm, isValidPhone, sanitizeText } from '../public/js/validation.js';

test('EMI matches a known 12-month case', () => {
  assert.equal(Math.round(emi(100000, 12, 12)), 8885);
});

test('zero-interest EMI is principal divided by months', () => {
  assert.equal(emi(120000, 0, 12), 10000);
});

test('amortization closes the loan and totals interest', () => {
  const rows = amortization(100000, 12, 12);
  assert.equal(rows.length, 12);
  assert.ok(rows.at(-1).balance < 0.01);
  assert.ok(rows.reduce((sum, row) => sum + row.interest, 0) > 0);
});

test('prepayment reduces interest or tenure', () => {
  const result = simulatePrepayment(1000000, 10, 60, 5000, 0);
  assert.ok(result.interestSaved > 0);
  assert.ok(result.monthsReduced > 0);
});

test('loan rules hard reject weak profile', () => {
  const result = calculateLoan({ age: 20, income: 12000, obligations: 3000, creditScore: 520, loanAmount: 500000, loanType: 'Personal', tenure: 48, employment: 'Unemployed' });
  assert.equal(result.status, 'Not Eligible');
  assert.ok(result.reasons.length >= 3);
});

test('loan rules approve a comfortable profile', () => {
  const result = calculateLoan({ age: 32, income: 120000, obligations: 10000, creditScore: 780, loanAmount: 1200000, loanType: 'Personal', tenure: 48, employment: 'Salaried' });
  assert.equal(result.status, 'Eligible');
  assert.ok(result.maxEligible > 0);
  assert.ok(result.foir < 0.5);
});

test('credit model respects weighted factors and bands', () => {
  const result = calculateCredit({ paymentHistory: 100, utilization: 10, creditAge: 10, activeAccounts: 5, inquiries: 0, creditMix: 'Excellent', defaults: 'No' });
  assert.ok(result.estimatedScore >= 800);
  assert.equal(result.band, 'Excellent');
  assert.equal(result.risk, 'Low');
});

test('credit model flags defaults and high utilization', () => {
  const result = calculateCredit({ paymentHistory: 72, utilization: 85, creditAge: 1, activeAccounts: 2, inquiries: 4, creditMix: 'Limited', defaults: 'Yes' });
  assert.ok(result.estimatedScore < 650);
  assert.equal(result.risk, 'High');
});

test('validation handles Indian phone and dangerous text', () => {
  assert.equal(isValidPhone('9876543210'), true);
  assert.equal(isValidPhone('1234567890'), false);
  assert.equal(sanitizeText('<script>alert(1)</script>'), 'scriptalert(1)/script');
  const errors = validateLoanForm({ name: '<x>', email: 'bad', phone: '123', age: 17, income: -2, obligations: 4, creditScore: 950, loanAmount: 0, tenure: 500, city: '', consent: false });
  assert.ok(Object.keys(errors).length >= 8);
});

test('validation accepts a sound form and rejects invalid EMI inputs', () => {
  const errors = validateCreditForm({ paymentHistory: 98, utilization: 20, creditAge: 6, activeAccounts: 4, inquiries: 1, consent: true });
  assert.deepEqual(errors, {});
  assert.ok(Object.keys(validateEmiForm({ amount: -1, rate: 55, months: 0 })).length === 3);
});
