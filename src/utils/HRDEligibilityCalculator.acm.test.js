import { calculateEligibility } from './HRDEligibilityCalculator';
import { RATES } from '../data/acm-rates';

// ACM Jan 2026 Guide / ACM Table Nov 2025 rule checks for the training-course engine.
const base = (over = {}) => ({
    scheme: 'hcc', trainingType: 'inhouse', trainerType: 'external', numberOfTrainers: 1,
    venue: 'employer_premises', courseCategory: 'general', duration: 'full_day', days: 2,
    extraDays: 0, elearningHours: 7, internalTrainerFromBranch: false, numberOfSpeakers: 2,
    hasLTM: false, ltmActualCost: 0,
    host: { pax: 10, kmDistance: 'under_100' }, branches: [], subsidiaries: [],
    ...over,
});
const item = (r, prefix) => r.items.find((i) => i.label.startsWith(prefix));

// ── 1. Half day: half of the fixed trainee allowance ────────────────────────
describe('half day halves the daily (travel) allowance', () => {
    test('in-house branch staff: RM125 (<100km) and RM250 (>=100km) per pax per day', () => {
        const r = calculateEligibility(base({
            duration: 'half_day',
            branches: [{ label: 'A', pax: 2, kmDistance: 'under_100' }, { label: 'B', pax: 3, kmDistance: 'over_100' }],
        }));
        expect(item(r, 'C) Travel Allowance').amount).toBe(125 * 2 * 2 + 250 * 3 * 2);
    });

    test('public: all trainees at the half rate', () => {
        const r = calculateEligibility(base({ trainingType: 'public', duration: 'half_day', host: { pax: 4, kmDistance: 'over_100' } }));
        expect(item(r, 'C) Travel Allowance').amount).toBe(250 * 4 * 2);
    });

    test('ROT at an external venue: half rate', () => {
        const r = calculateEligibility(base({ trainingType: 'rot_inhouse', duration: 'half_day', venue: 'external_hotel', host: { pax: 4, kmDistance: 'under_100' } }));
        expect(item(r, 'C) Travel Allowance').amount).toBe(125 * 4 * 2);
    });

    test('overseas trainer daily allowance: RM250 on a half day', () => {
        const r = calculateEligibility(base({ trainerType: 'overseas', duration: 'half_day', numberOfTrainers: 2 }));
        expect(item(r, 'E) Overseas Trainer').amount).toBe(250 * 2 * 2);
        const full = calculateEligibility(base({ trainerType: 'overseas', numberOfTrainers: 2 }));
        expect(item(full, 'E) Overseas Trainer').amount).toBe(500 * 2 * 2);
    });
});

// ── 2. External trainer allowance ───────────────────────────────────────────
describe('external trainer allowance', () => {
    test('in-house at employer premises: RM250/trainer/day by default', () => {
        const r = calculateEligibility(base({ numberOfTrainers: 2 }));
        expect(item(r, 'C) External Trainer Allowance').amount).toBe(250 * 2 * 2);
    });

    test('>=100km and half day: RM500 halved', () => {
        const r = calculateEligibility(base({ trainerKmDistance: 'over_100', duration: 'half_day', venue: 'external_hotel' }));
        expect(item(r, 'C) External Trainer Allowance').amount).toBe(250 * 1 * 2);
        const full = calculateEligibility(base({ trainerKmDistance: 'over_100', venue: 'external_hotel' }));
        expect(item(full, 'C) External Trainer Allowance').amount).toBe(500 * 2);
    });

    test('coaching & mentoring also gets it; ROT, public and internal/overseas trainers do not', () => {
        expect(item(calculateEligibility(base({ trainingType: 'coaching_mentoring' })), 'C) External Trainer Allowance')).toBeDefined();
        expect(item(calculateEligibility(base({ trainingType: 'rot_inhouse' })), 'C) External Trainer Allowance')).toBeUndefined();
        expect(item(calculateEligibility(base({ trainingType: 'rot_inhouse', venue: 'external_hotel' })), 'C) External Trainer Allowance')).toBeUndefined();
        expect(item(calculateEligibility(base({ trainingType: 'public' })), 'C) External Trainer Allowance')).toBeUndefined();
        expect(item(calculateEligibility(base({ trainerType: 'internal' })), 'C) External Trainer Allowance')).toBeUndefined();
        expect(item(calculateEligibility(base({ trainerType: 'overseas' })), 'C) External Trainer Allowance')).toBeUndefined();
    });

    test('is counted in the total', () => {
        const r = calculateEligibility(base());
        const sum = r.items.filter(i => i.eligible && typeof i.amount === 'number').reduce((s, i) => s + i.amount, 0);
        expect(r.totalClaimable).toBe(Math.round(sum));
    });
});

