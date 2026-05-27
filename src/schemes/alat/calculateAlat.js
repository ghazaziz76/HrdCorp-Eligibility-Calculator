// ALAT — Training Facilities & Renovation Scheme.
// Source: ACM Guide Jan 2026, section D.
const num = (v) => parseFloat(v) || 0;
const doc = (text) => ({ text });

export function calculateAlat({ levyBalance = '', equipment = [], renovation = [] }) {
  const sumEquip = equipment.reduce((s, e) => s + num(e.cost), 0);
  const sumReno  = renovation.reduce((s, r) => s + num(r.cost), 0);
  const totalRequested = sumEquip + sumReno;
  const hasEquip = sumEquip > 0;
  const hasReno  = sumReno > 0;

  const levy = num(levyBalance);
  const hasLevy = levy > 0;
  const cap = 0.5 * levy;                 // 50% of levy balance can be used for ALAT
  const exceeds = hasLevy && totalRequested > cap;
  const claimable = exceeds ? cap : totalRequested;

  const items = [];
  if (hasEquip) items.push({ label: 'Training Equipment', note: `${equipment.length} item(s)`, amount: sumEquip });
  if (hasReno)  items.push({ label: 'Room Setup / Renovation', note: `${renovation.length} item(s)`, amount: sumReno });
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
  warnings.push('IMPORTANT — ALAT eligibility is capped at 50% of your levy balance as of 1 January of the application year. The levy figure entered here is a ball-park estimate only; your actual approved amount depends on your real levy balance recorded at HRD Corp.');
  warnings.push('Purchases must be made AFTER grant approval and WITHIN 6 months. Purchases before approval are not claimable.');
  warnings.push('Not claimable as standalone items: labour, installation/calibration/cleaning services, delivery charges, accessories without equipment, operational software (e.g. MS Office), signage, cabinets.');
  warnings.push('Desktop computers are NOT claimable under ALAT — apply for desktops under the IT scheme. Laptops and tablets may be purchased under ALAT only once every 2 years (internal trainer appointed + dedicated training room with LCD projector required).');

  // Supporting documents depend on what is being applied for.
  const grantSubmission = [];
  const claimSubmission = [];
  if (hasEquip) {
    grantSubmission.push(
      doc('Quotation or pro forma invoice from the supplier for training aid purchase.'),
      doc('Shared letter for purchase of equipment and/or renovation of training room for Industry Training Location or Venue. Refer to Appendix 1, Employer Circular No. 3/2024 for letter samples.'),
      doc('Specific training room name and location.'),
      doc('Training room layout.'),
    );
    claimSubmission.push(
      doc('Official receipts and invoices, including a detailed breakdown of purchases (e.g., equipment details).'),
      doc('Any additional documents as specified by HRD Corp.'),
      doc('Indicate the number of training rooms, internal trainer profiles and LCD projector (for the laptop purchase application).'),
    );
  }
  if (hasReno) {
    grantSubmission.push(
      doc('Quotation from supplier or contractor.'),
      doc('Shared letter for purchase of equipment and/or renovation of training room for Industry Training Location or Venue. Refer to Appendix 1, Employer Circular No. 3/2025 for letter samples.'),
    );
    claimSubmission.push(
      doc('Official receipts and invoices, including a detailed breakdown of purchases (e.g., renovation details).'),
      doc('Any additional documents as specified by HRD Corp.'),
      doc('Layout plan and measurement of the proposed training room setup or renovation.'),
    );
  }
  // Fallback when nothing entered yet, so the panel is never empty.
  if (grantSubmission.length === 0) {
    grantSubmission.push(doc('Quotation or pro forma invoice from the supplier for the purchase / renovation.'));
  }

  return {
    items,
    totalRequested,
    totalClaimable: claimable,
    warnings,
    supportingDocs: { grantSubmission, claimSubmission },
  };
}
