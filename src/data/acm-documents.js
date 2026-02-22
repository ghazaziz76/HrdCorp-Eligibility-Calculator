/**
 * HRD Corp ACM — Grant Submission & Claim Document Requirements
 * Source: Allowable Cost Matrix Guide (September 2025)
 *
 * GRANT_DOCS: documents required when submitting a grant application, per scheme.
 * CLAIM_DOCS: supporting documents required per cost item type at claim stage.
 */

export const GRANT_DOCS = {
  hcc: [
    'Course content with training schedule (date and time)',
    'Accredited trainer profile',
    'Invoice or quotation for course fees',
    'Invoice or quotation for chartered transportation (if any)',
    'HRD Corp Special Approval Letter for LTM (if any)',
    'Acknowledgement Letter for Focus Area / Industry Specific (case-by-case)',
  ],

  sbl: [
    'Course content with training schedule (date and time)',
    'Trainer profile',
    'Invoice or quotation for course fees',
    'Service/sales agreement or purchase receipt (if vendor conducts training)',
    'Invoice or quotation for chartered transportation (if any)',
    'HRD Corp Special Approval Letter (if any)',
    'Acknowledgement Letter for Focus Area / Industry Specific (case-by-case)',
  ],

  slb: [
    'Course content with training schedule (date and time)',
    'Trainer profile',
    'Invoice or quotation for course fees (ONE per training course)',
    'Joint Training Letter from organising employer (must include: i. Organiser and participants from each employer — include each participating employer\'s name and HRD Corp Employer Code (if registered); ii. Name of organiser; iii. Course title and training date; iv. Training venue; v. Number of pax from each employer; vi. Cost breakdown; vii. Signature by the organising employer)',
    'Invoice or quotation for chartered transportation (if any)',
    'HRD Corp Special Approval Letter (if any)',
  ],
};

export const CLAIM_DOCS = {
  course_fee_hcc:   'Invoice issued to HRD Corp',
  course_fee_other: 'Official receipt and proof of payment',
  air_ticket:       'Ticket stub / e-Ticket / receipt and invoice from travel agent',
  transport:        'Receipt from transport provider',
  none:             'No supporting document needed',
};
