// Presentational. Renders nothing when suggestions[] is empty.
// Props:
//   suggestions: Suggestion[]   (from utils/suggestImprovements)
//   onApply:     (patch) => void   (called with the suggestion's applyPatch)
//   dirty:       boolean         (true → show 'tap Calculate' notice)
import React from 'react';

const ICONS = { blocker: '⚠', optimization: '💡' };
const ICON_COLORS = { blocker: '#e53935', optimization: '#1565c0' };

export default function SuggestionsPanel({ suggestions, onApply, dirty }) {
  if (!suggestions || suggestions.length === 0) return null;
  return (
    <div style={s.card}>
      <p style={s.header}>💡 Suggestions to improve your claim</p>
      {dirty && (
        <p style={s.dirty}>
          Inputs updated. Tap <strong>🧮 Calculate Eligibility</strong> to refresh the result.
        </p>
      )}
      {suggestions.map((sug, i) => {
        const hasPatch = sug.applyPatch && Object.keys(sug.applyPatch).length > 0;
        return (
          <div key={sug.id} style={{ ...s.row, ...(i < suggestions.length - 1 ? s.rowBorder : null) }}>
            <span style={{ ...s.icon, color: ICON_COLORS[sug.severity] || '#666' }}>
              {ICONS[sug.severity] || '•'}
            </span>
            <p style={s.message}>{sug.message}</p>
            {hasPatch && (
              <button onClick={() => onApply(sug.applyPatch)} style={s.applyBtn}>Apply</button>
            )}
          </div>
        );
      })}
    </div>
  );
}

const s = {
  card: { background: '#fffde7', border: '1px solid #ffe082', borderRadius: 8, padding: 14, marginBottom: 16 },
  header: { fontWeight: 700, color: '#e65100', fontSize: 13, margin: '0 0 8px' },
  dirty: { fontStyle: 'italic', color: '#37474f', fontSize: 12, margin: '0 0 10px' },
  row: { display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 0' },
  rowBorder: { borderBottom: '1px solid #f0e0a0' },
  icon: { fontSize: 16, flexShrink: 0, marginTop: 2 },
  message: { flex: 1, fontSize: 13, color: '#333', margin: 0, lineHeight: 1.55 },
  applyBtn: { background: '#2e7d32', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', flexShrink: 0 },
};
