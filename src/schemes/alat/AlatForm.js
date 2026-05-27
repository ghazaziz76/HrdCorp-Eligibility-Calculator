import React, { useState } from 'react';
import { calculateAlat } from './calculateAlat';
import CostList from '../shared/CostList';
import PurchaseResult from '../shared/PurchaseResult';
import { iStyle, lStyle, rStyle, primaryBtn } from '../shared/styles';

const RENO_TYPES = [
  'Overhead projector wiring setup',
  'Wall painting',
  'Air conditioner setup',
  'Carpet, blinds & glass wall installation',
  'Ceiling renovation',
  'Electrical outlet wiring',
  'Network & internet connection installation',
  'Installation (bundled with equipment, same grant)',
];

export default function AlatForm() {
  const [levyBalance, setLevyBalance] = useState('');
  const [equipment, setEquipment] = useState([{ description: '', cost: '' }]);
  const [renovation, setRenovation] = useState([]);
  const [result, setResult] = useState(null);

  const calculate = () => setResult(calculateAlat({ levyBalance, equipment, renovation }));

  return (
    <div style={{ padding: '24px', maxWidth: '960px', margin: '0 auto' }}>
      <h2 style={{ color: '#2e7d32', marginBottom: '6px' }}>ALAT — Training Facilities & Renovation</h2>
      <p style={{ color: '#777', fontSize: '13px', marginBottom: '24px' }}>Purchase training equipment and set up / renovate a training room. Eligibility capped at 50% of your levy balance.</p>

      <div style={{ background: '#f9fafb', borderRadius: '10px', padding: '24px', marginBottom: '20px' }}>
        <div style={{ ...rStyle, maxWidth: '380px' }}>
          <label style={lStyle}>Levy Balance as of 1 January (RM)</label>
          <input type="number" min="0" style={iStyle} value={levyBalance} onChange={e => setLevyBalance(e.target.value)} placeholder="e.g. 100000" />
        </div>
        <CostList title="Training Equipment" rows={equipment} onChange={setEquipment}
          fields={[{ key: 'description', label: 'Description', type: 'text' }, { key: 'cost', label: 'Cost (RM)', type: 'number' }]}
          addLabel="+ Add Equipment" />
        <CostList title="Room Setup / Renovation" rows={renovation} onChange={setRenovation} accent="#e65100"
          fields={[{ key: 'type', label: 'Type', type: 'select', options: RENO_TYPES }, { key: 'cost', label: 'Cost (RM)', type: 'number' }]}
          addLabel="+ Add Renovation Item" />
      </div>

      <button onClick={calculate} style={primaryBtn}>Calculate Eligibility</button>
      <PurchaseResult schemeId="alat" schemeLabel="ALAT — Facilities & Renovation" result={result} />
    </div>
  );
}
