import React, { useState, useEffect } from 'react';
import { HRDCorpCostCalculator } from './HRDCorpCostCalculator';
import AlatForm from '../schemes/alat/AlatForm';
import ItForm from '../schemes/it/ItForm';
import ItsForm from '../schemes/its/ItsForm';
import FwtForm from '../schemes/fwt/FwtForm';
import SgmForm from '../schemes/sgm/SgmForm';
import OjtForm from '../schemes/ojt/OjtForm';
import { useSavedPlans } from '../contexts/SavedPlansContext';

const FAMILIES = [
  { id: 'training', label: 'Training Course Schemes (HCC / SBL / SLB)' },
  { id: 'alat', label: 'ALAT' },
  { id: 'it', label: 'IT' },
  { id: 'its', label: 'ITS' },
  { id: 'fwt', label: 'FWT' },
  { id: 'ojt', label: 'OJT' },
  { id: 'sgm', label: 'SGM' },
];

const TRAINING_SCHEMES = new Set(['hcc', 'sbl', 'slb']);
const familyOf = (schemeId) => TRAINING_SCHEMES.has(schemeId) ? 'training' : schemeId;

export default function CalculatorTab() {
  const [family, setFamily] = useState('training');
  const [initialPlan, setInitialPlan] = useState(null);
  const { pendingOpen, consumeOpen } = useSavedPlans();

  // When My Plans hands us a plan, switch family and pass it to the right form.
  useEffect(() => {
    if (pendingOpen) {
      const target = familyOf(pendingOpen.schemeId);
      setFamily(target);
      setInitialPlan(pendingOpen);
      consumeOpen();
    }
  }, [pendingOpen, consumeOpen]);

  // Switching family manually clears the pre-loaded plan.
  const pickFamily = (id) => {
    setFamily(id);
    setInitialPlan(null);
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
        {FAMILIES.map(f => (
          <button key={f.id} onClick={() => pickFamily(f.id)}
            style={{
              padding: '8px 16px', borderRadius: '20px', cursor: 'pointer', fontSize: '13px', fontWeight: family === f.id ? '700' : '500',
              border: family === f.id ? '2px solid #2e7d32' : '1px solid #ccc',
              background: family === f.id ? '#e8f5e9' : '#fff', color: family === f.id ? '#1b5e20' : '#666',
            }}>
            {f.label}
          </button>
        ))}
      </div>
      {family === 'training' && <HRDCorpCostCalculator initialPlan={initialPlan} />}
      {family === 'alat' && <AlatForm initialPlan={initialPlan} />}
      {family === 'it' && <ItForm initialPlan={initialPlan} />}
      {family === 'its' && <ItsForm initialPlan={initialPlan} />}
      {family === 'fwt' && <FwtForm initialPlan={initialPlan} />}
      {family === 'ojt' && <OjtForm initialPlan={initialPlan} />}
      {family === 'sgm' && <SgmForm initialPlan={initialPlan} />}
    </div>
  );
}
