import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { HRDCorpCostCalculator } from './HRDCorpCostCalculator';

global.IS_REACT_ACT_ENVIRONMENT = true;

const ai = { enabled: true, limit: 50, used: 3, remaining: 47, resets_on: '2026-11-17', reason: 'ok' };

let container, root;
beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    localStorage.setItem('hrd_activation_code', 'HRD-AAAA-BBBB-CCCC');
});
afterEach(() => {
    act(() => root.unmount());
    container.remove();
    localStorage.clear();
    delete global.fetch;
});

function mockServer(fields) {
    global.fetch = jest.fn((url) => {
        if (String(url).endsWith('/api/employer/ai-brochure')) {
            return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ success: true, data: { fields, ai } }) });
        }
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ success: true, data: { tge: 'activated', ai } }) });
    });
}

// The select / input that follows the label whose text starts with `text`.
function control(text) {
    const label = [...container.querySelectorAll('label')].find(l => l.textContent.trim().startsWith(text));
    if (!label) return null;
    return label.parentElement.querySelector('select, input');
}

async function renderWithScheme() {
    await act(async () => { root.render(<HRDCorpCostCalculator />); });
    const card = [...container.querySelectorAll('div')].find(d => d.textContent === 'HRD Corp Claimable Courses (HCC)');
    await act(async () => { card.click(); });
}

async function upload() {
    const input = container.querySelector('input[type="file"]');
    Object.defineProperty(input, 'files', { configurable: true, value: [new File(['x'], 'b.pdf')] });
    await act(async () => { input.dispatchEvent(new Event('change', { bubbles: true })); });
}

function setValue(el, value) {
    const proto = el.tagName === 'SELECT' ? window.HTMLSelectElement.prototype : window.HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
    el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
}

test('upload box appears only after choosing a scheme, above Training Programme Name', async () => {
    mockServer({});
    await act(async () => { root.render(<HRDCorpCostCalculator />); });
    expect(container.querySelector('input[type="file"]')).toBeNull();
    const card = [...container.querySelectorAll('div')].find(d => d.textContent === 'HRD Corp Claimable Courses (HCC)');
    await act(async () => { card.click(); });
    const fileInput = container.querySelector('input[type="file"]');
    const nameInput = container.querySelector('#training-prog-name');
    expect(fileInput).not.toBeNull();
    expect(fileInput.compareDocumentPosition(nameInput) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});

test('applies fields through setters and clears result', async () => {
    mockServer({ trainingProgrammeName: 'Lean', trainingType: 'inhouse', venue: 'external_hotel', days: 3, duration: 'half_day', actualCourseFee: 1500 });
    await renderWithScheme();

    // Produce a result first, so we can see it being cleared.
    const calc = [...container.querySelectorAll('button')].find(b => b.textContent.includes('Calculate Eligibility'));
    await act(async () => { calc.click(); });
    expect(container.textContent).toContain('Eligibility Breakdown');

    await upload();

    expect(container.querySelector('#training-prog-name').value).toBe('Lean');
    expect(control('Type of Training').value).toBe('inhouse');
    expect(control('Training Venue').value).toBe('external_hotel');
    expect(control('Number of Training Days').value).toBe('3');
    expect(control('Daily Duration').value).toBe('half_day');
    expect(control('Actual Course Fee').value).toBe('1500');
    expect(container.textContent).not.toContain('Eligibility Breakdown');

    // Each filled box carries a 'from brochure' tag.
    const tags = [...container.querySelectorAll('[data-testid="from-brochure"]')];
    expect(tags).toHaveLength(6);

    // Editing a box by hand clears its tag.
    await act(async () => { setValue(control('Number of Training Days'), '4'); });
    expect(container.querySelectorAll('[data-testid="from-brochure"]')).toHaveLength(5);
});

test('venue is not changed for a type without a Venue box', async () => {
    mockServer({ trainingProgrammeName: null, trainingType: 'rot_public', venue: 'external_hotel', days: null, duration: null, actualCourseFee: null });
    await renderWithScheme();
    expect(control('Training Venue').value).toBe('employer_premises');

    await upload();
    expect(control('Type of Training').value).toBe('rot_public');
    expect(control('Training Venue')).toBeNull();

    // Switch back to in-house by hand: the venue is still the old one.
    await act(async () => { setValue(control('Type of Training'), 'inhouse'); });
    expect(control('Training Venue').value).toBe('employer_premises');
});

test('null fields leave boxes untouched', async () => {
    mockServer({ trainingProgrammeName: null, trainingType: null, venue: null, days: 2, duration: null, actualCourseFee: null });
    await renderWithScheme();
    await upload();
    expect(container.querySelector('#training-prog-name').value).toBe('');
    expect(control('Type of Training').value).toBe('inhouse');
    expect(control('Daily Duration').value).toBe('full_day');
    expect(control('Number of Training Days').value).toBe('2');
    expect(container.querySelectorAll('[data-testid="from-brochure"]')).toHaveLength(1);
});
