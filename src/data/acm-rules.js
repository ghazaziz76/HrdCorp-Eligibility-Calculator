/**
 * HRD Corp ACM — Eligibility Rules Matrix
 * Source: ACM Table (November 2025 Edition) + ACM Guide (September 2025)
 *
 * Plain data — NO React / DOM imports. The Android app copies this module and
 * renders the reference natively, so keep it framework-free.
 *
 * The engine (src/utils/HRDEligibilityCalculator.js) is the source of truth;
 * everything here must agree with it.
 *
 * Exports:
 *   SCHEME_CONFIG   — per-scheme settings (payment flow, trainer requirements, allowed types)
 *   TRAINING_RULES  — per-training-type validation thresholds
 *   COST_MATRIX     — one row per scenario (trainer type × venue)
 *   ACM_EDITIONS_DEFAULT / editionsLine()  — ACM Guide / ACM Table editions
 *   buildAcmReference(rates)  — the ACM Reference tab content (sections of tables)
 */

import { RATES as RATES_STATIC } from './acm-rates.js';

// ---------------------------------------------------------------------------
// 1. Scheme Configuration
// ---------------------------------------------------------------------------

export const SCHEME_CONFIG = {
  hcc: {
    label: 'HRD Corp Claimable Courses (HCC)',
    payment_flow: 'direct_to_tp',         // HRD Corp pays Training Provider directly
    trainer_requirement: 'accredited',    // trainer must be HRD Corp-accredited
    allowed_training_types: [
      'inhouse', 'rot_inhouse', 'rot_public', 'public',
      'seminar_conference', 'elearning', 'overseas', 'development',
      'coaching_mentoring', 'mobile_elearning',
    ],
  },

  sbl: {
    label: 'Skim Bantuan Latihan (SBL)',
    payment_flow: 'reimbursement',        // employer pays first, then claims reimbursement
    trainer_requirement: 'non_registered_allowed',
    allowed_non_registered_providers: [
      'internal', 'vendor', 'association', 'ngo', 'overseas', 'govt_body',
    ],
    allowed_training_types: [
      'inhouse', 'rot_inhouse', 'rot_public', 'public',
      'seminar_conference', 'elearning', 'overseas', 'development',
      'coaching_mentoring', 'mobile_elearning',
    ],
  },

  slb: {
    label: 'Skim Latihan Bersama (SLB)',
    payment_flow: 'reimbursement',
    allowed_training_types: ['inhouse', 'rot_inhouse', 'coaching_mentoring'],
    note: 'In-house only. Minimum 2 participating employers. Cost prorated by pax count across all employers.',
  },
};

// ---------------------------------------------------------------------------
// 2. Training Type Validation Rules
// ---------------------------------------------------------------------------

export const TRAINING_RULES = {
  inhouse: {
    min_hours: 4,
    min_pax_f2f: 2,
    min_pax_rot: 1,
    max_pax_soft: 50,    // soft skills — Employer's Circular No. 3/2024
    max_pax_tech: 25,    // technical — Employer's Circular No. 3/2024
  },

  rot_inhouse: {
    ref: 'inhouse',      // same rules as inhouse
  },

  rot_public: {
    ref: 'public',
  },

  public: {
    min_hours: 4,
    max_pax_per_employer: 9,  // financial assistance capped at 9 pax; excess pax self-funded
  },

  seminar_conference: {
    min_hours: 4,
    min_pax_inhouse: 51,          // minimum total pax for in-house seminar/conference event
    min_pax_public_per_tp: 51,    // minimum total pax from one TP for public seminar
    min_speakers_half_day: 1,
    min_speakers_full_day: 2,
  },

  elearning: {
    min_hours: 1,
    min_modules: 1,
    min_pax: 1,
  },

  mobile_elearning: {
    ref: 'elearning',   // same rules as elearning
  },

  overseas: {
    min_hours: 4,
    max_pax_per_employer: 9,
    assistance_rate: 0.50,
    extra_days_max: 2,
  },

  development: {
    min_months: 3,
    allowed_schemes: ['hcc', 'sbl'],
    hcc_requirement: 'Must be accredited programme at an accredited institution',
    sbl_requirement: 'Must be locally or overseas accredited programme',
  },

  coaching_mentoring: {
    ref: 'inhouse',     // same cost and eligibility rules as inhouse
  },
};

