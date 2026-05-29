import React from 'react';
import { comparePlans } from '../utils/comparePlans';
import { exportComparisonPDF } from '../utils/comparisonPdfExport';

const SCHEME_COLOR = {
  hcc: '#1565c0', sbl: '#2e7d32', slb: '#6a1b9a',
};

export default function ComparisonView({ plans, onBack }) {
  const data = React.useMemo(() => comparePlans(plans), [plans]);
  const { planHeaders, inputRows, itemRows, totals, highestIndex } = data;
  const allIdentical = inputRows.length > 0 && inputRows.every(r => !r.differ);

  const cols = planHeaders.length;
  const colPercent = 70 / Math.max(cols, 1);

  return (
    <div>
      <div style={s.header}>
        <button onClick={onBack} style={s.backBtn}>← Back to plans</button>
        <button onClick={() => exportComparisonPDF(data)} style={s.pdfBtn}>
          📄 Export Comparison as PDF
        </button>
      </div>

      {allIdentical && (
        <div style={s.identicalBanner}>
          All selected plans have identical inputs. The differences are in the computed result.
        </div>
      )}

      {planHeaders.length < 2 && (
        <div style={s.emptyBanner}>Not enough plans to compare.</div>
      )}

      <div style={s.scroll}>
        <div style={{ ...s.grid, gridTemplateColumns: `180px repeat(${cols}, minmax(200px, ${colPercent}%))` }}>
          <div style={s.colLabel} />
          {planHeaders.map(p => (
            <div key={p.id} style={s.colHead} title={p.name}>
              <div style={s.colName}>{p.name}</div>
              <div style={{ ...s.colBadge, background: (SCHEME_COLOR[p.schemeId] || '#666') + '22', color: SCHEME_COLOR[p.schemeId] || '#666' }}>
                {(p.schemeId || '').toUpperCase()}
              </div>
              {p.subtitle && <div style={s.colSub}>{p.subtitle}</div>}
            </div>
          ))}

          <div style={{ ...s.sectionTitle, gridColumn: `span ${cols + 1}` }}>KEY INPUTS</div>
          {inputRows.length === 0 && (
            <div style={{ ...s.emptyCell, gridColumn: `span ${cols + 1}` }}>No comparable inputs found.</div>
          )}
          {inputRows.map(row => (
            <React.Fragment key={row.label}>
              <div style={{ ...s.rowLabel, ...(row.differ ? s.rowLabelDiff : null) }}>{row.label}</div>
              {row.values.map((v, i) => (
                <div key={i} style={{ ...s.cell, ...(row.differ ? s.cellDiff : null) }}>
                  <span style={row.differ ? s.cellValDiff : null}>{v}</span>
                </div>
              ))}
            </React.Fragment>
          ))}

          <div style={{ ...s.sectionTitle, gridColumn: `span ${cols + 1}` }}>COST COMPONENTS</div>
          {itemRows.length === 0 && (
            <div style={{ ...s.emptyCell, gridColumn: `span ${cols + 1}` }}>No comparable cost components.</div>
          )}
          {itemRows.map(row => (
            <React.Fragment key={row.label}>
              <div style={s.rowLabel}>{row.label}</div>
              {row.amounts.map((a, i) => (
                <div key={i} style={s.cell}>
                  {a == null
                    ? <span style={s.dash}>—</span>
                    : typeof a === 'number'
                      ? <span>RM {a.toLocaleString()}</span>
                      : <span>{a}</span>}
                </div>
              ))}
            </React.Fragment>
          ))}

          <div style={s.totalLabel}>TOTAL MAXIMUM CLAIMABLE</div>
          {totals.map((t, i) => (
            <div key={i} style={{ ...s.totalCell, ...(i === highestIndex ? s.totalHighest : null) }}>
              <div>RM {Number(t).toLocaleString()}</div>
              {i === highestIndex && <div style={s.highestBadge}>HIGHEST</div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const s = {
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 },
  backBtn: { background: '#fff', border: '1px solid #ccc', color: '#555', borderRadius: 6, padding: '8px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer' },
  pdfBtn: { background: '#1565c0', border: 'none', color: '#fff', borderRadius: 6, padding: '8px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer' },
  identicalBanner: { background: '#e3f2fd', border: '1px solid #90caf9', color: '#0d47a1', borderRadius: 6, padding: '10px 14px', marginBottom: 12, fontSize: 12 },
  emptyBanner: { background: '#ffebee', border: '1px solid #ef9a9a', color: '#b71c1c', borderRadius: 6, padding: '10px 14px', marginBottom: 12, fontSize: 12 },
  scroll: { overflowX: 'auto', background: '#fff', border: '1px solid #e0e0e0', borderRadius: 10 },
  grid: { display: 'grid', minWidth: 600 },
  colLabel: { background: '#f5f5f5', borderBottom: '2px solid #ddd' },
  colHead: { background: '#f1f8e9', padding: '10px 12px', borderBottom: '2px solid #2e7d32', borderLeft: '1px solid #e0e0e0' },
  colName: { fontWeight: 700, fontSize: 13, color: '#1b5e20', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  colBadge: { display: 'inline-block', padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 700, marginTop: 4 },
  colSub: { fontSize: 10, color: '#777', marginTop: 4 },
  sectionTitle: { background: '#1b5e20', color: '#fff', padding: '8px 12px', fontSize: 11, fontWeight: 700, letterSpacing: 0.5 },
  rowLabel: { padding: '8px 12px', fontSize: 12, color: '#555', borderBottom: '1px solid #f0f0f0', background: '#fafafa' },
  rowLabelDiff: { background: '#fff8e1', fontWeight: 700, color: '#333' },
  cell: { padding: '8px 12px', fontSize: 12, color: '#333', borderBottom: '1px solid #f0f0f0', borderLeft: '1px solid #f0f0f0' },
  cellDiff: { background: '#fff8e1' },
  cellValDiff: { fontWeight: 700 },
  dash: { color: '#bbb' },
  emptyCell: { padding: '12px', fontSize: 12, color: '#888', background: '#fafafa', borderBottom: '1px solid #f0f0f0' },
  totalLabel: { padding: '12px', fontSize: 13, color: '#1b5e20', fontWeight: 700, background: '#e8f5e9', borderTop: '2px solid #2e7d32' },
  totalCell: { padding: '12px', fontSize: 16, fontWeight: 800, color: '#1b5e20', borderTop: '2px solid #2e7d32', background: '#e8f5e9', borderLeft: '1px solid #c8e6c9' },
  totalHighest: { background: '#c8e6c9' },
  highestBadge: { fontSize: 10, fontWeight: 700, color: '#1b5e20', marginTop: 4 },
};
