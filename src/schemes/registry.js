// Registry of purchase-based schemes added this round. Event schemes
// (HCC/SBL/SLB) remain in HRDCorpCostCalculator and are not listed here.
export const SCHEMES = [
  { id: 'alat', code: 'ALAT', label: 'ALAT — Training Facilities & Renovation', group: 'Facilities & Equipment Schemes', description: 'Purchase training equipment + set up / renovate a training room. Capped at 50% of levy balance.' },
  { id: 'it',   code: 'IT',   label: 'IT — Info Tech & Computer-Aided Training', group: 'Facilities & Equipment Schemes', description: 'Purchase desktops / laptops for a computer training room. Max RM25,000, once every 3 years.' },
  { id: 'its',  code: 'ITS',  label: 'ITS — Industrial Training Scheme', group: 'Allowance Schemes', description: 'University/college interns: monthly allowance + PPE + insurance. 2–12 months, capped at 50% of levy.' },
  { id: 'sgm',  code: 'SGM',  label: 'SGM — Skim Graduan Madani', group: 'Allowance Schemes', description: 'Graduate 12-month structured training: 12 months of basic salary, capped at 50% of levy.' },
  { id: 'fwt',  code: 'FWT',  label: 'FWT — Future Workers Training', group: 'Training Schemes', description: 'Pre-employment training (in-house / public certification / general public) aiming to employ trainees on completion.' },
  { id: 'ojt',  code: 'OJT',  label: 'OJT — On-the-Job Training', group: 'Training Schemes', description: 'A skilled worker trains an unskilled / new worker on the job. RM50/trainee/hour, max 300 hours.' },
];

export const PURCHASE_SCHEME_IDS = SCHEMES.map(s => s.id);

export function getScheme(id) {
  return SCHEMES.find(s => s.id === id);
}
