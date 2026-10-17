import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { HRDCorpCostCalculator } from './HRDCorpCostCalculator';
import { calculateEligibility } from '../utils/HRDEligibilityCalculator';
import { exportResultPDF } from '../utils/pdfExportWeb';

// Real engine, wrapped so the inputs the form sends can be checked.
jest.mock('../utils/HRDEligibilityCalculator', () => {
    const actual = jest.requireActual('../utils/HRDEligibilityCalculator');
    return { ...actual, calculateEligibility: jest.fn(actual.calculateEligibility) };
});
jest.mock('../utils/pdfExportWeb', () => ({ exportResultPDF: jest.fn() }));

global.IS_REACT_ACT_ENVIRONMENT = true;

const ai = { enabled: true, limit: 50, used: 3, remaining: 47, resets_on: '2026-11-17', reason: 'ok' };
const NONE = { trainingProgrammeName: null, trainingType: null, venue: null, days: null, duration: null, actualCourseFee: null };

let container, root;
beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    localStorage.setItem('hrd_activation_code', 'HRD-AAAA-BBBB-CCCC');
    // CRA resets mock implementations before each test: put the real engine back.
    calculateEligibility.mockImplementation(jest.requireActual('../utils/HRDEligibilityCalculator').calculateEligibility);
    calculateEligibility.mockClear();
    exportResultPDF.mockClear();
});
afterEach(() => {
    act(() => root.unmount());
    container.remove();
    localStorage.clear();
    delete global.fetch;
});

// Brochure reply is held until release() is called (null fields → reply right away).
let release;
function mockServer(fields, { hold = false } = {}) {
    global.fetch = jest.fn((url) => {
        if (String(url).endsWith('/api/employer/ai-brochure')) {
            const reply = (f) => ({ ok: true, status: 200, json: () => Promise.resolve({ success: true, data: { fields: f, ai } }) });
            if (!hold) return Promise.resolve(reply(fields));
            return new Promise(r => { release = (f = fields) => r(reply(f)); });
        }
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ success: true, data: { tge: 'activated', ai } }) });
    });
}

function control(text) {
    const label = [...container.querySelectorAll('label')].find(l => l.textContent.trim().startsWith(text));
    if (!label) return null;
    return label.parentElement.querySelector('select, input');
}
function setValue(el, value) {
    const proto = el.tagName === 'SELECT' ? window.HTMLSelectElement.prototype : window.HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
    el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
}
const card = (text) => [...container.querySelectorAll('div')].find(d => d.textContent === text);
const HCC = 'HRD Corp Claimable Courses (HCC)';
const SBL = 'Skim Bantuan Latihan (SBL)';
const SLB = 'Skim Latihan Bersama (SLB)';
const button = (text) => [...container.querySelectorAll('button')].find(b => b.textContent.includes(text));

async function renderWithScheme(name = HCC, props = {}) {
    await act(async () => { root.render(<HRDCorpCostCalculator {...props} />); });
    await act(async () => { card(name).click(); });
}
async function upload() {
    const input = container.querySelector('input[type="file"]');
    Object.defineProperty(input, 'files', { configurable: true, value: [new File(['x'], 'b.pdf')] });
    await act(async () => { input.dispatchEvent(new Event('change', { bubbles: true })); });
}
async function set(label, value) { await act(async () => { setValue(control(label), value); }); }
async function calc() { await act(async () => { button('Calculate Eligibility').click(); }); }
const lastInputs = () => calculateEligibility.mock.calls[calculateEligibility.mock.calls.length - 1][0];

// ── H1: reply applied against the current screen ──────────────
test('scheme switched to SLB while reading: a public brochure does not change the type and says why', async () => {
    mockServer({ ...NONE, trainingType: 'public' }, { hold: true });
    await renderWithScheme();
    await upload();
    expect(container.textContent).toContain('Reading your brochure…');
    await act(async () => { card(SLB).click(); });
    await act(async () => { release(); });
    expect(control('Type of Training').value).toBe('inhouse');
    expect(container.textContent).toContain("This brochure is a Local Public Training course, which SLB doesn't cover — Type of Training was not changed.");
});

test('boxes edited while reading are not overwritten; the type picked by hand is kept', async () => {
    mockServer({ trainingProgrammeName: 'Lean', trainingType: 'inhouse', venue: null, days: 3, duration: 'half_day', actualCourseFee: 900 }, { hold: true });
    await renderWithScheme();
    await upload();
    await set('Type of Training', 'public');
    await set('Number of Training Days', '5');
    await act(async () => { release(); });
    expect(control('Type of Training').value).toBe('public');
    expect(control('Number of Training Days').value).toBe('5');
    expect(control('Daily Duration').value).toBe('half_day');
    expect(control('Actual Course Fee').value).toBe('900');
    expect(container.querySelector('#training-prog-name').value).toBe('Lean');
});

