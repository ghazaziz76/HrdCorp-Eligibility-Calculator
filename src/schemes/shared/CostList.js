import React from 'react';
import { iStyle, lStyle, cardStyle } from './styles';

// rows: array of objects.
// fields: [{ key, label, type: 'text'|'number'|'select', options?, otherValue?, otherKey?, otherLabel? }]
// For a select field, set otherValue (e.g. 'Other') + otherKey to reveal a
// free-text input (stored under otherKey) whenever that option is selected.
export default function CostList({ title, rows, onChange, fields, addLabel, accent = '#2e7d32' }) {
  const blank = () => fields.reduce((o, f) => {
    o[f.key] = f.type === 'number' ? '' : (f.type === 'select' ? (f.options[0] || '') : '');
    if (f.otherKey) o[f.otherKey] = '';
    return o;
  }, {});
  const add = () => onChange([...rows, blank()]);
  const remove = (i) => onChange(rows.filter((_, idx) => idx !== i));
  const update = (i, key, val) => onChange(rows.map((r, idx) => idx === i ? { ...r, [key]: val } : r));

  return (
    <div style={{ marginBottom: '20px' }}>
      <p style={{ fontSize: '13px', fontWeight: '700', color: accent, margin: '0 0 8px' }}>{title}</p>
      {rows.map((row, i) => {
        const otherField = fields.find(f => f.otherKey && row[f.key] === f.otherValue);
        return (
          <div key={i} style={cardStyle}>
            <div style={{ display: 'grid', gridTemplateColumns: fields.map(() => '1fr').join(' ') + ' auto', gap: '10px', alignItems: 'end' }}>
              {fields.map(f => (
                <div key={f.key}>
                  <label style={lStyle}>{f.label}</label>
                  {f.type === 'select' ? (
                    <select style={iStyle} value={row[f.key]} onChange={e => update(i, f.key, e.target.value)}>
                      {f.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  ) : (
                    <input type={f.type} min={f.type === 'number' ? '0' : undefined} style={iStyle}
                      value={row[f.key]} onChange={e => update(i, f.key, e.target.value)} />
                  )}
                </div>
              ))}
              <button onClick={() => remove(i)} style={{ background: 'none', border: '1px solid #e57373', color: '#e57373', padding: '8px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>Remove</button>
            </div>
            {otherField && (
              <div style={{ marginTop: '10px' }}>
                <label style={lStyle}>{otherField.otherLabel || 'Please specify'}</label>
                <input type="text" style={iStyle} value={row[otherField.otherKey] || ''}
                  placeholder="Type the equipment name"
                  onChange={e => update(i, otherField.otherKey, e.target.value)} />
              </div>
            )}
          </div>
        );
      })}
      <button onClick={add} style={{ background: accent, color: '#fff', border: 'none', padding: '7px 18px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>{addLabel}</button>
    </div>
  );
}
