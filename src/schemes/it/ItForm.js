import React, { useState } from 'react';
import { calculateIt } from './calculateIt';
import CostList from '../shared/CostList';
import PurchaseResult from '../shared/PurchaseResult';
import { iStyle, lStyle, rStyle, primaryBtn } from '../shared/styles';

// IT scheme rules (ACM Guide Jan 2026, section E).
const IT_NOTES = [
  'IT is a scheme to encourage employers to further retrain their employees in information technology. Financial assistance is provided to purchase desktop computers or laptops.',
  'The maximum amount of financial assistance is RM25,000 for the purchase of desktop computers for training purposes.',
  'Applications can be made once every three years, from the date of the first or previous application. Multiple applications within the three-year period are not allowed, even if the RM25,000 maximum was not fully utilised. Branch-office applications may be submitted before HQ applications are submitted and approved (not necessarily three years after purchase by HQ).',
  'Applicant must be an HRD Corp Registered Employer and an active employer.',
  'Employers must have no legal issues with HRD Corp to apply for financial assistance.',
  'Employers must have a fixed computer training room. SMEs may obtain financial assistance to purchase desktop computers or laptops for training even without a proper computer lab.',
  'Purchase of computers or laptops must be made within 6 months from the grant approval date, and only after the grant has been approved. Purchases made prior to approval are not claimable.',
  'Claims shall be made after the purchase of computers or laptops.',
  'Grant approval is based on the quotation, while reimbursement is subject to the actual cost as per receipt.',
  'Webcam and internet connection subscription (first year only) are required as part of the equipment to support online learning. Internet subscription submission can be made monthly or as a one-off yearly basis.',
];

export default function ItForm() {
  const [computers, setComputers] = useState([{ description: '', qty: '', unitCost: '' }]);
  const [webcam, setWebcam] = useState('');
  const [internetSubscription, setInternetSubscription] = useState('');
  const [lastApplicationDate, setLastApplicationDate] = useState('');
  const [result, setResult] = useState(null);

  const calculate = () => setResult(calculateIt({ computers, webcam, internetSubscription, lastApplicationDate }));

  return (
    <div style={{ padding: '24px', maxWidth: '960px', margin: '0 auto' }}>
      <h2 style={{ color: '#2e7d32', marginBottom: '6px' }}>IT — Information Technology & Computer-Aided Training</h2>
      <p style={{ color: '#777', fontSize: '13px', marginBottom: '24px' }}>Purchase desktops / laptops for a computer training room. Maximum RM25,000, once every 3 years.</p>

      <div style={{ background: '#fff8e1', border: '1px solid #ffe082', borderRadius: '8px', padding: '14px 18px', marginBottom: '20px' }}>
        <p style={{ fontWeight: '700', fontSize: '12px', color: '#e65100', margin: '0 0 8px' }}>IT Scheme — Rules &amp; Conditions</p>
        <ul style={{ margin: 0, padding: '0 0 0 18px' }}>
          {IT_NOTES.map((n, i) => (
            <li key={i} style={{ fontSize: '12px', color: '#555', marginBottom: '5px', lineHeight: '1.6' }}>{n}</li>
          ))}
        </ul>
      </div>

      <div style={{ background: '#f9fafb', borderRadius: '10px', padding: '24px', marginBottom: '20px' }}>
        <CostList title="Computers / Laptops" rows={computers} onChange={setComputers}
          fields={[{ key: 'description', label: 'Description', type: 'text' }, { key: 'qty', label: 'Qty', type: 'number' }, { key: 'unitCost', label: 'Unit Cost (RM)', type: 'number' }]}
          addLabel="+ Add Webcam/Internet" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginTop: '8px' }}>
          <div style={rStyle}>
            <label style={lStyle}>Webcam (RM, optional)</label>
            <input type="number" min="0" style={iStyle} value={webcam} onChange={e => setWebcam(e.target.value)} />
          </div>
          <div style={rStyle}>
            <label style={lStyle}>Internet Subscription — 1st year (RM, optional)</label>
            <input type="number" min="0" style={iStyle} value={internetSubscription} onChange={e => setInternetSubscription(e.target.value)} />
          </div>
          <div style={rStyle}>
            <label style={lStyle}>Last IT Application Date (optional)</label>
            <input type="date" style={iStyle} value={lastApplicationDate} onChange={e => setLastApplicationDate(e.target.value)} />
          </div>
        </div>
      </div>

      <button onClick={calculate} style={primaryBtn}>Calculate Eligibility</button>
      <PurchaseResult schemeId="it" schemeLabel="IT — Computer-Aided Training" result={result} />
    </div>
  );
}
