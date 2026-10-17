import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { HRDCorpCostCalculator } from './HRDCorpCostCalculator';

global.IS_REACT_ACT_ENVIRONMENT = true;

let container, root;
beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    global.fetch = jest.fn(() => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ success: false }) }));
});
afterEach(() => {
    act(() => root.unmount());
    container.remove();
    delete global.fetch;
});

function control(text) {
    const label = [...container.querySelectorAll('label')].find(l => l.textContent.trim().startsWith(text));
    return label ? label.parentElement.querySelector('select, input') : null;
}
function setSelect(el, value) {
    Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set.call(el, value);
    el.dispatchEvent(new Event('change', { bubbles: true }));
}
const kmBoxes = () => [...container.querySelectorAll('label')].filter(l => l.textContent.trim().startsWith('Distance to Venue'));

async function renderRot(type) {
    await act(async () => { root.render(<HRDCorpCostCalculator />); });
    const card = [...container.querySelectorAll('div')].find(d => d.textContent === 'HRD Corp Claimable Courses (HCC)');
    await act(async () => { card.click(); });
    await act(async () => { setSelect(control('Type of Training'), type); });
}

test.each(['rot_public', 'rot_inhouse'])('%s asks for the venue with meal / daily allowance labels', async (type) => {
    await renderRot(type);
    const venue = control('Training Venue');
    expect(venue).not.toBeNull();
    const labels = [...venue.options].map(o => o.textContent);
    expect(labels).toEqual(['Own Premises / Own Location (ROT) — meal allowance', 'External Venue / Hotel (ROT) — daily allowance']);
});

test('ROT public at own location: no distance box; at an external venue: distance box shown', async () => {
    await renderRot('rot_public');
    expect(kmBoxes().length).toBe(0);
    expect(container.textContent).toContain('eligible for Meal Allowance');
    await act(async () => { setSelect(control('Training Venue'), 'external_hotel'); });
    expect(kmBoxes().length).toBeGreaterThan(0);
});
