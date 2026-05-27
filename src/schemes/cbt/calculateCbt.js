// CBT — Computer-Based Training Scheme.
// Source: ACM Guide Jan 2026, section F.
const num = (v) => parseFloat(v) || 0;
const sum = (rows) => rows.reduce((s, r) => s + num(r.cost), 0);

export function calculateCbt({ softwarePurchase = [], softwareDevelopment = [], lmsSubscription = [], elearningSubscription = [] }) {
  const cats = [
    { label: 'Software Purchase', rows: softwarePurchase },
    { label: 'Software / LMS Development', rows: softwareDevelopment },
    { label: 'LMS Subscription', rows: lmsSubscription },
    { label: 'E-Learning Content Subscription', rows: elearningSubscription },
  ];

  const items = [];
  let totalRequested = 0;
  for (const c of cats) {
    const s = sum(c.rows);
    if (s > 0) { items.push({ label: c.label, note: `${c.rows.length} item(s) — as charged`, amount: s }); totalRequested += s; }
  }

  const warnings = [];
  if (totalRequested === 0) warnings.push('Add at least one cost item to calculate.');
  warnings.push('CBT has no fixed scheme ceiling — costs are claimable as charged / per quotation, subject to your available levy balance.');
  warnings.push('Software DEVELOPMENT / LMS development requires a proposal and grant application at least 1 month prior to commencement (LMS / e-learning subscription excepted).');
  warnings.push('Software PURCHASE needs no grant application, but the HRD Corp Claims Unit must view the software in its original form before claim.');
  warnings.push('Eligible purchased software must be interactive training media (CD/DVD/video) for training only. Display/reading-only software, e-books, and operational software (MS Office, accounting, AutoCAD, programming tools) are NOT eligible.');
  warnings.push('Grant approval is based on the quotation; reimbursement is based on the actual receipt cost.');

  return {
    items,
    totalRequested,
    totalClaimable: totalRequested,
    warnings,
    supportingDocs: {
      grantSubmission: [
        { text: 'Quotation for software development.' },
        { text: 'Proposal for software development (purpose, justification, content/skills, methodology, schedule, payment schedule).' },
        { text: 'Quotation or invoice for e-learning or LMS subscription.' },
        { text: 'Course content summary.' },
      ],
      claimSubmission: [
        { text: 'Official receipts and invoices for the purchase and development of software.' },
        { text: 'Official receipts and invoices for e-learning or LMS subscriptions.' },
        { text: 'Any additional documents as specified by HRD Corp.' },
      ],
    },
  };
}
