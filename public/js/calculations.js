export const LOAN_CONFIG = {
  minIncome: { Personal: 15000, Home: 30000, Car: 20000, Education: 15000, Business: 25000 },
  incomeMultiple: { Salaried: 22, 'Self-Employed': 20, 'Business Owner': 18, Student: 10, Unemployed: 0 },
  employmentWeight: { Salaried: 1, 'Self-Employed': .92, 'Business Owner': .86, Student: .55, Unemployed: 0 },
  scoreMultiplier: { prime: 1.16, strong: 1.06, fair: .9, weak: .72 },
  rateBand: { prime: [8.5, 10.25], strong: [10.25, 12.25], fair: [12.25, 15.5], weak: [15.5, 19.5] },
  tenure: { Personal: [12, 60], Home: [60, 360], Car: [12, 84], Education: [12, 180], Business: [12, 84] }
};

export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
export const round = (value, places = 0) => Number(Number(value).toFixed(places));

export function getScoreBand(score) {
  if (score >= 750) return 'prime';
  if (score >= 700) return 'strong';
  if (score >= 650) return 'fair';
  return 'weak';
}

export function emi(principal, annualRate, months) {
  const P = Math.max(0, Number(principal) || 0);
  const n = Math.max(0, Math.round(Number(months) || 0));
  const annual = Math.max(0, Number(annualRate) || 0);
  if (!P || !n) return 0;
  const r = annual / 12 / 100;
  if (!r) return P / n;
  const growth = Math.pow(1 + r, n);
  return P * r * growth / (growth - 1);
}

export function amortization(principal, annualRate, months) {
  const P = Math.max(0, Number(principal) || 0);
  const n = Math.max(0, Math.round(Number(months) || 0));
  const rate = Math.max(0, Number(annualRate) || 0) / 12 / 100;
  const payment = emi(P, annualRate, n);
  let balance = P;
  const rows = [];
  for (let month = 1; month <= n && balance > .01; month += 1) {
    const interest = rate ? balance * rate : 0;
    const principalPaid = Math.min(balance, Math.max(0, payment - interest));
    const actualPayment = principalPaid + interest;
    balance = Math.max(0, balance - principalPaid);
    rows.push({ month, payment: actualPayment, principal: principalPaid, interest, balance });
  }
  return rows;
}

export function simulatePrepayment(principal, annualRate, months, extraMonthly = 0, lumpSum = 0) {
  const P = Math.max(0, Number(principal) || 0);
  const n = Math.max(0, Math.round(Number(months) || 0));
  const rate = Math.max(0, Number(annualRate) || 0) / 12 / 100;
  const basePayment = emi(P, annualRate, n);
  const extra = Math.max(0, Number(extraMonthly) || 0);
  let balance = Math.max(0, P - Math.max(0, Number(lumpSum) || 0));
  let interest = 0;
  let count = 0;
  while (balance > .01 && count < 1200) {
    const monthInterest = rate ? balance * rate : 0;
    const paid = Math.min(balance, Math.max(0, basePayment + extra - monthInterest));
    interest += monthInterest;
    balance = Math.max(0, balance - paid);
    count += 1;
    if (paid <= 0) break;
  }
  const base = amortization(P, annualRate, n);
  const baseInterest = base.reduce((sum, row) => sum + row.interest, 0);
  return { basePayment, months: count, interest, interestSaved: Math.max(0, baseInterest - interest), monthsReduced: Math.max(0, n - count), baseInterest };
}

