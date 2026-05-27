import React, { useState } from 'react';
import { calculateIt } from './calculateIt';
import CostList from '../shared/CostList';
import PurchaseResult from '../shared/PurchaseResult';
import { iStyle, lStyle, rStyle, primaryBtn } from '../shared/styles';

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

      <div style={{ background: '#f9fafb', borderRadius: '10px', padding: '24px', marginBottom: '20px' }}>
        <CostList title="Computers / Laptops" rows={computers} onChange={setComputers}
          fields={[{ key: 'description', label: 'Description', type: 'text' }, { key: 'qty', label: 'Qty', type: 'number' }, { key: 'unitCost', label: 'Unit Cost (RM)', type: 'number' }]}
          addLabel="+ Add Computer Line" />
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
