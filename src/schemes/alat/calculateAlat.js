// ALAT — Training Facilities & Renovation Scheme.
// Source: ACM Guide Jan 2026, section D.
const num = (v) => parseFloat(v) || 0;

export function calculateAlat({ levyBalance = '', equipment = [], renovation = [] }) {
  const sumEquip = equipment.reduce((s, e) => s + num(e.cost), 0);
  const sumReno  = renovation.reduce((s, r) => s + num(r.cost), 0);
  const totalRequested = sumEquip + sumReno;

  const levy = num(levyBalance);
  const hasLevy = levy > 0;
  const cap = 0.5 * levy;                 // 50% of levy balance can be used for ALAT
  const exceeds = hasLevy && totalRequested > cap;
  const claimable = exceeds ? cap : totalRequested;

  const items = [];
  if (sumEquip > 0) items.push({ label: 'Training Equipment', note: `${equipment.length} item(s)`, amount: sumEquip });
  if (sumReno > 0)  items.push({ label: 'Room Setup / Renovation', note: `${renovation.length} item(s)`, amount: sumReno });
  if (exceeds) {
    items.push({
      label: 'Limited to 50% of levy balance (ball-park)',
      note: `50% of RM ${levy.toLocaleString()}`,
      amount: cap - totalRequested,
    });
  }

  const warnings = [];
  if (totalRequested === 0) {
    warnings.push('Add at least one equipment or renovation item to calculate.');
  } else if (exceeds) {
    warnings.push(`Based on your ball-park levy balance of RM ${levy.toLocaleString()}, you can apply for up to RM ${cap.toLocaleString()} for ALAT this year (50% of levy). Your total cost of RM ${totalRequested.toLocaleString()} exceeds this by RM ${(totalRequested - cap).toLocaleString()}, which you would need to self-fund.`);
  } else if (hasLevy) {
    warnings.push(`Your total cost of RM ${totalRequested.toLocaleString()} is within your estimated ALAT allowance of RM ${cap.toLocaleString()} (50% of your ball-park levy balance of RM ${levy.toLocaleString()}).`);
  }
  // Levy figure is a ball-park estimate — make clear the real cap is HRD Corp's.
  warnings.push('IMPORTANT — ALAT eligibility is capped at 50% of your levy balance as of 1 January of the application year. The levy figure entered here is a ball-park estimate only; your actual approved amount depends on your real levy balance recorded at HRD Corp.');
  warnings.push('Purchases must be made AFTER grant approval and WITHIN 6 months. Purchases before approval are not claimable.');
  warnings.push('Not claimable as standalone items: labour, installation/calibration/cleaning services, delivery charges, accessories without equipment, operational software (e.g. MS Office), signage, cabinets.');
  warnings.push('Desktop computers, laptops and tablets are NOT claimable under ALAT — apply for computers under the IT (Information Technology & Computer-Aided Training) scheme instead.');

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