// ---------------------------------------------------------------------------
// 3. Cost Matrix
// Each row = one scenario from the ACM Table PDF (trainer type × venue).
// The engine looks up the matching row and applies the flags below.
//
// Flags:
//   course_fee              — eligible; apply RATES.inhouse / public_training / elearning etc.
//   trainer_allowance       — internal trainer daily allowance eligible
//   meal_trainees           — meal for trainees eligible
//   meal_includes_trainer   — add +1 to meal pax count (internal trainer at employer premises)
//   travel_trainees         — travel allowance for trainees eligible
//   travel_trainer          — travel allowance for trainer eligible
//   air_trainees            — air ticket for trainees eligible
//   air_trainer             — air ticket for trainer eligible
//   chartered_transport     — chartered transport eligible
//   consumable              — consumable/printed materials eligible
//   consumable_slb_organiser_only — under SLB, only the organising employer may claim
//   overseas_trainer_daily  — daily allowance for overseas trainer eligible
//   overseas_assistance     — apply 50% assistance rate to cost items
//   slb_cost_mode           — how to split costs under SLB
//   public_pax_cap          — cap number of pax eligible for financial assistance
//
// Venue values: 'own_premise' | 'external_hotel' | null
// ROT: the venue decides the allowance — own premise / own location = meal only,
// external venue / hotel = daily (travel) allowance only. No air ticket for ROT.
// Trainer values: 'internal' | 'external' | 'overseas' | null
// ---------------------------------------------------------------------------