// ── 3. Internal trainer daily allowance ─────────────────────────────────────
describe('internal trainer daily allowance', () => {
    test('HQ-based internal trainer at own premises: meal (one per trainer), no daily allowance', () => {
        const r = calculateEligibility(base({ trainerType: 'internal', numberOfTrainers: 2 }));
        expect(item(r, 'C) Internal Trainer Daily Allowance')).toBeUndefined();
        expect(item(r, 'D) Meal Allowance').amount).toBe(100 * (10 + 2) * 2);
    });

    test('internal trainer from a branch: daily allowance by trainerKmDistance, no meal for the trainer', () => {
        const r = calculateEligibility(base({ trainerType: 'internal', internalTrainerFromBranch: true, trainerKmDistance: 'over_100' }));
        expect(item(r, 'C) Internal Trainer Daily Allowance').amount).toBe(500 * 1 * 2);
        expect(item(r, 'D) Meal Allowance').amount).toBe(100 * 10 * 2);
    });

    test('internal trainer at a hotel: daily allowance, half-day halved', () => {
        const r = calculateEligibility(base({ trainerType: 'internal', venue: 'external_hotel', duration: 'half_day', numberOfTrainers: 2 }));
        expect(item(r, 'C) Internal Trainer Daily Allowance').amount).toBe(125 * 2 * 2);
        expect(item(r, 'D) Meal Allowance')).toBeUndefined();
    });

    test('not for ROT (trainer is online)', () => {
        const r = calculateEligibility(base({ trainingType: 'rot_inhouse', trainerType: 'internal', venue: 'external_hotel' }));
        expect(item(r, 'C) Internal Trainer Daily Allowance')).toBeUndefined();
    });
});

// ── 4. Public: 9 trainees per employer ──────────────────────────────────────
describe('public courses: maximum 9 trainees per employer', () => {
    const pub = (over) => base({
        trainingType: 'public', days: 1,
        host: { pax: 6, kmDistance: 'under_100' },
        branches: [{ label: 'B', pax: 6, kmDistance: 'under_100' }],
        subsidiaries: [{ label: 'S1', pax: 5, kmDistance: 'under_100' }, { label: 'S2', pax: 12, kmDistance: 'under_100' }],
        ...over,
    });

    test('general course fee: host+branches = one employer (12→9), each subsidiary its own cap', () => {
        const r = calculateEligibility(pub());
        expect(item(r, 'B) Course Fee').amount).toBe(1750 * (9 + 5 + 9));
    });

    test('rot_public uses the same per-employer cap', () => {
        const r = calculateEligibility(pub({ trainingType: 'rot_public' }));
        expect(item(r, 'B) Course Fee').amount).toBe(1750 * (9 + 5 + 9));
    });

    test('trainee daily allowance capped at 9 for host+branches', () => {
        const r = calculateEligibility(pub());
        expect(item(r, 'C) Travel Allowance').amount).toBe(250 * 9);
    });

    test('focus area: capped too, uses the actual fee when given', () => {
        const r = calculateEligibility(pub({ courseCategory: 'focus_area', actualCourseFeePerPax: 3000 }));
        expect(item(r, 'B) Course Fee').amount).toBe(3000 * (9 + 5 + 9));
    });

    test('certification: actual number of trainees (no cap) for fee and allowance', () => {
        const r = calculateEligibility(pub({ courseCategory: 'certification', actualCourseFeePerPax: 3000 }));
        expect(item(r, 'B) Course Fee').amount).toBe(3000 * (12 + 5 + 12));
        expect(item(r, 'C) Travel Allowance').amount).toBe(250 * 12);
    });

    test('local seminar has no 9-pax cap (ACM seminar section sets no maximum)', () => {
        const r = calculateEligibility(pub({ trainingType: 'seminar_conference' }));
        expect(item(r, 'B) Course Fee').amount).toBe(1750 * (12 + 5 + 12));
    });
});

// ── 5. SLB below 5 pax is prorated ──────────────────────────────────────────
test('SLB without an actual fee: fewer than 5 pax prorated (RM10,500 / 5 = RM2,100 per trainee)', () => {
    const r = calculateEligibility(base({
        scheme: 'slb', days: 1, host: { pax: 2, kmDistance: 'under_100' },
        subsidiaries: [{ label: 'E2', pax: 1, kmDistance: 'under_100' }],
    }));
    expect(item(r, 'B) Course Fee').amount).toBe(2100 * 3);
});

// ── 6. Development programme has no consumables ─────────────────────────────
test('development programme: no consumable training materials', () => {
    const r = calculateEligibility(base({ trainingType: 'development', trainerType: 'external' }));
    expect(item(r, 'I) Consumable')).toBeUndefined();
});

