import React, { useState } from 'react';
import { calculateCbt } from './calculateCbt';
import CostList from '../shared/CostList';
import PurchaseResult from '../shared/PurchaseResult';
import { primaryBtn } from '../shared/styles';

const ROW = [{ key: 'description', label: 'Description', type: 'text' }, { key: 'cost', label: 'Cost (RM)', type: 'number' }];

export default function CbtForm() {
  const [softwarePurchase, setSoftwarePurchase] = useState([]);
  const [softwareDevelopment, setSoftwareDevelopment] = useState([]);
  const [lmsSubscription, setLmsSubscription] = useState([]);
  const [elearningSubscription, setElearningSubscription] = useState([]);
  const [result, setResult] = useState(null);

  const calculate = () => setResult(calculateCbt({ softwarePurchase, softwareDevelopment, lmsSubscription, elearningSubscription }));

  return (
    <div style={{ padding: '24px', maxWidth: '960px', margin: '0 auto' }}>
      <h2 style={{ color: '#2e7d32', marginBottom: '6px' }}>CBT — Computer-Based Training</h2>
      <p style={{ color: '#777', fontSize: '13px', marginBottom: '24px' }}>Training software / LMS purchase, development or subscription. Claimable as charged, subject to your levy balance.</p>

      <div style={{ background: '#f9fafb', borderRadius: '10px', padding: '24px', marginBottom: '20px' }}>
        <CostList title="Software Purchase" rows={softwarePurchase} onChange={setSoftwarePurchase} fields={ROW} addLabel="+ Add Software" />
        <CostList title="Software / LMS Development" rows={softwareDevelopment} onChange={setSoftwareDevelopment} accent="#6a1b9a" fields={ROW} addLabel="+ Add Development Item" />
        <CostList title="LMS Subscription" rows={lmsSubscription} onChange={setLmsSubscription} accent="#1565c0" fields={ROW} addLabel="+ Add LMS Subscription" />
        <CostList title="E-Learning Content Subscription" rows={elearningSubscription} onChange={setElearningSubscription} accent="#e65100" fields={ROW} addLabel="+ Add E-Learning Subscription" />
      </div>

      <button onClick={calculate} style={primaryBtn}>Calculate Eligibility</button>
      <PurchaseResult schemeId="cbt" schemeLabel="CBT — Computer-Based Training" result={result} />
    </div>
  );
}