export const COST_MATRIX = [
  // ─── IN-HOUSE: own premise, internal trainer ───────────────────────────
  {
    id: 'inhouse_own_internal',
    training_types: ['inhouse', 'coaching_mentoring'],
    venue: 'own_premise',
    trainer: 'internal',
    schemes: ['hcc', 'sbl', 'slb'],
    course_fee: true,
    trainer_allowance: true,
    meal_trainees: true,
    meal_includes_trainer: true,   // BUG #3 fix: internal trainer at employer premise gets meal
    travel_trainees: true,         // for trainees from branches only
    travel_trainer: true,          // if internal trainer travels from a branch
    air_trainees: true,            // for trainees from branches only
    air_trainer: true,             // if internal trainer travels from a branch
    chartered_transport: false,
    consumable: true,
    consumable_slb_organiser_only: true,
    overseas_trainer_daily: false,
    overseas_assistance: false,
    slb_cost_mode: 'group_rate_divided_by_total_pax',  // BUG #1 fix
  },

  // ─── IN-HOUSE: external hotel/venue, internal trainer ─────────────────
  {
    id: 'inhouse_hotel_internal',
    training_types: ['inhouse', 'coaching_mentoring'],
    venue: 'external_hotel',
    trainer: 'internal',
    schemes: ['hcc', 'sbl', 'slb'],
    course_fee: true,
    trainer_allowance: true,
    meal_trainees: false,          // no meal at hotel/external venue (hotel rate covers it)
    meal_includes_trainer: false,
    travel_trainees: true,         // all trainees
    travel_trainer: true,          // internal trainer at an external venue gets the daily allowance
    air_trainees: true,            // all trainees
    air_trainer: true,             // if internal trainer travels from a branch
    chartered_transport: true,     // eligible at hotel/external venue
    consumable: true,
    consumable_slb_organiser_only: true,
    overseas_trainer_daily: false,
    overseas_assistance: false,
    slb_cost_mode: 'group_rate_divided_by_total_pax',
  },

  // ─── IN-HOUSE: own premise, external trainer ───────────────────────────
  {
    id: 'inhouse_own_external',
    training_types: ['inhouse', 'coaching_mentoring'],
    venue: 'own_premise',
    trainer: 'external',
    schemes: ['hcc', 'sbl', 'slb'],
    course_fee: true,
    trainer_allowance: false,
    meal_trainees: true,
    meal_includes_trainer: false,  // external trainer at employer premise: trainees only
    travel_trainees: true,         // for trainees from branches only
    travel_trainer: true,
    air_trainees: true,            // for trainees from branches only
    air_trainer: true,
    chartered_transport: false,
    consumable: true,
    consumable_slb_organiser_only: true,
    overseas_trainer_daily: false,
    overseas_assistance: false,
    slb_cost_mode: 'group_rate_divided_by_total_pax',
  },

  // ─── IN-HOUSE: external hotel/venue, external trainer ──────────────────
  {
    id: 'inhouse_hotel_external',
    training_types: ['inhouse', 'coaching_mentoring'],
    venue: 'external_hotel',
    trainer: 'external',
    schemes: ['hcc', 'sbl', 'slb'],
    course_fee: true,
    trainer_allowance: false,
    meal_trainees: false,          // no meal at hotel/external venue (hotel rate covers it)
    meal_includes_trainer: false,
    travel_trainees: true,         // all trainees
    travel_trainer: true,
    air_trainees: true,            // all trainees
    air_trainer: true,
    chartered_transport: true,
    consumable: true,
    consumable_slb_organiser_only: true,
    overseas_trainer_daily: false,
    overseas_assistance: false,
    slb_cost_mode: 'group_rate_divided_by_total_pax',
  },

  // ─── IN-HOUSE: own premise, overseas trainer ───────────────────────────
  {
    id: 'inhouse_own_overseas',
    training_types: ['inhouse', 'coaching_mentoring'],
    venue: 'own_premise',
    trainer: 'overseas',
    schemes: ['hcc', 'sbl', 'slb'], // ACM Guide p.8: overseas training providers are allowed under SLB
    course_fee: true,
    trainer_allowance: false,
    meal_trainees: true,
    meal_includes_trainer: false,  // overseas trainer at employer premise: trainees only
    travel_trainees: true,         // for trainees from branches only
    travel_trainer: false,
    air_trainees: true,            // for trainees from branches only
    air_trainer: true,
    chartered_transport: false,
    consumable: true,
    consumable_slb_organiser_only: false,
    overseas_trainer_daily: true,  // RM 500/day for overseas trainer
    overseas_assistance: false,
    slb_cost_mode: null,
  },

  // ─── IN-HOUSE: external hotel/venue, overseas trainer ──────────────────
  {
    id: 'inhouse_hotel_overseas',
    training_types: ['inhouse', 'coaching_mentoring'],
    venue: 'external_hotel',
    trainer: 'overseas',
    schemes: ['hcc', 'sbl', 'slb'],
    course_fee: true,
    trainer_allowance: false,
    meal_trainees: false,
    meal_includes_trainer: false,
    travel_trainees: true,
    travel_trainer: false,
    air_trainees: true,
    air_trainer: true,
    chartered_transport: true,
    consumable: true,
    consumable_slb_organiser_only: false,
    overseas_trainer_daily: true,
    overseas_assistance: false,
    slb_cost_mode: null,
  },

  // ─── ROT IN-HOUSE: own premise / own location ──────────────────────────
  // ROT is treated the same as face-to-face; nobody travels → meal only.
  {
    id: 'rot_inhouse_own',
    training_types: ['rot_inhouse'],
    venue: 'own_premise',
    trainer: null,   // internal or external — same rules apply
    schemes: ['hcc', 'sbl', 'slb'],
    course_fee: true,
    trainer_allowance: true,       // if internal trainer
    meal_trainees: true,           // host + branch staff, each at their own workplace
    meal_includes_trainer: false,  // trainer delivers online
    travel_trainees: false,        // nobody travels — no daily allowance
    travel_trainer: false,
    air_trainees: false,           // air ticket never claimable for ROT
    air_trainer: false,
    chartered_transport: false,
    consumable: true,
    consumable_slb_organiser_only: true,
    overseas_trainer_daily: false,
    overseas_assistance: false,
    slb_cost_mode: 'group_rate_divided_by_total_pax',
  },

  // ─── ROT IN-HOUSE: external venue / hotel ──────────────────────────────
  {
    id: 'rot_inhouse_hotel',
    training_types: ['rot_inhouse'],
    venue: 'external_hotel',
    trainer: null,
    schemes: ['hcc', 'sbl', 'slb'],
    course_fee: true,
    trainer_allowance: true,       // if internal trainer
    meal_trainees: false,          // daily allowance only — no meal
    meal_includes_trainer: false,
    travel_trainees: true,         // all trainees gathered at the venue
    travel_trainer: false,
    air_trainees: false,           // air ticket never claimable for ROT
    air_trainer: false,
    chartered_transport: true,
    consumable: true,
    consumable_slb_organiser_only: true,
    overseas_trainer_daily: false,
    overseas_assistance: false,
    slb_cost_mode: 'group_rate_divided_by_total_pax',
  },

  // ─── ROT PUBLIC: own premise / own location ────────────────────────────
  {
    id: 'rot_public_own',
    training_types: ['rot_public'],
    venue: 'own_premise',
    trainer: null,
    schemes: ['hcc', 'sbl'],
    course_fee: true,
    public_pax_cap: 9,
    trainer_allowance: false,
    meal_trainees: true,           // meal only — nobody travels
    meal_includes_trainer: false,
    travel_trainees: false,
    travel_trainer: false,
    air_trainees: false,
    air_trainer: false,
    chartered_transport: false,
    consumable: false,
    consumable_slb_organiser_only: false,
    overseas_trainer_daily: false,
    overseas_assistance: false,
    slb_cost_mode: null,
  },

  // ─── ROT PUBLIC: external venue / hotel ────────────────────────────────
  {
    id: 'rot_public_hotel',
    training_types: ['rot_public'],
    venue: 'external_hotel',
    trainer: null,
    schemes: ['hcc', 'sbl'],
    course_fee: true,
    public_pax_cap: 9,
    trainer_allowance: false,
    meal_trainees: false,          // daily allowance only — no meal
    meal_includes_trainer: false,
    travel_trainees: true,
    travel_trainer: false,
    air_trainees: false,
    air_trainer: false,
    chartered_transport: true,
    consumable: false,
    consumable_slb_organiser_only: false,
    overseas_trainer_daily: false,
    overseas_assistance: false,
    slb_cost_mode: null,
  },

  // ─── PUBLIC ─────────────────────────────────────────────────────────────
  {
    id: 'public_local',
    training_types: ['public'],
    venue: null,
    trainer: null,
    schemes: ['hcc', 'sbl'],
    course_fee: true,
    public_pax_cap: 9,             // BUG #2 fix: max 9 pax eligible; no rate switch
    trainer_allowance: false,
    meal_trainees: false,
    meal_includes_trainer: false,
    travel_trainees: true,
    travel_trainer: false,
    air_trainees: true,
    air_trainer: false,
    chartered_transport: false,
    consumable: false,
    consumable_slb_organiser_only: false,
    overseas_trainer_daily: false,
    overseas_assistance: false,
    slb_cost_mode: null,
  },

  // ─── SEMINAR / CONFERENCE ───────────────────────────────────────────────
  {
    id: 'seminar_conference',
    training_types: ['seminar_conference'],
    venue: null,
    trainer: null,
    schemes: ['hcc', 'sbl'],
    course_fee: true,
    validate_min_pax: true,        // GAP #4 fix: engine must warn if < 51 pax
    trainer_allowance: false,
    meal_trainees: false,
    meal_includes_trainer: false,
    travel_trainees: true,
    travel_trainer: false,
    air_trainees: true,
    air_trainer: false,
    chartered_transport: false,
    consumable: false,
    consumable_slb_organiser_only: false,
    overseas_trainer_daily: false,
    overseas_assistance: false,
    slb_cost_mode: null,
  },

  // ─── E-LEARNING ─────────────────────────────────────────────────────────
  {
    id: 'elearning',
    training_types: ['elearning', 'mobile_elearning'],
    venue: null,
    trainer: null,
    schemes: ['hcc', 'sbl'],
    course_fee: true,              // rate from RATES.elearning.hour_table
    trainer_allowance: false,
    meal_trainees: false,
    meal_includes_trainer: false,
    travel_trainees: false,
    travel_trainer: false,
    air_trainees: false,
    air_trainer: false,
    chartered_transport: false,
    consumable: false,
    consumable_slb_organiser_only: false,
    overseas_trainer_daily: false,
    overseas_assistance: false,
    slb_cost_mode: null,
  },

  // ─── OVERSEAS TRAINING ──────────────────────────────────────────────────
  {
    id: 'overseas_training',
    training_types: ['overseas'],
    venue: null,
    trainer: null,
    schemes: ['hcc', 'sbl'],
    course_fee: true,
    public_pax_cap: 9,
    trainer_allowance: false,
    meal_trainees: false,
    meal_includes_trainer: false,
    travel_trainees: false,
    travel_trainer: false,
    air_trainees: true,
    air_trainer: false,
    chartered_transport: false,
    consumable: false,
    consumable_slb_organiser_only: false,
    overseas_trainer_daily: false,
    overseas_assistance: true,     // 50% on course fee, daily allowance & air ticket
    daily_allowance_trainees: true,
    slb_cost_mode: null,
  },

  // ─── DEVELOPMENT (study / scholarship) ─────────────────────────────────
  {
    id: 'development',
    training_types: ['development'],
    venue: null,
    trainer: null,
    schemes: ['hcc', 'sbl'],
    course_fee: true,              // tuition / programme fee
    study_allowance: true,         // monthly study allowance (local or overseas rate)
    thesis_allowance: true,        // thesis writing allowance (Master's / PhD, full-time)
    trainer_allowance: false,
    meal_trainees: false,
    meal_includes_trainer: false,
    travel_trainees: false,
    travel_trainer: false,
    air_trainees: true,            // air ticket for overseas programmes
    air_trainer: false,
    chartered_transport: false,
    consumable: false,             // ACM Guide s.8 lists no consumables for development programmes
    consumable_slb_organiser_only: false,
    overseas_trainer_daily: false,
    overseas_assistance: false,
    slb_cost_mode: null,
  },
];

