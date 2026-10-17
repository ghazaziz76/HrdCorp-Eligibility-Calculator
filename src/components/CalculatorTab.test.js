import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import CalculatorTab from './CalculatorTab';
import { SavedPlansProvider } from '../contexts/SavedPlansContext';

global.IS_REACT_ACT_ENVIRONMENT = true;

let container, root;
beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    global.fetch = jest.fn(() => Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) }));
});
afterEach(() => {
    act(() => root.unmount());
    container.remove();
    delete global.fetch;
    localStorage.clear();
});

const chip = (text) => [...container.querySelectorAll('button')].find(b => b.textContent === text);

test('clicking the scheme chip that is already selected keeps the form as it is', async () => {
    await act(async () => { root.render(<SavedPlansProvider><CalculatorTab /></SavedPlansProvider>); });
    const hcc = [...container.querySelectorAll('div')].find(d => d.textContent === 'HRD Corp Claimable Courses (HCC)');
    await act(async () => { hcc.click(); });
    const name = container.querySelector('#training-prog-name');
    await act(async () => {
        Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(name, 'Lean');
        name.dispatchEvent(new Event('input', { bubbles: true }));
    });

    await act(async () => { chip('Training Course Schemes (HCC / SBL / SLB)').click(); });
    expect(container.querySelector('#training-prog-name').value).toBe('Lean');

    // Switching to another family and back starts afresh.
    await act(async () => { chip('ALAT').click(); });
    await act(async () => { chip('Training Course Schemes (HCC / SBL / SLB)').click(); });
    expect(container.querySelector('#training-prog-name')).toBeNull();
});
