import React, { useState } from 'react';
import { calculateSgm } from './calculateSgm';
import PurchaseResult from '../shared/PurchaseResult';
import { iStyle, lStyle, rStyle, primaryBtn } from '../shared/styles';

// SGM scheme rules (ACM Guide Jan 2026, section L).
const SGM_NOTES = [
  'SGM lets registered employers use 50% of their levy to train and develop graduates through structured workplace training, capped at 50% of the levy balance as of 1 January of the application year.',
  'Open to Malaysian graduates who: completed all higher academic requirements (incl. SKM Level 4 and above); are seeking a full-time job (permanent or fixed-term of at least 12 months); and have no prior full-time work experience in the formal sector.',
  'The programme duration is 12 months. The claimable cost is the Graduate Skills Development Allowance — 12 months of basic salary as paid by the employer. No other allowances are claimable.',
  'The grant application must be submitted within 6 months of the programme completion date.',
  'Employers must have no legal issues with HRD Corp to apply for financial assistance.',
];

export default function SgmForm() {
  const [levyBalance, setLevyBalance] = useState('');
  const [numberOfGraduates, setNumberOfGraduates] = useState('');
  const [monthlySalary, setMonthlySalary] = useState('');
  const [result, setResult] = useState(null);

  const calculate = () => setResult(calculateSgm({ levyBalance, numberOfGraduates, monthlySalary }));

  return (
    <div style={{ padding: '24px', maxWidth: '960px', margin: '0 auto' }}>
      <h2 style={{ color: '#2e7d32', marginBottom: '6px' }}>SGM — Skim Graduan Madani</h2>
      <p style={{ color: '#777', fontSize: '13px', marginBottom: '24px' }}>12-month structured workplace training for graduates. Claimable = 12 months of basic salary, capped at 50% of levy balance.</p>

      <div style={{ background: '#fff8e1', border: '1px solid #ffe082', borderRadius: '8px', padding: '14px 18px', marginBottom: '20px' }}>
        <p style={{ fontWeight: '700', fontSize: '12px', color: '#e65100', margin: '0 0 8px' }}>SGM — Rules &amp; Conditions</p>
        <ul style={{ margin: 0, padding: '0 0 0 18px' }}>
          {SGM_NOTES.map((n, i) => <li key={i} style={{ fontSize: '12px', color: '#555', marginBottom: '5px', lineHeight: '1.6' }}>{n}</li>)}
        </ul>
      </div>

      <div style={{ background: '#f9fafb', borderRadius: '10px', padding: '24px', marginBottom: '20px' }}>
        <div style={{ ...rStyle, maxWidth: '380px' }}>
          <label style={lStyle}>Levy Balance (ball-park figure, RM) — optional</label>
          <input type="number" min="0" style={iStyle} value={levyBalance} onChange={e => setLevyBalance(e.target.value)} placeholder="A rough estimate is fine" />
          <p style={{ fontSize: '11px', color: '#888', margin: '4px 0 0' }}>Only used to estimate how much you can apply for (SGM is capped at 50% of your levy balance). Leave blank to skip.</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', maxWidth: '640px' }}>
          <div style={rStyle}>
            <label style={lStyle}>Number of Graduates</label>
            <input type="number" min="0" style={iStyle} value={numberOfGraduates} onChange={e => setNumberOfGraduates(e.target.value)} />
          </div>
          <div style={rStyle}>
            <label style={lStyle}>Monthly Basic Salary per Graduate (RM)</label>
            <input type="number" min="0" style={iStyle} value={monthlySalary} onChange={e => setMonthlySalary(e.target.value)} />
            <p style={{ fontSize: '11px', color: '#888', margin: '4px 0 0' }}>Claimed over the fixed 12-month programme.</p>
          </div>
        </div>
      </div>

      <button onClick={calculate} style={primaryBtn}>Calculate Eligibility</button>
      <PurchaseResult schemeId="sgm" schemeLabel="SGM — Skim Graduan Madani" result={result} />
    </div>
  );
}
