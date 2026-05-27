import React, { useState } from 'react';
import { calculateAlat } from './calculateAlat';
import CostList from '../shared/CostList';
import PurchaseResult from '../shared/PurchaseResult';
import { primaryBtn } from '../shared/styles';

const EQUIPMENT_TYPES = [
  'LCD / Data Projector',
  'Projector Screen',
  'Interactive Whiteboard / Smart Board',
  'Whiteboard',
  'Flip Chart / Flip Chart Stand',
  'Smart TV / LED Display',
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
  'Other',
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
  const [equipment, setEquipment] = useState([{ item: EQUIPMENT_TYPES[0], customItem: '', cost: '' }]);
  const [renovation, setRenovation] = useState([]);
  const [result, setResult] = useState(null);

  const calculate = () => setResult(calculateAlat({ equipment, renovation }));

  return (
    <div style={{ padding: '24px', maxWidth: '960px', margin: '0 auto' }}>
      <h2 style={{ color: '#2e7d32', marginBottom: '6px' }}>ALAT — Training Facilities & Renovation</h2>
      <p style={{ color: '#777', fontSize: '13px', marginBottom: '24px' }}>Purchase training equipment and set up / renovate a training room. Your approved amount is capped at 50% of your levy balance for the year (shown after you calculate).</p>

      <div style={{ background: '#f9fafb', borderRadius: '10px', padding: '24px', marginBottom: '20px' }}>
        <CostList title="Training Equipment" rows={equipment} onChange={setEquipment}
          fields={[
            { key: 'item', label: 'Equipment', type: 'select', options: EQUIPMENT_TYPES, otherValue: 'Other', otherKey: 'customItem', otherLabel: 'Specify equipment' },
            { key: 'cost', label: 'Cost (RM)', type: 'number' },
          ]}
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
