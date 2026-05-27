import React, { useState } from 'react';
import { HRDCorpCostCalculator } from './HRDCorpCostCalculator';
import AlatForm from '../schemes/alat/AlatForm';
import ItForm from '../schemes/it/ItForm';
import ItsForm from '../schemes/its/ItsForm';
import SgmForm from '../schemes/sgm/SgmForm';

const FAMILIES = [
  { id: 'training', label: 'Training Course Schemes (HCC / SBL / SLB)' },
  { id: 'alat', label: 'ALAT' },
  { id: 'it', label: 'IT' },
  { id: 'its', label: 'ITS' },
  { id: 'sgm', label: 'SGM' },
];

export default function CalculatorTab() {
  const [family, setFamily] = useState('training');
  return (
    <div>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
        {FAMILIES.map(f => (
          <button key={f.id} onClick={() => setFamily(f.id)}
            style={{
              padding: '8px 16px', borderRadius: '20px', cursor: 'pointer', fontSize: '13px', fontWeight: family === f.id ? '700' : '500',
              border: family === f.id ? '2px solid #2e7d32' : '1px solid #ccc',
              background: family === f.id ? '#e8f5e9' : '#fff', color: family === f.id ? '#1b5e20' : '#666',
            }}>
            {f.label}
          </button>
        ))}
      </div>
      {family === 'training' && <HRDCorpCostCalculator />}
      {family === 'alat' && <AlatForm />}
      {family === 'it' && <ItForm />}
      {family === 'its' && <ItsForm />}
      {family === 'sgm' && <SgmForm />}
    </div>
  );
}
