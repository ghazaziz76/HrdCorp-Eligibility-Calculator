import React, { useState } from 'react';
import { calculateIts } from './calculateIts';
import PurchaseResult from '../shared/PurchaseResult';
import { iStyle, lStyle, rStyle, primaryBtn } from '../shared/styles';
import usePlanSeed from '../shared/usePlanSeed';

// ITS scheme rules (ACM Guide Jan 2026, section G).
const ITS_NOTES = [
  'ITS promotes practical training for apprentices and trainees from universities and colleges at the employer’s premises (work experience before graduation or as part of their programme).',
  'Financial assistance is capped at 50% of the levy balance as of 1 January of the application year.',
  'Minimum duration is 2 months; maximum duration is 12 months.',
  'Claimable costs: monthly allowance as paid by the employer (subject to the 50% cap); one set of PPE per trainee (you may quote more than one unit, but approval is based on the actual quantity only); insurance coverage per premium amount, if any.',
  'Employers must have no legal issues with HRD Corp to apply for financial assistance.',
];

export default function ItsForm({ initialPlan } = {}) {
  const [levyBalance, setLevyBalance] = useState('');
  const [numberOfInterns, setNumberOfInterns] = useState('');
  const [monthlyAllowance, setMonthlyAllowance] = useState('');
  const [months, setMonths] = useState('');
  const [ppePerIntern, setPpePerIntern] = useState('');
  const [insurancePerIntern, setInsurancePerIntern] = useState('');
  const [result, setResult] = useState(initialPlan?.resultSnapshot ?? null);
  usePlanSeed(initialPlan, { levyBalance: setLevyBalance, numberOfInterns: setNumberOfInterns, monthlyAllowance: setMonthlyAllowance, months: setMonths, ppePerIntern: setPpePerIntern, insurancePerIntern: setInsurancePerIntern });

  const calculate = () => setResult(calculateIts({ levyBalance, numberOfInterns, monthlyAllowance, months, ppePerIntern, insurancePerIntern }));

  return (
    <div style={{ padding: '24px', maxWidth: '960px', margin: '0 auto' }}>
      <h2 style={{ color: '#2e7d32', marginBottom: '6px' }}>ITS — Industrial Training Scheme</h2>
      <p style={{ color: '#777', fontSize: '13px', marginBottom: '24px' }}>Practical training for university/college interns at your premises. 2–12 months. Capped at 50% of levy balance.</p>

      <div style={{ background: '#fff8e1', border: '1px solid #ffe082', borderRadius: '8px', padding: '14px 18px', marginBottom: '20px' }}>
        <p style={{ fontWeight: '700', fontSize: '12px', color: '#e65100', margin: '0 0 8px' }}>ITS — Rules &amp; Conditions</p>
        <ul style={{ margin: 0, padding: '0 0 0 18px' }}>
          {ITS_NOTES.map((n, i) => <li key={i} style={{ fontSize: '12px', color: '#555', marginBottom: '5px', lineHeight: '1.6' }}>{n}</li>)}
        </ul>
      </div>

      <div style={{ background: '#f9fafb', borderRadius: '10px', padding: '24px', marginBottom: '20px' }}>
        <div style={{ ...rStyle, maxWidth: '380px' }}>
          <label style={lStyle}>Levy Balance (ball-park figure, RM) — optional</label>
          <input type="number" min="0" style={iStyle} value={levyBalance} onChange={e => setLevyBalance(e.target.value)} placeholder="A rough estimate is fine" />
          <p style={{ fontSize: '11px', color: '#888', margin: '4px 0 0' }}>Only used to estimate how much you can apply for (ITS is capped at 50% of your levy balance). Leave blank to skip.</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
          <div style={rStyle}>
            <label style={lStyle}>Number of Interns</label>
            <input type="number" min="0" style={iStyle} value={numberOfInterns} onChange={e => setNumberOfInterns(e.target.value)} />
          </div>
          <div style={rStyle}>
            <label style={lStyle}>Monthly Allowance per Intern (RM)</label>
            <input type="number" min="0" style={iStyle} value={monthlyAllowance} onChange={e => setMonthlyAllowance(e.target.value)} />
          </div>
          <div style={rStyle}>
            <label style={lStyle}>Duration (months, 2–12)</label>
            <input type="number" min="2" max="12" style={iStyle} value={months} onChange={e => setMonths(e.target.value)} />
          </div>
          <div style={rStyle}>
            <label style={lStyle}>PPE Cost per Intern (RM, optional)</label>
            <input type="number" min="0" style={iStyle} value={ppePerIntern} onChange={e => setPpePerIntern(e.target.value)} />
          </div>
          <div style={rStyle}>
            <label style={lStyle}>Insurance per Intern (RM, optional)</label>
            <input type="number" min="0" style={iStyle} value={insurancePerIntern} onChange={e => setInsurancePerIntern(e.target.value)} />
          </div>
        </div>
      </div>

      <button onClick={calculate} style={primaryBtn}>Calculate Eligibility</button>
      <PurchaseResult schemeId="its" schemeLabel="ITS — Industrial Training Scheme" result={result} inputs={{ levyBalance, numberOfInterns, monthlyAllowance, months, ppePerIntern, insurancePerIntern }} fromPlanId={initialPlan?.id} fromPlanName={initialPlan?.name} />
    </div>
  );
}