test('a brochure tag removed by a hand edit during the read is not reset to its default', async () => {
    mockServer({ ...NONE, days: 4 });
    await renderWithScheme();
    await upload();
    expect(control('Number of Training Days').value).toBe('4');
    mockServer({ ...NONE }, { hold: true });
    await upload();
    await set('Number of Training Days', '6');
    await act(async () => { release(); });
    expect(control('Number of Training Days').value).toBe('6');
});

// ── H2: online brochure with no venue ─────────────────────────
test.each(['rot_public', 'rot_inhouse'])('%s brochure with no venue sets own premises over a hand-picked hotel', async (type) => {
    mockServer({ ...NONE, trainingType: type });
    await renderWithScheme();
    await set('Type of Training', type);
    await set('Training Venue', 'external_hotel');
    await upload();
    expect(control('Training Venue').value).toBe('employer_premises');
    await calc();
    expect(lastInputs().venue).toBe('employer_premises');
    expect(container.textContent).toContain('Meal Allowance');
});

// ── H3: no Overseas Trainer for ROT ───────────────────────────
test('overseas trainer becomes external when switching to ROT in-house', async () => {
    await renderWithScheme();
    await set('Trainer Type', 'overseas');
    await set('Type of Training', 'rot_inhouse');
    expect(control('Trainer Type').value).toBe('external');
    await calc();
    expect(lastInputs().trainerType).toBe('external');
});

// ── H4: fee box shown where the engine uses the fee ───────────
test.each(['elearning', 'mobile_elearning'])('%s shows the Actual Course Fee box', async (type) => {
    await renderWithScheme();
    await set('Type of Training', type);
    expect(control('Actual Course Fee')).not.toBeNull();
});

test('in-house with an internal trainer: the brochure fee is not filled and no SST warning', async () => {
    mockServer({ ...NONE, actualCourseFee: 1200, feeMayIncludeSst: true });
    await renderWithScheme();
    await set('Trainer Type', 'internal');
    await upload();
    expect(control('Actual Course Fee')).toBeNull();
    expect(container.textContent).not.toContain('Fee may include SST');
    await set('Trainer Type', 'external');
    expect(control('Actual Course Fee').value).toBe('');
});

test('the SST warning goes away when the fee box is edited', async () => {
    mockServer({ ...NONE, trainingType: 'public', actualCourseFee: 1200, feeMayIncludeSst: true });
    await renderWithScheme();
    await upload();
    expect(container.textContent).toContain('Fee may include SST, please check');
    await set('Actual Course Fee', '1100');
    expect(container.textContent).not.toContain('Fee may include SST');
});

test('a brochure fee of 0 is sent as an explicit fee; an empty box is not', async () => {
    mockServer({ ...NONE, trainingType: 'public', actualCourseFee: 0 });
    await renderWithScheme();
    await calc();
    expect(lastInputs()).toMatchObject({ actualCourseFeePerPax: 0, actualCourseFeeProvided: false });
    await upload();
    expect(control('Actual Course Fee').value).toBe('0');
    await calc();
    expect(lastInputs()).toMatchObject({ actualCourseFeePerPax: 0, actualCourseFeeProvided: true });
    await set('Actual Course Fee', '750');
    await calc();
    expect(lastInputs()).toMatchObject({ actualCourseFeePerPax: 750, actualCourseFeeProvided: true });
});

test('a hidden fee box (internal trainer) is not sent to the engine', async () => {
    await renderWithScheme();
    await set('Actual Course Fee', '900');
    await set('Trainer Type', 'internal');
    await calc();
    expect(lastInputs()).toMatchObject({ actualCourseFeePerPax: 0, actualCourseFeeProvided: false });
});

// ── New engine inputs: trainer distance and extra travelling day ──
test('Trainer travel distance: external in-house, internal from branch or at a hotel; not ROT', async () => {
    await renderWithScheme();
    expect(control('Trainer travel distance')).not.toBeNull();
    const labels = [...control('Trainer travel distance').options].map(o => o.textContent);
    expect(labels).toEqual(['<100 km → RM250/day/pax', '≥100 km → RM500/day/pax']);
    await set('Trainer travel distance', 'over_100');
    await calc();
    expect(lastInputs().trainerKmDistance).toBe('over_100');

    await set('Trainer Type', 'internal');
    expect(control('Trainer travel distance')).toBeNull();
    await calc();
    expect(lastInputs().trainerKmDistance).toBeUndefined();
    await act(async () => { container.querySelector('#branchTrainer').click(); });
    expect(control('Trainer travel distance')).not.toBeNull();
    await act(async () => { container.querySelector('#branchTrainer').click(); });
    await set('Training Venue', 'external_hotel');
    expect(control('Trainer travel distance')).not.toBeNull();

    await set('Trainer Type', 'external');
    await set('Type of Training', 'rot_inhouse');
    expect(control('Trainer travel distance')).toBeNull();
    await set('Type of Training', 'coaching_mentoring');
    expect(control('Trainer travel distance')).not.toBeNull();
});