export function calculateLoan(input) {
  const age = Number(input.age) || 0;
  const income = Math.max(0, Number(input.income) || 0);
  const obligations = Math.max(0, Number(input.obligations) || 0);
  const creditScore = clamp(Number(input.creditScore) || 0, 300, 900);
  const desiredAmount = Math.max(0, Number(input.loanAmount) || 0);
  const tenure = Math.max(1, Math.round(Number(input.tenure) || 1));
  const loanType = input.loanType || 'Personal';
  const employment = input.employment || 'Salaried';
  const band = getScoreBand(creditScore);
  const rate = (LOAN_CONFIG.rateBand[band][0] + LOAN_CONFIG.rateBand[band][1]) / 2;
  const proposedEmi = emi(desiredAmount, rate, tenure);
  const foir = income ? (obligations + proposedEmi) / income : 1;
  const maturityAge = age + tenure / 12;
  const reasons = [];
  const improvements = [];
  let score = 100;
  let hardReject = false;

  if (age < 21) { hardReject = true; score -= 35; reasons.push('Applicants should be at least 21 at application.'); }
  if (age > 65 || maturityAge > 70) { hardReject = true; score -= 32; reasons.push('The estimated age at loan maturity is outside the indicative limit of 70.'); }
  if (income < (LOAN_CONFIG.minIncome[loanType] || 15000)) { hardReject = true; score -= 24; reasons.push(`Monthly income is below the indicative ${loanType.toLowerCase()} threshold.`); }
  if (creditScore < 550) { hardReject = true; score -= 32; reasons.push('Credit score below 550 is a high-risk signal in this estimate.'); }
  if (employment === 'Unemployed' && income <= 0) { hardReject = true; score -= 30; reasons.push('An active income source is needed for this estimate.'); }
  if (obligations > income && income > 0) { hardReject = true; score -= 28; reasons.push('Existing monthly obligations exceed monthly income.'); }
  if (foir > .6) { score -= 30; reasons.push('Estimated FOIR is above 60%, leaving limited repayment headroom.'); }
  else if (foir > .5) { score -= 14; reasons.push('Estimated FOIR is between 50% and 60%, so the result is conditional.'); }
  else { score += 3; }
  if (creditScore < 700) { improvements.push('Reduce revolving utilization and keep every payment on time.'); score -= 8; }
  if (obligations > income * .35) { improvements.push('Consider reducing existing EMIs before applying.'); score -= 7; }
  if (maturityAge > 65) improvements.push('A shorter tenure or co-applicant may improve the maturity-age fit.');
  if (desiredAmount > income * 18) improvements.push('Try a lower loan amount to improve the repayment ratio.');

  const tenureFactor = clamp(tenure / 60, .45, 1.35);
  const baseEligible = income * (LOAN_CONFIG.incomeMultiple[employment] || 0) * (LOAN_CONFIG.employmentWeight[employment] || 0) * LOAN_CONFIG.scoreMultiplier[band] * tenureFactor;
  const maxEligible = Math.max(0, Math.round(baseEligible / 5000) * 5000);
  const status = hardReject || foir > .6 || maxEligible < desiredAmount * .35 ? 'Not Eligible' : foir > .5 || desiredAmount > maxEligible ? 'Conditionally Eligible' : 'Eligible';
  if (status === 'Conditionally Eligible' && !reasons.some((item) => item.includes('conditional'))) reasons.push('The requested amount or repayment ratio needs a closer review.');
  if (!reasons.length) reasons.push('Income, credit profile, and estimated repayment ratio are within the indicative range.');
  if (!improvements.length) improvements.push('Maintain on-time payments and keep utilization comfortably below 30%.');
  return { score: clamp(Math.round(score), 0, 100), status, band, rateBand: LOAN_CONFIG.rateBand[band], rate, proposedEmi, foir, maxEligible, maturityAge, reasons, improvements, inputs: { ...input } };
}

export function calculateCredit(input) {
  const payment = clamp(Number(input.paymentHistory) || 0, 0, 100);
  const utilization = clamp(Number(input.utilization) || 0, 0, 100);
  const age = clamp(Number(input.creditAge) || 0, 0, 40);
  const accounts = Math.max(0, Number(input.activeAccounts) || 0);
  const inquiries = Math.max(0, Number(input.inquiries) || 0);
  const mix = input.creditMix || 'Limited';
  const mixScore = { Excellent: 100, Good: 82, Fair: 62, Limited: 42 }[mix] ?? 42;
  const factors = [
    { label: 'Payment history', score: payment, weight: 35 },
    { label: 'Utilization', score: 100 - utilization, weight: 30 },
    { label: 'Credit age', score: clamp(age / 10 * 100, 0, 100), weight: 15 },
    { label: 'Credit mix', score: mixScore, weight: 10 },
    { label: 'Recent inquiries', score: clamp(100 - inquiries * 15, 0, 100), weight: 10 }
  ];
  const weighted = factors.reduce((sum, item) => sum + item.score * item.weight, 0) / 100;
  const defaults = input.defaults === 'Yes';
  const estimatedScore = clamp(Math.round(300 + weighted * 6 - (defaults ? 100 : 0)), 300, 900);
  const band = estimatedScore >= 800 ? 'Excellent' : estimatedScore >= 750 ? 'Very Good' : estimatedScore >= 700 ? 'Good' : estimatedScore >= 650 ? 'Fair' : 'Poor';
  const risk = defaults || estimatedScore < 650 ? 'High' : estimatedScore < 730 ? 'Medium' : 'Low';
  const insights = [];
  if (payment < 95) insights.push('Payment history is the biggest lever: set reminders or auto-pay for every due date.');
  if (utilization > 30) insights.push('Utilization above 30% can drag the estimate; pay balances before statement dates.');
  if (age < 3) insights.push('A newer credit history has less evidence of long-term repayment behavior.');
  if (inquiries > 2) insights.push('Pause unnecessary applications for a few months to reduce hard-inquiry pressure.');
  if (defaults) insights.push('Defaults/write-offs are a major risk flag; prioritize a documented resolution plan.');
  if (!insights.length) insights.push('Your inputs show a balanced profile; keep the same habits and monitor changes.');
  return { estimatedScore, band, risk, factors, insights, defaults, inputs: { ...input } };
}
