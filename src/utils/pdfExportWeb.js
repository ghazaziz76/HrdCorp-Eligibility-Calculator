// ── PDF Export (Web) ────────────────────────────────────
// Uses browser print dialog to generate PDF

const formatRM = (amount) => `RM ${Number(amount).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const buildHTML = (result, meta = {}) => {
    const { scheme = '', trainingType = '', totalPax = 0 } = meta;
    const now = new Date().toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

    const itemRows = result.items.map((row, i) => {
        const amountStr = row.entitledCount != null
            ? `${row.entitledCount} person(s)`
            : row.amount != null
                ? formatRM(row.amount)
                : 'As per quotation';

        const subRows = (row.perCompany && row.perCompany.length > 1)
            ? row.perCompany.map(pc => `
                <tr class="sub-row">
                    <td style="padding-left:30px;color:#666;font-size:11px;">&#8627; ${pc.label}</td>
                    <td style="color:#666;font-size:11px;">${pc.note || ''}</td>
                    <td style="text-align:right;color:#666;font-size:11px;">${formatRM(pc.amount)}</td>
                </tr>`).join('')
            : '';

        const noteStr = row.note || '';

        return `
            <tr style="background:${i % 2 === 0 ? '#fff' : '#fafafa'}">
                <td style="font-weight:600;">${row.label}${row.isEstimate ? ' <span style="color:#f57c00;font-size:10px;background:#fff3e0;padding:1px 5px;border-radius:3px;">est.</span>' : ''}</td>
                <td style="color:#666;font-size:11px;">${noteStr}</td>
                <td style="text-align:right;font-weight:600;">${amountStr}</td>
            </tr>
            ${subRows}`;
    }).join('');

    const airTicketSection = result.airTicketEntitled > 0
        ? `<div class="info-box">&#9992; Air Ticket: <strong>${result.airTicketEntitled} person(s)</strong> entitled — submit actual airfare cost with ticket stub / e-Ticket / travel agent invoice.</div>`
        : '';

    const docsSection = result.supportingDocs
        ? `<div class="docs-section">
            <h3>&#128196; Supporting Documents Required</h3>
            <ol>${result.supportingDocs.grantSubmission.map(doc => {
                const subItems = doc.subItems && doc.subItems.length > 0
                    ? `<ul>${doc.subItems.map(s => `<li>${s}</li>`).join('')}</ul>`
                    : '';
                return `<li>${doc.text}${subItems}</li>`;
            }).join('')}</ol>
           </div>`
        : '';

    const warningsSection = result.warnings && result.warnings.length > 0
        ? `<div class="warnings-section">
            <h3>&#128204; Notes &amp; Reminders</h3>
            <ul>${result.warnings.map(w => `<li>${w}</li>`).join('')}</ul>
           </div>`
        : '';

    return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>HRD Grant Eligibility Report</title>
<style>
    @media print {
        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .no-print { display: none !important; }
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Helvetica, Arial, sans-serif; font-size: 12px; color: #333; padding: 30px; max-width: 800px; margin: 0 auto; }
    .header { background: #1b5e20; color: white; padding: 22px 24px; border-radius: 8px; margin-bottom: 20px; }
    .header h1 { font-size: 20px; margin-bottom: 4px; }
    .header p { font-size: 11px; opacity: 0.85; }
    .meta { display: flex; justify-content: space-between; margin-bottom: 18px; padding: 14px 16px; background: #f5f5f5; border-radius: 6px; border: 1px solid #e0e0e0; }
    .meta-item { }
    .meta-label { font-size: 10px; color: #888; text-transform: uppercase; letter-spacing: 0.5px; }
    .meta-value { font-size: 14px; font-weight: 700; color: #333; margin-top: 2px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 18px; }
    th { background: #2e7d32; color: white; padding: 10px 12px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.3px; }
    th:last-child { text-align: right; }
    td { padding: 9px 12px; border-bottom: 1px solid #eee; font-size: 12px; }
    .total-row { background: #e8f5e9 !important; }
    .total-row td { font-weight: 700; font-size: 15px; color: #1b5e20; border-top: 2px solid #2e7d32; padding: 12px; }
    .info-box { background: #e3f2fd; border-left: 4px solid #1976d2; padding: 12px 14px; margin-bottom: 14px; font-size: 12px; border-radius: 4px; color: #0d47a1; }
    .docs-section, .warnings-section { margin-bottom: 16px; padding: 14px 16px; border-radius: 6px; }
    .docs-section { background: #e8eaf6; border: 1px solid #9fa8da; }
    .warnings-section { background: #fffde7; border: 1px solid #fff59d; }
    .docs-section h3 { font-size: 13px; color: #283593; margin-bottom: 10px; }
    .warnings-section h3 { font-size: 13px; color: #f57f17; margin-bottom: 10px; }
    ol, ul { padding-left: 22px; }
    li { margin-bottom: 5px; font-size: 11px; line-height: 1.6; }
    .disclaimer { margin-top: 24px; padding: 14px; background: #fff8e1; border: 1px solid #ffe082; border-radius: 6px; font-size: 10px; color: #666; line-height: 1.6; }
    .footer { margin-top: 16px; text-align: center; font-size: 9px; color: #999; }
    .print-btn { display: block; margin: 20px auto; padding: 12px 40px; background: #1b5e20; color: white; border: none; border-radius: 6px; font-size: 15px; font-weight: 700; cursor: pointer; }
    .print-btn:hover { background: #2e7d32; }
</style>
</head>
<body>
    <div class="header">
        <h1>HRD Grant Eligibility Report</h1>
        <p>Generated on ${now} | Source: https://www.hrdcorp.gov.my</p>
    </div>

    <div class="meta">
        <div class="meta-item">
            <div class="meta-label">Scheme</div>
            <div class="meta-value">${scheme.toUpperCase()}</div>
        </div>
        <div class="meta-item">
            <div class="meta-label">Training Type</div>
            <div class="meta-value">${trainingType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</div>
        </div>
        <div class="meta-item">
            <div class="meta-label">Total Participants</div>
            <div class="meta-value">${totalPax}</div>
        </div>
    </div>

    <table>
        <thead>
            <tr><th>Cost Item</th><th>Basis / Notes</th><th>Amount</th></tr>
        </thead>
        <tbody>
            ${itemRows}
            <tr class="total-row">
                <td colspan="2">Total Maximum Claimable</td>
                <td style="text-align:right;">${formatRM(result.totalClaimable)}</td>
            </tr>
        </tbody>
    </table>

    ${airTicketSection}
    ${docsSection}
    ${warningsSection}

    <div class="disclaimer">
        <strong>DISCLAIMER:</strong> This report is generated by HRD Grant Eligibility Calculator, an independent tool by Millenium Resource Ltd.
        All calculations are estimates based on the HRD Corp Allowable Cost Matrix (ACM) Guide. Actual claimable amounts are subject to
        HRD Corp's review, verification, and final approval. This is not an official HRD Corp document.
        For official information, visit <a href="https://www.hrdcorp.gov.my">https://www.hrdcorp.gov.my</a>
    </div>

    <div class="footer">
        HRD Grant Eligibility Calculator &copy; ${new Date().getFullYear()} Millenium Resource Ltd
    </div>

    <button class="print-btn no-print" onclick="window.print()">&#128424; Print / Save as PDF</button>
</body>
</html>`;
};

export const exportResultPDF = (result, meta = {}) => {
    const html = buildHTML(result, meta);
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        alert('Please allow pop-ups to export PDF.');
        return;
    }
    printWindow.document.write(html);
    printWindow.document.close();
};