test('extra travelling day checkbox: shown for a >=100 km row on a full day, unticked by default', async () => {
    await renderWithScheme();
    await set('Type of Training', 'public');
    const tick = () => container.querySelector('#extraTravelDay');
    expect(tick()).toBeNull();
    await set('Distance to Venue', 'over_100');
    expect(container.textContent).not.toContain('extra travel day for full-day');
    expect(tick()).not.toBeNull();
    expect(tick().checked).toBe(false);
    expect(container.textContent).toContain('Trainees travel one day before or after (extra travelling day — must be applied for with HRD Corp)');
    await calc();
    expect(lastInputs().extraTravelDay).toBe(false);
    await act(async () => { tick().click(); });
    await calc();
    expect(lastInputs().extraTravelDay).toBe(true);

    // Half day: no extra day, box hidden and not sent.
    await set('Daily Duration', 'half_day');
    expect(tick()).toBeNull();
    await calc();
    expect(lastInputs().extraTravelDay).toBe(false);
});

test('no extra travelling day box for overseas or ROT at own location', async () => {
    await renderWithScheme();
    await set('Type of Training', 'overseas');
    expect(container.querySelector('#extraTravelDay')).toBeNull();
    await set('Type of Training', 'rot_public');
    expect(container.querySelector('#extraTravelDay')).toBeNull();
});

test('saved plans keep the trainer distance and extra-day choices', async () => {
    await renderWithScheme();
    await set('Type of Training', 'inhouse');
    await set('Training Venue', 'external_hotel');
    await set('Trainer travel distance', 'over_100');
    await set('Distance to Venue', 'over_100');
    await act(async () => { container.querySelector('#extraTravelDay').click(); });
    await calc();
    await act(async () => { button('Save as Plan').click(); });
    await act(async () => { button('Save plan').click(); });
    const plans = JSON.parse(localStorage.getItem('hrd_saved_plans'));
    expect(plans[0].inputs).toMatchObject({ trainerKmDistance: 'over_100', extraTravelDay: true });

    act(() => root.unmount());
    root = createRoot(container);
    await act(async () => { root.render(<HRDCorpCostCalculator key="p" initialPlan={plans[0]} />); });
    expect(control('Trainer travel distance').value).toBe('over_100');
    expect(container.querySelector('#extraTravelDay').checked).toBe(true);
});

// ── M2: SLB select, scheme card and brochure agree ────────────
test('SLB keeps and offers Coaching & Mentoring', async () => {
    await renderWithScheme();
    await set('Type of Training', 'coaching_mentoring');
    await act(async () => { card(SLB).click(); });
    const sel = control('Type of Training');
    expect(sel.value).toBe('coaching_mentoring');
    expect([...sel.options].map(o => o.value)).toEqual(['inhouse', 'rot_inhouse', 'coaching_mentoring']);
});

test('SLB accepts a coaching brochure', async () => {
    mockServer({ ...NONE, trainingType: 'coaching_mentoring' });
    await renderWithScheme(SLB);
    await upload();
    expect(control('Type of Training').value).toBe('coaching_mentoring');
    expect(container.querySelector('[data-testid="brochure-notice"]')).toBeNull();
});

// ── R6: leaving a Venue type resets the venue ─────────────────
test('switching to a type without a Venue box resets the venue to own premises', async () => {
    await renderWithScheme();
    await set('Training Venue', 'external_hotel');
    await set('Type of Training', 'public');
    await calc();
    expect(lastInputs().venue).toBe('employer_premises');
    const r = calculateEligibility.mock.results[calculateEligibility.mock.results.length - 1].value;
    expect(r.items.some(i => /chartered/i.test(i.label))).toBe(false);
});

// ── R5: plan name on the PDF ──────────────────────────────────
test('PDF carries the plan name while the scheme is the plan\'s, not after switching scheme', async () => {
    const plan = { id: 'p1', name: 'Q1 plan', schemeId: 'hcc', inputs: { scheme: 'hcc', trainingType: 'public' }, resultSnapshot: null };
    await act(async () => { root.render(<HRDCorpCostCalculator initialPlan={plan} />); });
    await calc();
    await act(async () => { button('Export as PDF').click(); });
    expect(exportResultPDF.mock.calls[0][1].planName).toBe('Q1 plan');

    await act(async () => { card(SBL).click(); });
    await calc();
    await act(async () => { button('Export as PDF').click(); });
    expect(exportResultPDF.mock.calls[1][1].planName).toBeUndefined();
});
