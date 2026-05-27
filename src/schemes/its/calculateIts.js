// ITS — Industrial Training Scheme.
// Source: ACM Guide Jan 2026, section G.
const num = (v) => parseFloat(v) || 0;
const doc = (text) => ({ text });

export function calculateIts({ levyBalance = '', numberOfInterns = '', monthlyAllowance = '', months = '', ppePerIntern = '', insuranceTotal = '' }) {
  const interns = Math.max(0, parseInt(numberOfInterns, 10) || 0);
  const mAllow = num(monthlyAllowance);
  const mo = num(months);
  const ppe = num(ppePerIntern);
  const ins = num(insuranceTotal);

  const allowanceTotal = mAllow * mo * interns;
  const ppeTotal = ppe * interns;
  const totalRequested = allowanceTotal + ppeTotal + ins;

  const levy = num(levyBalance);
  const hasLevy = levy > 0;
  const cap = 0.5 * levy;
  const exceeds = hasLevy && totalRequested > cap;
  const claimable = exceeds ? cap : totalRequested;

  const items = [];
  if (allowanceTotal > 0) items.push({ label: 'Monthly Allowance', note: `RM ${mAllow.toLocaleString()}/mth × ${mo} mth × ${interns} intern(s)`, amount: allowanceTotal });
  if (ppeTotal > 0) items.push({ label: 'PPE (one set per intern)', note: `RM ${ppe.toLocaleString()} × ${interns} intern(s)`, amount: ppeTotal });
  if (ins > 0) items.push({ label: 'Insurance', note: 'As per premium', amount: ins });
  if (exceeds) items.push({ label: 'Limited to 50% of levy balance (ball-park)', note: `50% of RM ${levy.toLocaleString()}`, amount: cap - totalRequested });

  const warnings = [];
  if (totalRequested === 0) {
    warnings.push('Enter the intern details (allowance, months) to calculate.');
  } else if (exceeds) {
    warnings.push(`Based on your ball-park levy balance of RM ${levy.toLocaleString()}, you can apply for up to RM ${cap.toLocaleString()} for ITS this year (50% of levy). Your total of RM ${totalRequested.toLocaleString()} exceeds this by RM ${(totalRequested - cap).toLocaleString()}, which you would need to self-fund.`);
  } else if (hasLevy) {
    warnings.push(`Your total of RM ${totalRequested.toLocaleString()} is within your estimated ITS allowance of RM ${cap.toLocaleString()} (50% of your ball-park levy balance of RM ${levy.toLocaleString()}).`);
  }
  if (mo > 0 && (mo < 2 || mo > 12)) {
    warnings.push('ITS training duration must be between 2 and 12 months.');
  }
  warnings.push('IMPORTANT — ITS eligibility is capped at 50% of your levy balance as of 1 January of the application year. The levy figure entered here is a ball-park estimate only; your actual approved amount depends on your real levy balance recorded at HRD Corp.');
  warnings.push('Monthly allowance is claimable as paid by the employer (subject to the 50% levy cap).');
  warnings.push('PPE: one set per trainee. You may quote for more than one unit, but approval is based on the actual quantity only.');
  warnings.push('Insurance coverage is claimable according to the premium amount, if any.');
  warnings.push('Minimum duration is 2 months; maximum is 12 months. Employers must have no legal issues with HRD Corp to apply.');

  return {
    items,
    totalRequested,
    totalClaimable: claimable,
    warnings,
    supportingDocs: {
      grantSubmission: [
        doc('A letter issued by a public or private university, higher learning institution or college.'),
        doc('A copy of the acceptance letter from the employer agreeing to the industrial placement, with details of the monthly allowance to be paid.'),
        doc('A copy of the course structure — objectives, training duration, learning outcomes and course schedule in weekly format for the entire duration.'),
      ],
      claimSubmission: [
        doc('Proof of payment for the monthly allowance (payment slips, bank statements or transactions).'),
        doc('Proof of payment or receipt for insurance.'),
        doc('Proof of payment or receipt for PPE.'),
      ],
    },
  };
}
