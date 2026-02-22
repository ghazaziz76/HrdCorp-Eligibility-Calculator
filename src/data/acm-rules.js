/**
 * HRD Corp ACM — Eligibility Rules Matrix
 * Source: ACM Table (November 2025 Edition) + ACM Guide (September 2025)
 *
 * Three exports:
 *   SCHEME_CONFIG   — per-scheme settings (payment flow, trainer requirements, allowed types)
 *   TRAINING_RULES  — per-training-type validation thresholds
 *   COST_MATRIX     — one row per scenario (trainer type × venue); drives the engine
 */

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
    allowed_training_types: ['inhouse', 'rot_inhouse'],
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
// Venue values: 'own_premise' | 'external_hotel' | 'rot_venue' | null
// Trainer values: 'internal' | 'external' | 'overseas' | null
// ---------------------------------------------------------------------------

export const COST_MATRIX = [
  // ─── IN-HOUSE: own premise, internal trainer ───────────────────────────
  {
    id: 'inhouse_own_internal',
    training_types: ['inhouse', 'rot_inhouse', 'coaching_mentoring'],
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
    travel_trainer: true,          // if internal trainer travels from a branch
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
    schemes: ['hcc', 'sbl'],       // SLB not applicable for overseas trainer
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
    schemes: ['hcc', 'sbl'],
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

  // ─── ROT IN-HOUSE (at another employer's premise) ──────────────────────
  {
    id: 'rot_inhouse_any',
    training_types: ['rot_inhouse'],
    venue: 'rot_venue',
    trainer: null,   // internal or external — same rules apply
    schemes: ['hcc', 'sbl', 'slb'],
    course_fee: true,
    trainer_allowance: true,       // if internal trainer
    meal_trainees: true,
    meal_includes_trainer: true,   // if internal trainer
    travel_trainees: false,        // NO travel/air for ROT in-house (venue is another employer's premise)
    travel_trainer: false,
    air_trainees: false,
    air_trainer: false,
    chartered_transport: false,
    consumable: true,
    consumable_slb_organiser_only: true,
    overseas_trainer_daily: false,
    overseas_assistance: false,
    slb_cost_mode: 'group_rate_divided_by_total_pax',
  },

  // ─── PUBLIC / ROT PUBLIC ────────────────────────────────────────────────
  {
    id: 'public_local',
    training_types: ['public', 'rot_public'],
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
    thesis_allowance: true,        // monthly thesis writing allowance
    trainer_allowance: false,
    meal_trainees: false,
    meal_includes_trainer: false,
    travel_trainees: false,
    travel_trainer: false,
    air_trainees: true,            // air ticket for overseas programmes
    air_trainer: false,
    chartered_transport: false,
    consumable: false,
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
 * @param {string|null} venue       - 'own_premise' | 'external_hotel' | 'rot_venue' | null
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
