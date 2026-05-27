// SGM — Skim Graduan Madani.
// Source: ACM Guide Jan 2026, section L.
const num = (v) => parseFloat(v) || 0;
const doc = (text) => ({ text });

const PROGRAMME_MONTHS = 12; // SGM programme duration is fixed at 12 months.

export function calculateSgm({ levyBalance = '', numberOfGraduates = '', monthlySalary = '' }) {
  const grads = Math.max(0, parseInt(numberOfGraduates, 10) || 0);
  const salary = num(monthlySalary);
  const totalRequested = salary * PROGRAMME_MONTHS * grads;

  const levy = num(levyBalance);
  const hasLevy = levy > 0;
  const cap = 0.5 * levy;
  const exceeds = hasLevy && totalRequested > cap;
  const claimable = exceeds ? cap : totalRequested;

  const items = [];
  if (totalRequested > 0) {
    items.push({
      label: 'Graduate Skills Development Allowance',
      note: `RM ${salary.toLocaleString()}/mth × 12 mth × ${grads} graduate(s)`,
      amount: totalRequested,
    });
  }
  if (exceeds) items.push({ label: 'Limited to 50% of levy balance (ball-park)', note: `50% of RM ${levy.toLocaleString()}`, amount: cap - totalRequested });

  const warnings = [];
  if (totalRequested === 0) {
    warnings.push('Enter the graduate salary and headcount to calculate.');
  } else if (exceeds) {
    warnings.push(`Based on your ball-park levy balance of RM ${levy.toLocaleString()}, you can apply for up to RM ${cap.toLocaleString()} for SGM this year (50% of levy). Your total of RM ${totalRequested.toLocaleString()} exceeds this by RM ${(totalRequested - cap).toLocaleString()}, which you would need to self-fund.`);
  } else if (hasLevy) {
    warnings.push(`Your total of RM ${totalRequested.toLocaleString()} is within your estimated SGM allowance of RM ${cap.toLocaleString()} (50% of your ball-park levy balance of RM ${levy.toLocaleString()}).`);
  }
  warnings.push('IMPORTANT — SGM eligibility is capped at 50% of your levy balance as of 1 January of the application year. The levy figure entered here is a ball-park estimate only; your actual approved amount depends on your real levy balance recorded at HRD Corp.');
  warnings.push('The programme duration is fixed at 12 months. The claimable cost is the graduate’s 12 months of basic salary as paid by the employer — no other allowances are claimable.');
  warnings.push('Eligible graduates: completed all higher academic requirements (incl. SKM Level 4 and above); seeking a full-time job (permanent or fixed-term ≥ 12 months); no prior full-time work experience in the formal sector.');
  warnings.push('The grant application must be submitted within 6 months of the programme completion date. Employers must have no legal issues with HRD Corp.');

  return {
    items,
    totalRequested,
    totalClaimable: claimable,
    warnings,
    supportingDocs: {
      grantSubmission: [
        doc('A letter or certificate of higher education completion or graduation from a recognised institution.'),
        doc('Employment or Offer Letter from the current company stating the monthly allowance.'),
        doc('Joint declaration by employer and graduate confirming it is the graduate’s first full-time job in the formal sector (Appendix A, Employer Circular No. 1/2025).'),
        doc('12-month programme structure with objectives, start/end dates and learning outcomes (SGM Form Ver 1.1).'),
        doc('Proof of 12 months’ allowance payment (e.g. bank statements, pay slips). Payment vouchers will not be considered.'),
      ],
      claimSubmission: [
        doc('No claim submission is required under the SGM scheme.'),
      ],
    },
  };
}
