import { calculateEligibility } from './HRDEligibilityCalculator';

// ROT (Remote Online Training), owner's rule: the venue decides the allowance.
//  - Employer's premises / own location: meal allowance for every trainee (host and branches), no daily (travel) allowance.
//  - External venue / hotel: daily (travel) allowance, no meal allowance.
const base = (over = {}) => ({
    scheme: 'hcc', trainerType: 'external', numberOfTrainers: 1, venue: 'employer_premises',
    courseCategory: 'general', duration: 'full_day', days: 2, extraDays: 0, elearningHours: 7,
    internalTrainerFromBranch: false, numberOfSpeakers: 1, hasLTM: false, ltmActualCost: 0,
    host: { pax: 10, kmDistance: 'over_100' },
    branches: [{ label: 'Penang', pax: 5, kmDistance: 'over_100' }],
    subsidiaries: [],
    ...over,
});
const item = (r, prefix) => r.items.find((i) => i.label.startsWith(prefix));

describe.each(['rot_inhouse', 'rot_public'])('%s', (trainingType) => {
    test('at employer premises: meal for host and branches, no daily allowance', () => {
        const r = calculateEligibility(base({ trainingType }));
        expect(item(r, 'C) Travel Allowance')).toBeUndefined();
        const meal = item(r, 'D) Meal Allowance');
        expect(meal).toBeDefined();
        expect(meal.amount).toBe(100 * (10 + 5) * 2);
    });

    test('half day at employer premises: half-day meal rate', () => {
        const r = calculateEligibility(base({ trainingType, duration: 'half_day' }));
        expect(item(r, 'D) Meal Allowance').amount).toBe(50 * (10 + 5) * 2);
    });

    test('at an external venue / hotel: daily allowance for all, no meal', () => {
        const r = calculateEligibility(base({ trainingType, venue: 'external_hotel' }));
        const travel = item(r, 'C) Travel Allowance');
        expect(travel).toBeDefined();
        // 15 trainees at >=100km: RM500/day each for the 2 training days.
        // ROT public: host + branches are one employer → max 9 trainees get financial assistance.
        const eligible = trainingType === 'rot_public' ? 9 : 15;
        expect(travel.amount).toBe(500 * eligible * 2);
        expect(item(r, 'D) Meal Allowance')).toBeUndefined();
    });

    test('ROT note says the venue decides the allowance', () => {
        const r = calculateEligibility(base({ trainingType }));
        const note = r.warnings.find((w) => w.includes('ROT (Remote Online Training)'));
        expect(note).toContain('Own premises / own location: meal allowance only');
        expect(note).toContain('External venue / hotel: daily (travel) allowance only');
        expect(note).not.toContain('Travel allowance IS claimable');
    });
});

test('face-to-face in-house at employer premises unchanged: host meal + branch travel', () => {
    const r = calculateEligibility(base({ trainingType: 'inhouse' }));
    expect(item(r, 'D) Meal Allowance').amount).toBe(100 * 10 * 2);
    expect(item(r, 'C) Travel Allowance')).toBeDefined();
});

test('face-to-face public unchanged: travel for all', () => {
    const r = calculateEligibility(base({ trainingType: 'public', branches: [] }));
    expect(item(r, 'C) Travel Allowance')).toBeDefined();
    expect(item(r, 'D) Meal Allowance')).toBeUndefined();
});
