// Registry of purchase-based schemes added this round. Event schemes
// (HCC/SBL/SLB) remain in HRDCorpCostCalculator and are not listed here.
export const SCHEMES = [
  { id: 'alat', code: 'ALAT', label: 'ALAT — Training Facilities & Renovation', group: 'Facilities & Equipment Schemes', description: 'Purchase training equipment + set up / renovate a training room. Capped at 50% of levy balance.' },
  { id: 'it',   code: 'IT',   label: 'IT — Info Tech & Computer-Aided Training', group: 'Facilities & Equipment Schemes', description: 'Purchase desktops / laptops for a computer training room. Max RM25,000, once every 3 years.' },
];

export const PURCHASE_SCHEME_IDS = SCHEMES.map(s => s.id);

export function getScheme(id) {
  return SCHEMES.find(s => s.id === id);
}