// ── 7. Actual course fee handling ───────────────────────────────────────────
describe('actual course fee', () => {
    test('public focus area uses the actual fee instead of the estimate', () => {
        const r = calculateEligibility(base({ trainingType: 'public', courseCategory: 'industry_specific', host: { pax: 2, kmDistance: 'under_100' }, actualCourseFeePerPax: 1200 }));
        expect(item(r, 'B) Course Fee').amount).toBe(1200 * 2);
        expect(item(r, 'B) Course Fee').isEstimate).toBeFalsy();
    });

    test('e-learning: min(actual fee per pax, hour-table ceiling)', () => {
        const low = calculateEligibility(base({ trainingType: 'elearning', elearningHours: 7, actualCourseFeePerPax: 600, host: { pax: 3, kmDistance: 'under_100' } }));
        expect(item(low, 'B) Course Fee (E-Learning)').amount).toBe(600 * 3);
        const high = calculateEligibility(base({ trainingType: 'elearning', elearningHours: 7, actualCourseFeePerPax: 2000, host: { pax: 3, kmDistance: 'under_100' } }));
        expect(item(high, 'B) Course Fee (E-Learning)').amount).toBe(875 * 3);
    });

    test('an actual fee of 0 counts only when actualCourseFeeProvided is true', () => {
        const notGiven = calculateEligibility(base({ actualCourseFeePerPax: 0 }));
        expect(item(notGiven, 'B) Course Fee').amount).toBe(10500 * 2);
        const zero = calculateEligibility(base({ actualCourseFeePerPax: 0, actualCourseFeeProvided: true }));
        expect(item(zero, 'B) Course Fee').amount).toBe(0);
    });

    test('in-house actual fee below the ceiling is used', () => {
        const r = calculateEligibility(base({ actualCourseFeePerPax: 500 }));
        expect(item(r, 'B) Course Fee').amount).toBe(500 * 10);
    });
});

// ── 8. Extra travel day only when applied for ───────────────────────────────
describe('extra travel day', () => {
    const br = { branches: [{ label: 'B', pax: 2, kmDistance: 'over_100' }] };
    test('not automatic', () => {
        const r = calculateEligibility(base(br));
        expect(item(r, 'C) Travel Allowance').amount).toBe(500 * 2 * 2);
    });
    test('added for >=100km full day when extraTravelDay is true', () => {
        const r = calculateEligibility(base({ ...br, extraTravelDay: true }));
        expect(item(r, 'C) Travel Allowance').amount).toBe(500 * 2 * 3);
    });
    test('never on a half day', () => {
        const r = calculateEligibility(base({ ...br, extraTravelDay: true, duration: 'half_day' }));
        expect(item(r, 'C) Travel Allowance').amount).toBe(250 * 2 * 2);
    });
});

// ── 9. ROT: no air ticket entitlement ───────────────────────────────────────
test.each(['rot_inhouse', 'rot_public'])('%s: airTicketEntitled is 0', (trainingType) => {
    const r = calculateEligibility(base({ trainingType, venue: 'external_hotel', branches: [{ label: 'B', pax: 3, kmDistance: 'over_100' }] }));
    expect(r.airTicketEntitled).toBe(0);
});

// ── 10. Venue only for types that have a venue box ──────────────────────────
describe('a leftover external venue is ignored for types without a venue box', () => {
    test.each(['public', 'overseas', 'seminar_conference', 'overseas_seminar', 'elearning'])('%s: no chartered transport', (trainingType) => {
        const r = calculateEligibility(base({ trainingType, venue: 'external_hotel' }));
        expect(item(r, 'H) Chartered')).toBeUndefined();
    });
    test('in-house at a hotel still gets chartered transport', () => {
        expect(item(calculateEligibility(base({ venue: 'external_hotel' })), 'H) Chartered')).toBeDefined();
    });
});

// ── 11. Partial live rates are deep-merged ──────────────────────────────────
test('partial ratesOverride falls back to bundled rates (no NaN)', () => {
    const r = calculateEligibility(base({ branches: [{ label: 'B', pax: 2, kmDistance: 'over_100' }] }), { allowances: { meal_full: 120 } });
    expect(item(r, 'D) Meal Allowance').amount).toBe(120 * 10 * 2);
    expect(item(r, 'B) Course Fee').amount).toBe(RATES.inhouse.full_day * 2);
    expect(Number.isNaN(r.totalClaimable)).toBe(false);
});

// ── 15. SLB with an overseas trainer is allowed ─────────────────────────────
test('SLB + overseas trainer: no "not supported" warning', () => {
    const r = calculateEligibility(base({ scheme: 'slb', trainerType: 'overseas' }));
    expect(r.warnings.some(w => /does not support overseas/i.test(w))).toBe(false);
    expect(r.warnings.some(w => /overseas training provider/i.test(w))).toBe(true);
});

// Chartered transport is for in-house programmes outside the employer's premises (ACM Guide 5A),
// so a development programme never gets it (matches COST_MATRIX in acm-rules.js).
test('development at an external venue: no chartered transport', () => {
    const r = calculateEligibility(base({ trainingType: 'development', venue: 'external_hotel' }));
    expect(item(r, 'H) Chartered')).toBeUndefined();
});
