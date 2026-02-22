/**
 * HRD Corp Allowable Cost Matrix (ACM) — Rates & Thresholds
 * Source: Allowable Cost Matrix Guide (September 2025) + ACM Table (November 2025 Edition)
 *
 * Update this file when HRD Corp releases a new ACM edition.
 * Do NOT put eligibility logic here — see acm-rules.js for that.
 */

export const RATES = {
  inhouse: {
    full_day: 10500,       // RM per group per day (full day ≥ 7 hrs)
    half_day: 6000,        // RM per group per day (half day 4–6 hrs)
    prorate_threshold: 5,  // course fee & trainer allowance prorated when pax < 5
    min_pax_f2f: 2,        // minimum trainees for face-to-face in-house
    min_pax_rot: 1,        // minimum trainees for ROT in-house
    max_pax_soft: 50,      // maximum trainees per group — soft skills (Circular 3/2024)
    max_pax_tech: 25,      // maximum trainees per group — technical (Circular 3/2024)
  },

  public_training: {
    full_day: 1750,           // RM per pax per day (full day)
    half_day: 1000,           // RM per pax per day (half day)
    max_pax_per_employer: 9,  // maximum pax per employer eligible for financial assistance
  },

  elearning: {
    // RM per pax per programme, based on total programme duration
    hour_table: {
      1: 125,
      2: 250,
      3: 375,
      4: 500,
      5: 625,
      6: 750,
      7: 875,  // 7 hours is the maximum claimable
    },
  },

  overseas: {
    daily_allowance: 1500,  // RM per pax per day (accommodation + subsistence)
    extra_days_max: 2,      // maximum extra days claimable for travel
    assistance_rate: 0.50,  // 50% financial assistance on course fee, daily allowance & air ticket
  },

  allowances: {
    internal_trainer_full: 1400,  // RM per trainer per day (full day)
    internal_trainer_half: 800,   // RM per trainer per day (half day)
    travel_under_100: 250,        // RM per pax per day, travel distance < 100 km
    travel_over_100: 500,         // RM per pax per day, travel distance ≥ 100 km
    meal_full: 100,               // RM per pax per day (full day)
    meal_half: 50,                // RM per pax per day (half day)
    overseas_trainer: 500,        // RM per overseas trainer per day (daily allowance)
    consumable: 100,              // RM per pax per programme (consumable/printed materials)
  },

  development: {
    study_local: 900,       // RM per month — local study allowance
    study_overseas: 5000,   // RM per month — overseas study allowance
    thesis_masters: 600,    // RM per month — thesis writing allowance (Master's)
    thesis_phd: 1000,       // RM per month — thesis writing allowance (PhD)
  },

  seminar: {
    min_pax_inhouse: 51,         // minimum total pax for in-house seminar/conference
    min_pax_public_per_tp: 51,   // minimum total pax per Training Provider for public seminar
    overseas_assistance: 0.50,   // 50% financial assistance for overseas seminar
  },

  as_charged_estimate: 10000,  // placeholder for "as charged" items in estimates
  dev_estimate: 20000,         // placeholder for development programme cost estimates
  audit_risk_pax: 25,          // pax count above which HRD Corp may request audit documentation
};
