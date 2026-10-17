import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import HRDCalculatorPage, { adminHref, historyPax } from './HRDCalculatorPage';
import { planExportMeta } from './MyPlansTab';
import { ACMDataProvider } from '../context/ACMDataContext';
import { SavedPlansProvider } from '../contexts/SavedPlansContext';

global.IS_REACT_ACT_ENVIRONMENT = true;

let container, root;
beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    // Server unreachable → static rates / default editions.
    global.fetch = jest.fn(() => Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) }));
});
afterEach(() => {
    act(() => root.unmount());
    container.remove();
    delete global.fetch;
    localStorage.clear();
});

async function renderTab(label) {
    await act(async () => {
        root.render(<ACMDataProvider><SavedPlansProvider><HRDCalculatorPage /></SavedPlansProvider></ACMDataProvider>);
    });
    const tab = [...container.querySelectorAll('button')].find(b => b.textContent.includes(label));
    await act(async () => { tab.click(); });
}

test('ACM Reference shows the editions, rate tables and the ROT venue rule', async () => {
    await renderTab('ACM Reference');
    const text = container.textContent;
    expect(text).not.toContain('ACM rates table will be displayed here');
    expect(text).toContain('ACM Guide — September 2025 Edition · ACM Table — November 2025 Edition');
    expect(text).toContain('Current allowable rates');
    expect(text).toContain('RM10,500/group/day');
    const rot = container.querySelector('[data-section="rot"]');
    expect(rot.textContent).toContain('Training Venue decides the allowance');
    expect(rot.textContent).toContain('Not claimable for ROT');
    expect(container.querySelectorAll('[data-section] table').length).toBeGreaterThan(5);
});

test('ACM Reference search narrows the sections', async () => {
    await renderTab('ACM Reference');
    const input = container.querySelector('input[type="search"]');
    const setValue = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    await act(async () => { setValue.call(input, 'remote online'); input.dispatchEvent(new Event('input', { bubbles: true })); });
    expect([...container.querySelectorAll('[data-section]')].map(s => s.dataset.section)).toEqual(['rot']);
    await act(async () => { setValue.call(input, 'zzzz-nothing'); input.dispatchEvent(new Event('input', { bubbles: true })); });
    expect(container.querySelectorAll('[data-section]').length).toBe(0);
    expect(container.textContent).toContain('Nothing matches');
});

test('About lists all 9 schemes and the AURA card no longer promises them', async () => {
    await renderTab('About');
    const text = container.textContent;
    expect(text).toContain('Supports 9 schemes: HCC, SBL, SLB, ALAT, IT, ITS, FWT, OJT and SGM.');
    expect(text).not.toContain('Supports SBL, HCC, and SLB schemes');
    expect(text).not.toContain('All schemes unlocked');
    expect(text).not.toContain('Many more schemes');
    expect(text).toContain('TNA (Training Needs Analysis) tools');
});

test('Admin link stays under the website sub-path', () => {
    expect(adminHref('/product/calculator/desktop/')).toBe('/product/calculator/desktop/admin');
    expect(adminHref('/product/calculator/desktop')).toBe('/product/calculator/desktop/admin');
    expect(adminHref('/')).toBe('/admin');
    expect(adminHref('/hrd-calculator')).toBe('/admin');
});

describe('My Plans PDF meta', () => {
    test('HCC/SBL/SLB plans: real training type, total pax from host + branches + subsidiaries, names', () => {
        const plan = {
            name: 'Q1 plan', schemeId: 'hcc', schemeLabel: 'HCC — Training Course',
            inputs: { trainingType: 'rot_public', trainingProgrammeName: 'Lean', host: { pax: '5' }, branches: [{ pax: 2 }, { pax: '3' }], subsidiaries: [{ pax: 4 }] },
        };
        expect(planExportMeta(plan)).toEqual({ scheme: 'hcc', trainingType: 'rot_public', totalPax: 14, trainingProgrammeName: 'Lean', planName: 'Q1 plan' });
    });

    test('other schemes: no participant count, scheme label as the type', () => {
        const meta = planExportMeta({ name: 'Room', schemeId: 'alat', schemeLabel: 'ALAT — Training Facilities & Renovation', inputs: { levyBalance: '' } });
        expect(meta.totalPax).toBeUndefined();
        expect(meta.trainingType).toBe('ALAT — Training Facilities & Renovation');
        expect(meta.planName).toBe('Room');
    });
});

test('History shows pax only for training-course entries', async () => {
    const base = { totalClaimable: 100, items: [], warnings: [], timestamp: '2026-10-01T00:00:00Z' };
    localStorage.setItem('hrd_calc_history', JSON.stringify([
        { ...base, id: '1', scheme: 'alat', trainingType: 'ALAT', totalPax: null },
        { ...base, id: '2', scheme: 'its', trainingType: 'ITS', totalPax: 0 },
        { ...base, id: '3', scheme: 'hcc', trainingType: 'inhouse', totalPax: 12 },
    ]));
    await renderTab('History');
    expect(container.textContent).toContain('12 pax');
    expect(container.textContent).not.toContain('0 pax');
    expect(container.textContent).not.toContain('null pax');
    expect(historyPax({ scheme: 'sgm', totalPax: 0 })).toBeNull();
    expect(historyPax({ scheme: 'slb', totalPax: 0 })).toBe(0);
});

test('the footer allowance refreshes after an upload', async () => {
    localStorage.setItem('hrd_activation_code', 'HRD-AAAA-BBBB-CCCC');
    const ai = { enabled: true, limit: 50, used: 3, remaining: 47 };
    global.fetch = jest.fn(() => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ success: true, data: { ai } }) }));
    await act(async () => {
        root.render(<ACMDataProvider><SavedPlansProvider><HRDCalculatorPage /></SavedPlansProvider></ACMDataProvider>);
    });
    expect(container.textContent).toContain('47 of 50 uploads left this month');
    await act(async () => {
        window.dispatchEvent(new CustomEvent('tge-ai-allowance-changed', { detail: { ...ai, used: 4, remaining: 46 } }));
    });
    expect(container.textContent).toContain('46 of 50 uploads left this month');
});