/**
 * Look up the COST_MATRIX row matching a given training type, venue, and trainer type.
 * Returns the matching row or null if no match found.
 *
 * @param {string} trainingType
 * @param {string|null} venue       - 'own_premise' | 'external_hotel' | null
 * @param {string|null} trainerType - 'internal' | 'external' | 'overseas' | null
 * @returns {object|null}
 */
export function getCostMatrixRow(trainingType, venue, trainerType) {
  for (const row of COST_MATRIX) {
    if (!row.training_types.includes(trainingType)) continue;
    if (row.venue !== null && row.venue !== venue) continue;
    if (row.trainer !== null && row.trainer !== trainerType) continue;
    return row;
  }
  return null;
}

// ---------------------------------------------------------------------------
// 4. ACM Reference (rendered by the web ACM Reference tab and the Android app)
//
// Every rule below mirrors src/utils/HRDEligibilityCalculator.js — change both
// together. Rates come from the live /api/rates data when available, otherwise
// from acm-rates.js.
// ---------------------------------------------------------------------------

export const ACM_EDITIONS_DEFAULT = {
  acm_guide_edition: 'September 2025',
  acm_table_edition: 'November 2025',
};

/** "ACM Guide — September 2025 Edition · ACM Table — November 2025 Edition" */
export function editionsLine(version) {
  const guide = (version && version.acm_guide_edition) || ACM_EDITIONS_DEFAULT.acm_guide_edition;
  const table = (version && version.acm_table_edition) || ACM_EDITIONS_DEFAULT.acm_table_edition;
  return `ACM Guide — ${guide} Edition · ACM Table — ${table} Edition`;
}

