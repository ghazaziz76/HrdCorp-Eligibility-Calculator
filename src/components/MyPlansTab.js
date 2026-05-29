import React, { useState } from 'react';
import { loadPlans, deletePlan, renamePlan, duplicatePlan, storageUsageRatio } from '../utils/savedPlans';
import { useSavedPlans } from '../contexts/SavedPlansContext';
import { exportResultPDF } from '../utils/pdfExportWeb';

const VALID_SCHEMES = new Set(['hcc', 'sbl', 'slb', 'alat', 'it', 'its', 'fwt', 'ojt', 'sgm']);

const SCHEME_COLOR = {
  hcc: '#1565c0', sbl: '#2e7d32', slb: '#6a1b9a',
  alat: '#00838f', it: '#0277bd', its: '#558b2f',
  fwt: '#ad1457', ojt: '#e65100', sgm: '#4527a0',
};

export default function MyPlansTab({ onSwitchToCalculator }) {
  const [plans, setPlans] = useState(loadPlans());
  const [expanded, setExpanded] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [renamingId, setRenamingId] = useState(null);
  const [renameText, setRenameText] = useState('');
  const { requestOpen } = useSavedPlans();

  const refresh = () => setPlans(loadPlans());

  const toggleSelect = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleOpen = (plan) => {
    requestOpen(plan);
    if (onSwitchToCalculator) onSwitchToCalculator();
  };

  const handleDelete = (id) => {
    if (!window.confirm('Delete this plan?')) return;
    deletePlan(id);
    setSelected(prev => { const n = new Set(prev); n.delete(id); return n; });
    refresh();
  };

  const handleDuplicate = (id) => { duplicatePlan(id); refresh(); };

  const startRename = (plan) => { setRenamingId(plan.id); setRenameText(plan.name); };
  const commitRename = (id) => {
    const t = renameText.trim();
    if (t) renamePlan(id, t);
    setRenamingId(null); refresh();
  };

  const handleExport = (plan) => {
    exportResultPDF(plan.resultSnapshot || { items: [], totalClaimable: 0, warnings: [], supportingDocs: { grantSubmission: [] } },
      { scheme: plan.schemeId, trainingType: plan.schemeLabel, totalPax: 0 });
  };

  const usage = storageUsageRatio();

  if (plans.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px' }}>
        <p style={{ fontSize: 16, color: '#999' }}>You haven't saved any plans yet.</p>
        <p style={{ fontSize: 13, color: '#bbb' }}>Calculate a scheme, then tap "💾 Save as Plan" on the result to keep it here.</p>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ margin: 0, color: '#1b5e20' }}>My Plans</h3>
        <button disabled={selected.size < 2}
          style={{
            background: selected.size >= 2 ? '#1565c0' : '#eee',
            color: selected.size >= 2 ? '#fff' : '#999',
            border: 'none', borderRadius: 6, padding: '8px 16px',
            fontSize: 13, fontWeight: 700, cursor: selected.size >= 2 ? 'pointer' : 'not-allowed',
          }}>
          Compare ({selected.size})
        </button>
      </div>

      {usage > 0.9 && (
        <div style={{ background: '#fff3e0', border: '1px solid #ffcc80', color: '#e65100', borderRadius: 6, padding: '10px 14px', marginBottom: 12, fontSize: 12 }}>
          ⚠ Storage almost full — delete old plans to make room.
        </div>
      )}

      {plans.map(plan => {
        const isExpanded = expanded === plan.id;
        const isValidScheme = VALID_SCHEMES.has(plan.schemeId);
        const color = SCHEME_COLOR[plan.schemeId] || '#666';
        return (
          <div key={plan.id}
            style={{ background: '#fff', borderRadius: 10, padding: 14, marginBottom: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <input type="checkbox" checked={selected.has(plan.id)} onChange={() => toggleSelect(plan.id)}
                style={{ width: 18, height: 18, cursor: 'pointer' }} />
              <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => setExpanded(isExpanded ? null : plan.id)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ padding: '2px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700, background: color + '22', color }}>
                    {plan.schemeId.toUpperCase()}
                  </span>
                  {renamingId === plan.id ? (
                    <input type="text" value={renameText} autoFocus
                      onChange={e => setRenameText(e.target.value)}
                      onBlur={() => commitRename(plan.id)}
                      onKeyDown={e => { if (e.key === 'Enter') commitRename(plan.id); }}
                      onClick={e => e.stopPropagation()}
                      style={{ fontSize: 14, fontWeight: 700, padding: '2px 6px', border: '1px solid #ccc', borderRadius: 4 }} />
                  ) : (
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#333' }}>{plan.name}</span>
                  )}
                </div>
                <span style={{ fontSize: 11, color: '#999' }}>
                  Saved {new Date(plan.savedAt).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#1b5e20' }}>
                  RM {Number(plan.resultSnapshot?.totalClaimable || 0).toLocaleString()}
                </div>
                <span style={{ fontSize: 12, color: '#bbb' }}>{isExpanded ? '▲' : '▼'}</span>
              </div>
            </div>

            {isExpanded && (
              <div style={{ marginTop: 12, borderTop: '1px solid #f0f0f0', paddingTop: 12 }}>
                {(plan.resultSnapshot?.items || []).map((row, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
                    <span style={{ fontSize: 12, color: '#555' }}>{row.label}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#1b5e20' }}>
                      {row.amount != null ? `RM ${Number(row.amount).toLocaleString()}` : '—'}
                    </span>
                  </div>
                ))}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12, justifyContent: 'flex-end' }}>
                  <button onClick={() => handleOpen(plan)} disabled={!isValidScheme}
                    title={isValidScheme ? '' : 'This scheme is no longer available.'}
                    style={{ ...actionBtn, background: isValidScheme ? '#2e7d32' : '#bdbdbd', color: '#fff', cursor: isValidScheme ? 'pointer' : 'not-allowed' }}>
                    Open
                  </button>
                  <button onClick={() => startRename(plan)} style={{ ...actionBtn, background: '#fff', color: '#555', border: '1px solid #ccc' }}>Rename</button>
                  <button onClick={() => handleDuplicate(plan.id)} style={{ ...actionBtn, background: '#fff', color: '#555', border: '1px solid #ccc' }}>Duplicate</button>
                  <button onClick={() => handleExport(plan)} style={{ ...actionBtn, background: '#1565c0', color: '#fff' }}>Export PDF</button>
                  <button onClick={() => handleDelete(plan.id)} style={{ ...actionBtn, background: '#fff', color: '#e53935', border: '1px solid #e57373' }}>Delete</button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

const actionBtn = { borderRadius: 6, padding: '6px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer' };
