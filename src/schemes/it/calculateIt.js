// IT — Information Technology & Computer-Aided Training.
// Source: ACM Guide Jan 2026, section E.
const num = (v) => parseFloat(v) || 0;
const MAX = 25000;

export function calculateIt({ computers = [], webcam = 0, internetSubscription = 0, lastApplicationDate = '' }) {
  const sumComputers = computers.reduce((s, c) => s + (num(c.qty) * num(c.unitCost)), 0);
  const totalRequested = sumComputers + num(webcam) + num(internetSubscription);
  const claimable = Math.min(totalRequested, MAX);

  const items = [];
  if (sumComputers > 0) items.push({ label: 'Computers / Laptops', note: `${computers.length} line(s)`, amount: sumComputers });
  if (num(webcam) > 0) items.push({ label: 'Webcam', note: 'Supports online learning', amount: num(webcam) });
  if (num(internetSubscription) > 0) items.push({ label: 'Internet Subscription (first year only)', note: 'Claimable first year only', amount: num(internetSubscription) });

  const warnings = [];
  if (totalRequested === 0) warnings.push('Add at least one computer line to calculate.');
  if (totalRequested > MAX) {
    items.push({ label: 'Capped at RM25,000 maximum', note: 'Scheme ceiling', amount: claimable - totalRequested });
    warnings.push(`Total requested RM ${totalRequested.toLocaleString()} exceeds the RM25,000 scheme maximum. You must self-fund the RM ${(totalRequested - MAX).toLocaleString()} shortfall.`);
  }

  if (lastApplicationDate) {
    const last = new Date(lastApplicationDate);
    const threeYearsLater = new Date(last); threeYearsLater.setFullYear(last.getFullYear() + 3);
    if (!isNaN(last) && new Date() < threeYearsLater) {
      warnings.push(`Your last IT-scheme application was on ${lastApplicationDate}. Applications are allowed only once every 3 years — you are not yet eligible (next eligible from ${threeYearsLater.toISOString().slice(0, 10)}).`);
    }
  }

  warnings.push('Maximum financial assistance is RM25,000 for computer purchase.');
  warnings.push('One application every 3 years from the previous application date — even if RM25,000 was not fully used.');
  warnings.push('Purchase must be AFTER grant approval and WITHIN 6 months. Reimbursement is based on the actual receipt cost.');
  warnings.push('A fixed computer training room is required (SMEs are exempt from needing a proper lab).');

  return {
    items,
    totalRequested,
    totalClaimable: claimable,
    warnings,
    supportingDocs: {
      grantSubmission: [
        { text: 'Vendor quotation for the purchase of computers.' },
        { text: 'List of computer training programmes conducted the previous year (duration in hours + trainees per session), or a justification if none.' },
        { text: 'List of proposed computer training programmes for the coming year.' },
        { text: 'Classroom sketch including planned computer layout.' },
      ],
      claimSubmission: [
        { text: 'Official receipts and invoices with an itemized breakdown of purchases.' },
        { text: 'Any additional documents as specified by HRD Corp.' },
      ],
    },
  };
}
