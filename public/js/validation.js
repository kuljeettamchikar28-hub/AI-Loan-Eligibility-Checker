export const isValidName = (value) => /^[A-Za-zÀ-ÖØ-öø-ÿ ]{2,60}$/.test(String(value || '').trim());
export const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(value || '').trim());
export const isValidPhone = (value) => /^[6-9]\d{9}$/.test(String(value || '').trim());
export const isFinitePositive = (value, max = Number.MAX_SAFE_INTEGER) => Number.isFinite(Number(value)) && Number(value) > 0 && Number(value) <= max;
export const sanitizeText = (value, max = 500) => String(value ?? '').replace(/[<>]/g, '').replace(/[\u0000-\u001F\u007F]/g, '').trim().slice(0, max);
export const escapeHTML = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));

export function validateLoanForm(input) {
  const errors = {};
  if (!isValidName(input.name)) errors.name = 'Use 2–60 letters and spaces only.';
  if (!isValidEmail(input.email)) errors.email = 'Enter a valid email address.';
  if (!isValidPhone(input.phone)) errors.phone = 'Use a 10-digit Indian mobile number starting with 6–9.';
  const age = Number(input.age);
  if (!Number.isInteger(age) || age < 18 || age > 70) errors.age = 'Age must be a whole number between 18 and 70.';
  if (!isFinitePositive(input.income, 100000000)) errors.income = 'Enter a realistic positive monthly income.';
  if (!Number.isFinite(Number(input.obligations)) || Number(input.obligations) < 0 || Number(input.obligations) > Number(input.income || 0)) errors.obligations = 'Obligations must be between ₹0 and your monthly income.';
  const score = Number(input.creditScore);
  if (!Number.isInteger(score) || score < 300 || score > 900) errors.creditScore = 'Credit score must be an integer from 300 to 900.';
  if (!isFinitePositive(input.loanAmount, 1000000000)) errors.loanAmount = 'Enter a realistic positive loan amount.';
  const tenure = Number(input.tenure);
  if (!Number.isInteger(tenure) || tenure < 6 || tenure > 360) errors.tenure = 'Choose a tenure from 6 to 360 months.';
  if (!sanitizeText(input.city, 60)) errors.city = 'Add your city.';
  if (!input.consent) errors.consent = 'Consent is required to save or use this profile.';
  return errors;
}

export function validateCreditForm(input) {
  const errors = {};
  const payment = Number(input.paymentHistory); const utilization = Number(input.utilization); const age = Number(input.creditAge); const accounts = Number(input.activeAccounts); const inquiries = Number(input.inquiries);
  if (!Number.isFinite(payment) || payment < 0 || payment > 100) errors.paymentHistory = 'Use a percentage from 0 to 100.';
  if (!Number.isFinite(utilization) || utilization < 0 || utilization > 100) errors.utilization = 'Use a percentage from 0 to 100.';
  if (!Number.isFinite(age) || age < 0 || age > 40) errors.creditAge = 'Use a credit age from 0 to 40 years.';
  if (!Number.isInteger(accounts) || accounts < 0 || accounts > 100) errors.activeAccounts = 'Use a whole number from 0 to 100.';
  if (!Number.isInteger(inquiries) || inquiries < 0 || inquiries > 30) errors.inquiries = 'Use a whole number from 0 to 30.';
  if (!input.consent) errors.consent = 'Consent is required to save or use this profile.';
  return errors;
}

export function validateEmiForm(input) {
  const errors = {};
  if (!isFinitePositive(input.amount, 1000000000)) errors.amount = 'Enter a positive loan amount.';
  if (!Number.isFinite(Number(input.rate)) || Number(input.rate) < 0 || Number(input.rate) > 40) errors.rate = 'Use an annual rate from 0% to 40%.';
  if (!Number.isInteger(Number(input.months)) || Number(input.months) < 1 || Number(input.months) > 480) errors.months = 'Use a tenure from 1 to 480 months.';
  return errors;
}
