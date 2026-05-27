// ALAT — Training Facilities & Renovation Scheme.
// Source: ACM Guide Jan 2026, section D.
const num = (v) => parseFloat(v) || 0;

export function calculateAlat({ levyBalance, equipment = [], renovation = [] }) {
  const sumEquip = equipment.reduce((s, e) => s + num(e.cost), 0);
  const sumReno  = renovation.reduce((s, r) => s + num(r.cost), 0);
  const totalRequested = sumEquip + sumReno;
  const cap = 0.5 * num(levyBalance);
  const claimable = Math.min(totalRequested, cap);

  const items = [];
  if (sumEquip > 0) items.push({ label: 'Training Equipment', note: `${equipment.length} item(s)`, amount: sumEquip });
  if (sumReno > 0)  items.push({ label: 'Room Setup / Renovation', note: `${renovation.length} item(s)`, amount: sumReno });

  const warnings = [];
  if (totalRequested === 0) {
    warnings.push('Add at least one equipment or renovation item to calculate.');
  }
  if (totalRequested > cap) {
    items.push({
      label: 'Capped at 50% of levy balance',
      note: `Cap = RM ${cap.toLocaleString()} (50% of RM ${num(levyBalance).toLocaleString()})`,
      amount: claimable - totalRequested,
    });
    warnings.push(`Total requested RM ${totalRequested.toLocaleString()} exceeds the 50% levy-balance cap (RM ${cap.toLocaleString()}). You must self-fund the RM ${(totalRequested - cap).toLocaleString()} shortfall.`);
  }
  warnings.push('Eligibility is capped at 50% of your levy balance as of 1 January of the application year.');
  warnings.push('Purchases must be made AFTER grant approval and WITHIN 6 months. Purchases before approval are not claimable.');
  warnings.push('Not claimable as standalone items: labour, installation/calibration/cleaning services, delivery charges, accessories without equipment, operational software (e.g. MS Office), signage, cabinets.');
  warnings.push('Laptops/tablets are claimable only every 2 years, and require an appointed internal trainer and a dedicated training room with an LCD projector.');

  return {
    items,
    totalRequested,
    totalClaimable: claimable,
    warnings,
    supportingDocs: {
      grantSubmission: [
        { text: 'Quotation or pro forma invoice from the supplier for the training aid purchase.' },
        { text: 'Shared letter for Industry Training Location/Venue (Appendix 1, Employer Circular No. 3/2024), if applicable.' },
        { text: 'Specific training room name and location.' },
        { text: 'Training room layout.' },
        { text: 'Number of training rooms, internal trainer profiles and LCD projector detail (for laptop purchase applications).' },
      ],
      claimSubmission: [
        { text: 'Official receipts and invoices with an itemized breakdown of purchases.' },
        { text: 'Any additional documents as specified by HRD Corp.' },
      ],
    },
  };
}
