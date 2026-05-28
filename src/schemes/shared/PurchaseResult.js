import React from 'react';
import { exportResultPDF } from '../../utils/pdfExportWeb';

const saveHistory = (schemeId, schemeLabel, result) => {
  try {
    const hist = JSON.parse(localStorage.getItem('hrd_calc_history') || '[]');
    hist.unshift({
      id: Date.now().toString(),
      scheme: schemeId,
      trainingType: schemeLabel,
      totalPax: 0,
      totalClaimable: result.totalClaimable,
      items: result.items,
      warnings: result.warnings,
      timestamp: new Date().toISOString(),
    });
    localStorage.setItem('hrd_calc_history', JSON.stringify(hist.slice(0, 50)));
  } catch {}
};

export default function PurchaseResult({ schemeId, schemeLabel, result }) {
  React.useEffect(() => { if (result) saveHistory(schemeId, schemeLabel, result); }, [result, schemeId, schemeLabel]);
  if (!result) return null;

  return (
    <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: '10px', padding: '24px' }}>
      <h3 style={{ color: '#2e7d32', marginBottom: '16px' }}>Eligibility Breakdown</h3>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', marginBottom: '20px' }}>
        <thead>
          <tr style={{ background: '#f1f8e9' }}>
            <th style={{ textAlign: 'left', padding: '10px 12px', color: '#2e7d32' }}>Component</th>
            <th style={{ textAlign: 'left', padding: '10px 12px', color: '#2e7d32' }}>Basis / Notes</th>
            <th style={{ textAlign: 'right', padding: '10px 12px', color: '#2e7d32' }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {result.items.map((row, i) => (
            <tr key={i} style={{ borderBottom: '1px solid #f0f0f0', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
              <td style={{ padding: '10px 12px', fontWeight: '600', color: '#333' }}>{row.label}</td>
              <td style={{ padding: '10px 12px', color: '#666', fontSize: '12px' }}>{row.note}</td>
              <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '700', color: row.amount < 0 ? '#c62828' : '#1b5e20' }}>RM {row.amount.toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr style={{ background: '#e8f5e9', borderTop: '2px solid #4CAF50' }}>
            <td colSpan="2" style={{ padding: '12px', fontWeight: '700', color: '#1b5e20', fontSize: '15px' }}>Total Maximum Claimable</td>
            <td style={{ padding: '12px', textAlign: 'right', fontWeight: '800', color: '#1b5e20', fontSize: '17px' }}>RM {result.totalClaimable.toLocaleString()}</td>
          </tr>
        </tfoot>
      </table>

      {result.supportingDocs && (
        <div style={{ background: '#e8eaf6', border: '1px solid #9fa8da', borderRadius: '8px', padding: '18px', marginBottom: '16px' }}>
          <p style={{ fontWeight: '700', color: '#283593', marginBottom: '10px', fontSize: '13px' }}>Supporting Documents Required — Grant Submission</p>
          <ol style={{ margin: '0 0 12px', padding: '0 0 0 18px' }}>
            {result.supportingDocs.grantSubmission.map((doc, i) => (
              <li key={i} style={{ color: '#333', fontSize: '12px', marginBottom: '5px', lineHeight: '1.6' }}>
                {doc.text}
                {doc.subItems && doc.subItems.length > 0 && (
                  <ul style={{ margin: '4px 0 4px', padding: '0 0 0 18px' }}>
                    {doc.subItems.map((s, j) => (
                      <li key={j} style={{ color: '#555', fontSize: '12px', marginBottom: '3px', lineHeight: '1.6' }}>{s}</li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ol>
          {result.supportingDocs.claimSubmission && result.supportingDocs.claimSubmission.length > 0 && (
            <>
              <p style={{ fontWeight: '700', color: '#283593', margin: '0 0 10px', fontSize: '13px' }}>Supporting Documents Required — Claim Submission</p>
              <ol style={{ margin: 0, padding: '0 0 0 18px' }}>
                {result.supportingDocs.claimSubmission.map((doc, i) => (
                  <li key={i} style={{ color: '#333', fontSize: '12px', marginBottom: '5px', lineHeight: '1.6' }}>{doc.text}</li>
                ))}
              </ol>
            </>
          )}
        </div>
      )}

      {result.warnings.length > 0 && (
        <div style={{ background: '#fffde7', border: '1px solid #f9a825', borderRadius: '8px', padding: '16px' }}>
          <p style={{ fontWeight: '700', color: '#f57f17', marginBottom: '8px', fontSize: '13px' }}>Notes &amp; Reminders:</p>
          {result.warnings.map((w, i) => <p key={i} style={{ color: '#555', fontSize: '12px', margin: '4px 0' }}>{w}</p>)}
        </div>
      )}

      <button onClick={() => exportResultPDF(result, { scheme: schemeId, trainingType: schemeLabel, totalPax: 0 })}
        style={{ display: 'block', width: '100%', marginTop: '16px', padding: '14px', background: '#1565c0', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '15px', fontWeight: '700', cursor: 'pointer' }}>
        Export as PDF
      </button>
    </div>
  );
}
