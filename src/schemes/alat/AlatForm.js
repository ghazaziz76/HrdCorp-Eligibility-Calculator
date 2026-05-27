import React, { useState } from 'react';
import { calculateAlat } from './calculateAlat';
import CostList from '../shared/CostList';
import PurchaseResult from '../shared/PurchaseResult';
import { iStyle, lStyle, rStyle, primaryBtn } from '../shared/styles';

const EQUIPMENT_TYPES = [
  'LCD / Data Projector',
  'Projector Screen',
  'Interactive Whiteboard / Smart Board',
  'Whiteboard',
  'Flip Chart / Flip Chart Stand',
  'Smart TV / LED Display',
  'Laptop',
  'Tablet',
  'Document Camera / Visualizer',
  'Video Conferencing Camera',
  'PA / Sound System',
  'Wireless Microphone',
  'Audio Mixer / Amplifier',
  'Speakers',
  'Wireless Presenter / Clicker',
  'Wi-Fi Access Point / Router',
  'Network Switch',
  'UPS (Uninterruptible Power Supply)',
  'Laptop Charging Trolley / Cart',
  'Printer / Scanner',
  'Training Tables',
  'Training Chairs',
  'Other',
];

// Equipment eligibility rules (ACM Guide Jan 2026, section D).
const EQUIPMENT_NOTES = [
  'The purchase of training equipment is no longer limited to the previous HRD Corp list. Any non-training-related equipment or items, including software, may not be funded.',
  'The equipment must be used solely for training purposes and be relevant to the employer’s nature of business.',
  'Training equipment must be placed in the training venue.',
  'The equipment and/or renovation of the training room can be done at an industry training location (can be placed outside of the training room).',
  'The location of the equipment should be disclosed when applying for the grant.',
  'Any changes in the equipment’s location — disposal, relocation or loss — must be disclosed to and approved by HRD Corp prior to the changes.',
  'The location and relocation of business premises (HQ and branches) must be declared and updated with HRD Corp prior to the grant application.',
  'Any damage or disposal of training equipment must be reported to HRD Corp.',
  'Employers may purchase laptops or tablets every two years, provided an internal trainer is appointed and a dedicated training room with an LCD projector is available for the trainer to develop training modules.',
];

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
  const [equipment, setEquipment] = useState([{ item: EQUIPMENT_TYPES[0], customItem: '', cost: '' }]);
  const [renovation, setRenovation] = useState([]);
  const [result, setResult] = useState(null);

  const calculate = () => setResult(calculateAlat({ levyBalance, equipment, renovation }));

  return (
    <div style={{ padding: '24px', maxWidth: '960px', margin: '0 auto' }}>
      <h2 style={{ color: '#2e7d32', marginBottom: '6px' }}>ALAT — Training Facilities & Renovation</h2>
      <p style={{ color: '#777', fontSize: '13px', marginBottom: '24px' }}>Purchase training equipment and set up / renovate a training room. Your approved amount is capped at 50% of your levy balance for the year (shown after you calculate).</p>

      <div style={{ background: '#f9fafb', borderRadius: '10px', padding: '24px', marginBottom: '20px' }}>
        <div style={{ ...rStyle, maxWidth: '380px' }}>
          <label style={lStyle}>Levy Balance (ball-park figure, RM) — optional</label>
          <input type="number" min="0" style={iStyle} value={levyBalance} onChange={e => setLevyBalance(e.target.value)} placeholder="A rough estimate is fine" />
          <p style={{ fontSize: '11px', color: '#888', margin: '4px 0 0' }}>
            Only used to estimate how much you can apply for (ALAT is capped at 50% of your levy balance). An approximate figure is fine — leave blank to skip.
          </p>
        </div>
        <CostList title="Training Equipment" rows={equipment} onChange={setEquipment}
          fields={[
            { key: 'item', label: 'Equipment', type: 'select', options: EQUIPMENT_TYPES, otherValue: 'Other', otherKey: 'customItem', otherLabel: 'Specify equipment' },
            { key: 'cost', label: 'Cost (RM)', type: 'number' },
          ]}
          addLabel="+ Add Equipment" />

        <div style={{ background: '#fff8e1', border: '1px solid #ffe082', borderRadius: '8px', padding: '14px 18px', marginBottom: '20px' }}>
          <p style={{ fontWeight: '700', fontSize: '12px', color: '#e65100', margin: '0 0 8px' }}>Training Equipment — Rules &amp; Conditions</p>
          <ul style={{ margin: 0, padding: '0 0 0 18px' }}>
            {EQUIPMENT_NOTES.map((n, i) => (
              <li key={i} style={{ fontSize: '12px', color: '#555', marginBottom: '5px', lineHeight: '1.6' }}>{n}</li>
            ))}
          </ul>
        </div>

        <CostList title="Room Setup / Renovation" rows={renovation} onChange={setRenovation} accent="#e65100"
          fields={[{ key: 'type', label: 'Type', type: 'select', options: RENO_TYPES }, { key: 'cost', label: 'Cost (RM)', type: 'number' }]}
          addLabel="+ Add Renovation Item" />
      </div>

      <button onClick={calculate} style={primaryBtn}>Calculate Eligibility</button>
      <PurchaseResult schemeId="alat" schemeLabel="ALAT — Facilities & Renovation" result={result} />
    </div>
  );
}