// Live rates may be partial; fill any gap from the static file, section by section.
export function mergeRates(live) {
  if (!live || typeof live !== 'object') return RATES_STATIC;
  const out = { ...RATES_STATIC, ...live };
  for (const k of Object.keys(RATES_STATIC)) {
    const base = RATES_STATIC[k];
    if (base && typeof base === 'object') out[k] = { ...base, ...(live[k] || {}) };
  }
  out.elearning = { ...out.elearning, hour_table: { ...RATES_STATIC.elearning.hour_table, ...((live.elearning || {}).hour_table || {}) } };
  return out;
}

// Locale-free thousands separator (Hermes on Android has limited toLocaleString).
const rm = (n) => 'RM' + String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
const pct = (r) => `${Math.round((Number(r) || 0) * 100)}%`;

/**
 * Build the ACM Reference content.
 * @param {object} [rates] live rates (useACMData().rates); falls back to acm-rates.js
 * @returns {Array<{ id, title, intro?, columns, rows: string[][], notes?: string[] }>}
 */
export function buildAcmReference(rates) {
  const R = mergeRates(rates);
  const A = R.allowances;
  const travel = `<100km: ${rm(A.travel_under_100)}/day/pax · ≥100km: ${rm(A.travel_over_100)}/day/pax`;
  const meal = `Full day ${rm(A.meal_full)}/day/pax · Half day ${rm(A.meal_half)}/day/pax`;
  const groupFee = `Full day ${rm(R.inhouse.full_day)}/group/day · Half day ${rm(R.inhouse.half_day)}/group/day`;
  const paxFee = `Full day ${rm(R.public_training.full_day)}/pax/day · Half day ${rm(R.public_training.half_day)}/pax/day`;
  const trainerAllow = `Full day ${rm(A.internal_trainer_full)}/group/day · Half day ${rm(A.internal_trainer_half)}/group/day`;
  const hours = Object.keys(R.elearning.hour_table).map(Number).sort((a, b) => a - b);
  const maxHr = hours[hours.length - 1];
  const hourList = hours.map(h => `${h} hr ${rm(R.elearning.hour_table[h])}`).join(' · ');
  const cap = R.public_training.max_pax_per_employer;
  const ovs = pct(R.overseas.assistance_rate);

  return [
    {
      id: 'rates',
      title: 'Current allowable rates',
      columns: ['Cost item', 'Rate'],
      rows: [
        ['Course fee — in-house (general courses)', `${groupFee}. Prorated when fewer than ${R.inhouse.prorate_threshold} pax.`],
        ['Course fee — public / ROT public / seminar (general courses)', paxFee],
        ['Course fee — Focus Area / Industry Specific / Professional Certification', 'As charged, per pax'],
        ['Internal trainer allowance', `${trainerAllow}. Prorated when fewer than ${R.inhouse.prorate_threshold} pax.`],
        ['Daily (travel) allowance', travel],
        ['Daily (travel) allowance — half day', `Half of the daily rate: <100km: ${rm(A.travel_under_100 / 2)}/day/pax · ≥100km: ${rm(A.travel_over_100 / 2)}/day/pax`],
        ['Trainer daily allowance (external trainer; internal trainer from a branch or at an external venue)', `Same as the trainee daily allowance, per trainer per day by the trainer's distance (half day: half rate)`],
        ['Meal allowance', meal],
        ['Overseas trainer daily allowance', `${rm(A.overseas_trainer)}/trainer/day (half day ${rm(A.overseas_trainer / 2)})`],
        ['Consumable training materials', `${rm(A.consumable)}/group (no receipt needed up to ${rm(A.consumable)})`],
        ['Air ticket', 'Actual airfare (person count shown in the result)'],
        ['Chartered transport', 'As per quotation (external venue / hotel only)'],
        ['E-learning course fee', `${hourList} per pax (max ${maxHr} hrs per block)`],
        ['Overseas daily allowance', `${rm(R.overseas.daily_allowance)}/pax/day × ${ovs} assistance`],
        ['Development — study allowance', `Local ${rm(R.development.study_local)}/month · Overseas ${rm(R.development.study_overseas)}/month`],
        ['Development — thesis allowance', `Master's ${rm(R.development.thesis_masters)} · PhD ${rm(R.development.thesis_phd)} per trainee`],
      ],
    },
    {
      id: 'limits',
      title: 'Limits and thresholds',
      columns: ['Rule', 'Detail'],
      rows: [
        ['Minimum pax — in-house face-to-face', `${R.inhouse.min_pax_f2f} trainees`],
        ['Minimum pax — ROT', `${R.inhouse.min_pax_rot} trainee`],
        ['Maximum pax per group — in-house general courses', `Non-technical ${R.inhouse.max_pax_soft} × number of trainers · Technical ${R.inhouse.max_pax_tech} × number of trainers (Employer's Circular No. 3/2024)`],
        ['Prorating', `Fewer than ${R.inhouse.prorate_threshold} pax: course fee and trainer allowance = (rate ÷ ${R.inhouse.prorate_threshold}) × pax`],
        ['Public / ROT public', `Max ${cap} pax per employer get financial assistance (course fee, daily allowance, air ticket); the rest are self-funded. Host + branches count as one employer; each subsidiary is its own employer. Professional certification courses: actual number of trainees`],
        ['Overseas training', `Max ${cap} pax get financial assistance; the rest are self-funded`],
        ['Seminar & conference', `Min ${R.seminar.min_pax_inhouse} attendees (in-house) or ${R.seminar.min_pax_public_per_tp} per Training Provider (public). Speakers: min 1 (half day), 2 (full day)`],
        ['Extra travel day', 'Not automatic — only when the employer applies for it: staff ≥100km who travel one day before or after get +1 day of daily allowance (full-day training only)'],
        ['Half day (at least 4 hours)', 'Half of the fixed allowances: daily (travel), trainer and overseas trainer allowances at half rate; meal at the half-day rate'],
        ['Overseas extra days', `Up to ${R.overseas.extra_days_max} extra travel days of daily allowance`],
        ['Attendance', 'At least 75% of training hours; allowances prorated by attendance'],
        ['Audit risk', `In-house groups above ${R.audit_risk_pax} pax may be asked for justification`],
        ['Actual course fee', 'Claimed up to the ACM ceiling (general courses, e-learning hour table); anything above is a deficit the employer funds. Focus Area / Industry Specific / Certification: the actual fee as charged'],
      ],
    },
    {
      id: 'schemes',
      title: 'Training course schemes (HCC / SBL / SLB)',
      columns: ['Scheme', 'Payment', 'Trainer', 'Training types'],
      rows: [
        ['HCC — HRD Corp Claimable Courses', 'HRD Corp pays the Training Provider directly', 'HRD Corp-accredited', 'All training types'],
        ['SBL — Skim Bantuan Latihan', 'Employer pays first, then claims reimbursement', 'Non-registered allowed (internal, vendor, association, NGO, overseas, govt body)', 'All training types'],
        ['SLB — Skim Latihan Bersama', 'Employer pays first, then claims reimbursement', 'Non-registered allowed (internal, vendor, association, NGO, govt body, overseas training provider)', 'In-house, ROT in-house, coaching & mentoring only'],
      ],
      notes: [
        'SLB: at least 2 participating employers. The in-house group rate is divided by total pax (prorated when fewer than 5 pax) and each employer pays for its own pax — it never switches to the public rate. Only the organising employer may claim consumables. A Joint Training Letter is required.',
        'HCC / SBL with subsidiaries: the course fee switches to the public per-pax rate and each company pays for its own pax. Travel, meal and air ticket are calculated for the host company and its branches only — each subsidiary claims those in its own grant application.',
        'ALAT, IT, ITS, FWT, OJT and SGM have their own rules — see the notes on each scheme’s form.',
      ],
    },
    {
      id: 'inhouse',
      title: 'In-house (and coaching & mentoring)',
      columns: ['Cost item', 'Own premises', 'External venue / hotel'],
      rows: [
        ['Course fee (external / overseas trainer)', groupFee, groupFee],
        ['Internal trainer allowance (instead of course fee)', trainerAllow, trainerAllow],
        ['Meal allowance', `Host company staff (+ each internal trainer based at the premises): ${meal}`, 'Not claimable'],
        ['Daily (travel) allowance', `Branch staff: ${travel} (half day: half rate)`, `All trainees: ${travel} (half day: half rate)`],
        ['External trainer allowance', `${travel} per trainer per day by the trainer's distance (half day: half rate)`, `${travel} per trainer per day by the trainer's distance (half day: half rate)`],
        ['Internal trainer daily allowance', `Internal trainer from a branch: ${travel} per trainer per day (no meal for that trainer)`, `Every internal trainer: ${travel} per trainer per day`],
        ['Air ticket', 'Branch staff; trainer if travelling (external trainer only when branch / subsidiary staff attend; overseas trainer always; internal trainer from a branch)', 'All trainees; trainer as for own premises (external trainer always)'],
        ['Overseas trainer daily allowance', `${rm(A.overseas_trainer)}/trainer/day (half day ${rm(A.overseas_trainer / 2)})`, `${rm(A.overseas_trainer)}/trainer/day (half day ${rm(A.overseas_trainer / 2)})`],
        ['Chartered transport', 'Not claimable', 'As per quotation'],
        ['Consumable materials', `${rm(A.consumable)}/group`, `${rm(A.consumable)}/group`],
        ['Licensed Training Materials (LTM)', 'As charged — needs an HRD Corp Special Approval Letter', 'As charged — needs an HRD Corp Special Approval Letter'],
      ],
    },
    {
      id: 'rot',
      title: 'ROT — Remote Online Training (in-house and public)',
      intro: 'ROT is treated the same as face-to-face per HRD Corp: the Training Venue decides the allowance, because it depends on where the trainees physically are. Each trainee gets either the meal allowance or the daily allowance — never both.',
      columns: ['Cost item', 'Own premises / own location', 'External venue / hotel'],
      rows: [
        ['Meal allowance', `All trainees (host and branch staff, each at their own workplace): ${meal}`, 'Not claimable'],
        ['Daily (travel) allowance', 'Not claimable — nobody travels', `All trainees: ${travel} (half day: half rate; ROT public: max ${cap} per employer)`],
        ['Trainer allowance (daily / meal)', 'Not claimable — the trainer delivers online', 'Not claimable — the trainer delivers online'],
        ['Air ticket', 'Not claimable for ROT', 'Not claimable for ROT'],
        ['Chartered transport', 'Not claimable', 'As per quotation'],
        ['Course fee — ROT in-house', `${groupFee} (external trainer); internal trainer gets the trainer allowance instead`, `${groupFee} (external trainer); internal trainer gets the trainer allowance instead`],
        ['Course fee — ROT public', `${paxFee}, max ${cap} pax per employer`, `${paxFee}, max ${cap} pax per employer`],
        ['Consumable materials', `ROT in-house: ${rm(A.consumable)}/group · ROT public: not claimable`, `ROT in-house: ${rm(A.consumable)}/group · ROT public: not claimable`],
      ],
      notes: [
        `Minimum ${R.inhouse.min_pax_rot} participant.`,
        'A System Generated Attendance Report is required (training date, trainee names, clock-in / clock-out or duration, signed by the Training Provider and employer).',
      ],
    },
    {
      id: 'public',
      title: 'Public training',
      columns: ['Cost item', 'Rule'],
      rows: [
        ['Course fee', `General: ${paxFee}; Focus Area / Industry Specific: as charged. Max ${cap} pax per employer (host + branches = one employer; each subsidiary its own). Professional certification: as charged, actual number of trainees`],
        ['Daily (travel) allowance', `All trainees: ${travel} (half day: half rate), max ${cap} per employer except certification courses`],
        ['Air ticket', `All trainees (actual airfare), max ${cap} per employer except certification courses`],
        ['Meal allowance / consumables', 'Not claimable'],
      ],
      notes: ['HCC and SBL only.'],
    },
    {
      id: 'seminar',
      title: 'Seminar & conference',
      columns: ['Cost item', 'Local', 'Overseas'],
      rows: [
        ['Course / seminar fee', `${paxFee} (no ${cap}-pax cap)`, `As charged × ${pct(R.seminar.overseas_assistance)} assistance`],
        ['Daily allowance', `Daily (travel) allowance for all trainees: ${travel}`, `${rm(R.overseas.daily_allowance)}/pax/day × ${ovs}, up to ${R.overseas.extra_days_max} extra travel days`],
        ['Air ticket', 'All trainees (actual airfare)', `All trainees (actual airfare × ${ovs})`],
        ['Meal allowance / consumables', 'Not claimable', 'Not claimable'],
      ],
      notes: [`Local: min ${R.seminar.min_pax_inhouse} attendees (in-house) or ${R.seminar.min_pax_public_per_tp} per Training Provider (public). Speakers: min 1 (half day), 2 (full day). HCC and SBL only.`],
    },
    {
      id: 'elearning',
      title: 'E-learning and mobile e-learning',
      columns: ['Cost item', 'Rule'],
      rows: [
        ['Course fee', `${hourList} per pax (ceiling — an actual fee below it is claimed as charged)`],
        ['More than ' + maxHr + ' hours', `Each further block: up to 4 hrs = ${rm(R.elearning.hour_table[4])} (half-day block), otherwise ${rm(R.elearning.hour_table[maxHr])} (full-day block)`],
        ['All other allowances', 'Not claimable (self-paced, no trainer, no travel)'],
      ],
      notes: ['Minimum 1 hour, 1 complete module, 1 pax. HCC and SBL only.'],
    },
    {
      id: 'overseas',
      title: 'Overseas training',
      columns: ['Cost item', 'Rule'],
      rows: [
        ['Course fee', `As charged (convert to RM) × ${ovs} assistance; max ${cap} pax per employer`],
        ['Daily allowance', `${rm(R.overseas.daily_allowance)}/pax/day × ${ovs}, training days + up to ${R.overseas.extra_days_max} extra travel days`],
        ['Air ticket', `Actual airfare × ${ovs}`],
        ['Meal / local travel / consumables', 'Not claimable'],
      ],
      notes: ['HCC and SBL only. The employer co-pays the other 50%.'],
    },
    {
      id: 'development',
      title: 'Development programme',
      columns: ['Cost item', 'Rule'],
      rows: [
        ['Course fee', 'Local: 100% · Overseas: 50% (100% for Master’s / PhD or a private higher education institution). Includes registration and exam fees.'],
        ['Study allowance (full-time only)', `Local ${rm(R.development.study_local)}/month · Overseas ${rm(R.development.study_overseas)}/month (50% for overseas Master’s / PhD)`],
        ['Thesis allowance (full-time Master’s / PhD)', `Master's ${rm(R.development.thesis_masters)} · PhD ${rm(R.development.thesis_phd)} per trainee`],
        ['Air ticket', 'Overseas programmes: 50% of airfare'],
        ['Meal / daily (travel) / trainer allowance / consumables', 'Not claimable'],
      ],
      notes: ['Minimum 3 months (1 month = 30 training days). HCC: accredited programme at an accredited institution. SBL: locally or overseas accredited (MQA) programme. Course fees must be fully borne by the employer.'],
    },
  ];
}
