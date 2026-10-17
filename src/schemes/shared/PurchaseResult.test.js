import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import PurchaseResult from './PurchaseResult';
import AlatForm from '../alat/AlatForm';

global.IS_REACT_ACT_ENVIRONMENT = true;

const result = (total) => ({ items: [{ label: 'Equipment', amount: total, note: '' }], totalClaimable: total, warnings: [], supportingDocs: { grantSubmission: [], claimSubmission: [] } });
const history = () => JSON.parse(localStorage.getItem('hrd_calc_history') || '[]');

let container, root;
beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    localStorage.clear();
});
afterEach(() => {
    act(() => root.unmount());
    container.remove();
    localStorage.clear();
});

test('a result seeded from a saved plan is not logged to History; a new calculation is', async () => {
    const seeded = result(500);
    await act(async () => { root.render(<PurchaseResult schemeId="alat" schemeLabel="ALAT" result={seeded} fromPlanId="p1" />); });
    expect(history()).toHaveLength(0);

    await act(async () => { root.render(<PurchaseResult schemeId="alat" schemeLabel="ALAT" result={seeded} fromPlanId="p1" />); });
    expect(history()).toHaveLength(0);

    await act(async () => { root.render(<PurchaseResult schemeId="alat" schemeLabel="ALAT" result={result(800)} fromPlanId="p1" />); });
    expect(history()).toHaveLength(1);
    expect(history()[0]).toMatchObject({ scheme: 'alat', totalClaimable: 800 });
});

test('opening a saved ALAT plan adds nothing to History; pressing Calculate adds one entry', async () => {
    const plan = { id: 'p1', name: 'Room', schemeId: 'alat', inputs: { levyBalance: '', equipment: [{ item: 'Laptop', customItem: '', cost: '3000' }], renovation: [] }, resultSnapshot: result(1500) };
    await act(async () => { root.render(<AlatForm initialPlan={plan} />); });
    expect(container.textContent).toContain('Eligibility Breakdown');
    expect(history()).toHaveLength(0);

    const calc = [...container.querySelectorAll('button')].find(b => b.textContent === 'Calculate Eligibility');
    await act(async () => { calc.click(); });
    expect(history()).toHaveLength(1);
    expect(history()[0]).toMatchObject({ scheme: 'alat', trainingType: 'ALAT — Training Facilities & Renovation' });
});
