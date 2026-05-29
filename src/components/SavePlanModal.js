import React, { useEffect, useState } from 'react';

const overlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 };
const card = { background: '#fff', borderRadius: 12, width: '100%', maxWidth: 460, padding: 24, boxShadow: '0 12px 40px rgba(0,0,0,0.25)' };
const h = { margin: 0, color: '#1b5e20', fontSize: 18 };
const sub = { margin: '4px 0 18px', color: '#666', fontSize: 13 };
const label = { fontSize: 13, fontWeight: 600, color: '#555', display: 'block', marginBottom: 6 };
const input = { width: '100%', padding: '10px 12px', border: '1px solid #ddd', borderRadius: 6, fontSize: 14, boxSizing: 'border-box' };
const btnRow = { display: 'flex', gap: 8, marginTop: 18, justifyContent: 'flex-end', flexWrap: 'wrap' };
const btn = { padding: '10px 18px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 700 };
const cancelBtn = { ...btn, background: '#eceff1', color: '#37474f' };
const primaryBtn = { ...btn, background: '#2e7d32', color: '#fff' };
const secondaryBtn = { ...btn, background: '#1565c0', color: '#fff' };

const defaultName = (schemeLabel) => {
  const code = (schemeLabel || '').split('—')[0].trim() || 'Plan';
  const today = new Date().toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' });
  return `${code} · ${today}`;
};

export default function SavePlanModal({ open, onClose, onCreate, onUpdate, schemeLabel, fromPlanName, suggestedName }) {
  const [name, setName] = useState('');
  useEffect(() => {
    if (!open) return;
    // Priority: existing-plan rename > caller-supplied suggestion > generic default.
    setName(fromPlanName || suggestedName || defaultName(schemeLabel));
  }, [open, schemeLabel, fromPlanName, suggestedName]);

  if (!open) return null;
  const trimmed = name.trim();
  const canSave = trimmed.length > 0;

  return (
    <div style={overlay} onClick={onClose}>
      <div style={card} onClick={e => e.stopPropagation()}>
        <h3 style={h}>Save as Plan</h3>
        <p style={sub}>Give this calculation a name so you can reopen and edit it later from <strong>My Plans</strong>.</p>
        <label style={label} htmlFor="plan-name">Name your plan</label>
        <input id="plan-name" type="text" style={input} value={name}
          placeholder="e.g. 2026 Q1 Leadership Programme"
          onChange={e => setName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && canSave) onCreate(trimmed); }}
          autoFocus />
        <div style={btnRow}>
          <button style={cancelBtn} onClick={onClose}>Cancel</button>
          {fromPlanName && (
            <button style={secondaryBtn} disabled={!canSave} onClick={() => onUpdate(trimmed)}>
              Update "{fromPlanName}"
            </button>
          )}
          <button style={primaryBtn} disabled={!canSave} onClick={() => onCreate(trimmed)}>
            {fromPlanName ? 'Save as new' : 'Save plan'}
          </button>
        </div>
      </div>
    </div>
  );
}
