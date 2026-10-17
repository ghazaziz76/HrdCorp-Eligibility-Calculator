import fs from 'fs';
import path from 'path';
import { buildAcmReference, editionsLine, mergeRates, getCostMatrixRow, ACM_EDITIONS_DEFAULT } from './acm-rules';
import { RATES } from './acm-rates';
import { calculateEligibility } from '../utils/HRDEligibilityCalculator';

const section = (secs, id) => secs.find(s => s.id === id);
const row = (sec, label) => sec.rows.find(r => r[0] === label);

test('module stays plain data: no React / DOM imports (the Android app copies it)', () => {
    const src = fs.readFileSync(path.join(__dirname, 'acm-rules.js'), 'utf8');
    const imports = src.match(/^import .*$/gm) || [];
    expect(imports).toEqual(["import { RATES as RATES_STATIC } from './acm-rates.js';"]);
    expect(src).not.toMatch(/document\.|window\./);
});

test('editions line defaults to September 2025 / November 2025 and follows the live version', () => {
    expect(ACM_EDITIONS_DEFAULT).toEqual({ acm_guide_edition: 'September 2025', acm_table_edition: 'November 2025' });
    expect(editionsLine()).toBe('ACM Guide — September 2025 Edition · ACM Table — November 2025 Edition');
    expect(editionsLine({ acm_guide_edition: 'March 2026', acm_table_edition: 'April 2026' }))
        .toBe('ACM Guide — March 2026 Edition · ACM Table — April 2026 Edition');
});

test('falls back to acm-rates.js and fills gaps in partial live rates', () => {
    expect(mergeRates(null)).toBe(RATES);
    const m = mergeRates({ allowances: { meal_full: 120 } });
    expect(m.allowances.meal_full).toBe(120);
    expect(m.allowances.meal_half).toBe(RATES.allowances.meal_half);
    expect(m.inhouse).toEqual(RATES.inhouse);
});

test('rates table shows the static rates, and live rates when given', () => {
    const rates = section(buildAcmReference(), 'rates');
    expect(row(rates, 'Meal allowance')[1]).toBe('Full day RM100/day/pax · Half day RM50/day/pax');
    expect(row(rates, 'Daily (travel) allowance')[1]).toBe('<100km: RM250/day/pax · ≥100km: RM500/day/pax');
    expect(row(rates, 'Course fee — in-house (general courses)')[1]).toContain('RM10,500/group/day');
    const live = section(buildAcmReference({ ...RATES, allowances: { ...RATES.allowances, meal_full: 120 } }), 'rates');
    expect(row(live, 'Meal allowance')[1]).toContain('RM120/day/pax');
});

test('ROT section states the current venue rule', () => {
    const rot = section(buildAcmReference(), 'rot');
    expect(rot.intro).toMatch(/same as face-to-face/);
    expect(rot.intro).toMatch(/Training Venue decides the allowance/);
    expect(rot.columns).toEqual(['Cost item', 'Own premises / own location', 'External venue / hotel']);
    const meal = row(rot, 'Meal allowance');
    expect(meal[1]).toContain('Full day RM100/day/pax · Half day RM50/day/pax');
    expect(meal[2]).toBe('Not claimable');
    const daily = row(rot, 'Daily (travel) allowance');
    expect(daily[1]).toMatch(/Not claimable — nobody travels/);
    expect(daily[2]).toContain('<100km: RM250/day/pax · ≥100km: RM500/day/pax');
    expect(row(rot, 'Air ticket').slice(1)).toEqual(['Not claimable for ROT', 'Not claimable for ROT']);
});

test('every section is a well-formed table', () => {
    for (const s of buildAcmReference()) {
        expect(typeof s.id).toBe('string');
        expect(typeof s.title).toBe('string');
        for (const r of s.rows) {
            expect(r).toHaveLength(s.columns.length);
            r.forEach(c => expect(typeof c).toBe('string'));
        }
    }
});

// The engine is the source of truth: the ROT rule displayed above must match it.
describe('agrees with the engine for ROT', () => {
    const base = { scheme: 'hcc', trainerType: 'external', duration: 'full_day', days: 1, host: { pax: 5, kmDistance: 'under_100' }, branches: [{ label: 'JB', pax: 2, kmDistance: 'over_100' }] };
    const labels = (r) => r.items.map(i => i.label);

    test.each(['rot_inhouse', 'rot_public'])('%s at own premises: meal only, no daily allowance, no air ticket', (trainingType) => {
        const r = calculateEligibility({ ...base, trainingType, venue: 'employer_premises' });
        expect(labels(r)).toContain('D) Meal Allowance');
        expect(labels(r)).not.toContain('C) Travel Allowance');
        expect(labels(r)).not.toContain('G) Air Ticket');
        expect(r.items.find(i => i.label === 'D) Meal Allowance').amount).toBe(100 * 7);
        const m = getCostMatrixRow(trainingType, 'own_premise', 'external');
        expect(m).toMatchObject({ meal_trainees: true, travel_trainees: false, air_trainees: false });
    });

    test.each(['rot_inhouse', 'rot_public'])('%s at an external venue: daily allowance only, no meal, no air ticket', (trainingType) => {
        const r = calculateEligibility({ ...base, trainingType, venue: 'external_hotel' });
        expect(labels(r)).toContain('C) Travel Allowance');
        expect(labels(r)).not.toContain('D) Meal Allowance');
        expect(labels(r)).not.toContain('G) Air Ticket');
        const m = getCostMatrixRow(trainingType, 'external_hotel', 'external');
        expect(m).toMatchObject({ meal_trainees: false, travel_trainees: true, air_trainees: false, chartered_transport: true });
    });

    test('consumables: ROT in-house yes, ROT public no (as the reference says)', () => {
        const inh = calculateEligibility({ ...base, trainingType: 'rot_inhouse', venue: 'employer_premises' });
        const pub = calculateEligibility({ ...base, trainingType: 'rot_public', venue: 'employer_premises' });
        expect(labels(inh)).toContain('I) Consumable Training Materials');
        expect(labels(pub)).not.toContain('I) Consumable Training Materials');
    });
});
