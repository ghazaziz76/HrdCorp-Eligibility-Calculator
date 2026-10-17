import { buildHTML } from './pdfExportWeb';
import { buildHtml as buildComparisonHtml } from './comparisonPdfExport';
import { comparePlans } from './comparePlans';

const baseResult = {
    items: [{ label: 'B) Course Fee', amount: 1000, note: 'note', perCompany: [
        { label: '<b>Branch & Co</b>', amount: 500, note: 'x' },
        { label: 'Host', amount: 500, note: 'y' },
    ] }],
    totalClaimable: 1000,
    warnings: ['Watch <script>alert(1)</script>'],
    supportingDocs: { grantSubmission: [{ text: 'Course content', subItems: ['Sub <i>'] }] },
};

test('shows the training programme name and plan name, escaped', () => {
    const html = buildHTML(baseResult, { scheme: 'hcc', trainingType: 'inhouse', totalPax: 12, trainingProgrammeName: 'Lean <Six> Sigma', planName: 'Q1 "plan" & co' });
    expect(html).toContain('Training Programme');
    expect(html).toContain('Lean &lt;Six&gt; Sigma');
    expect(html).toContain('Q1 &quot;plan&quot; &amp; co');
    expect(html).toContain('In-House');
    expect(html).toContain('Total Participants');
    expect(html).toContain('>12<');
});

test('leaves the names box out when there is no programme or plan name', () => {
    const html = buildHTML(baseResult, { scheme: 'hcc', trainingType: 'inhouse', totalPax: 3 });
    expect(html).not.toContain('Training Programme');
    expect(html).not.toContain('>Plan<');
});

test('escapes employer / branch labels, notes, warnings and documents', () => {
    const html = buildHTML(baseResult, { scheme: 'hcc', trainingType: 'inhouse', totalPax: 2 });
    expect(html).toContain('&lt;b&gt;Branch &amp; Co&lt;/b&gt;');
    expect(html).not.toContain('<b>Branch');
    expect(html).toContain('Watch &lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).not.toContain('<script>alert(1)');
    expect(html).toContain('Sub &lt;i&gt;');
});

test('omits the participants line when totalPax is not given (non-training schemes)', () => {
    const html = buildHTML(baseResult, { scheme: 'alat', trainingType: 'ALAT — Training Facilities & Renovation' });
    expect(html).not.toContain('Total Participants');
    expect(html).toContain('ALAT — Training Facilities &amp; Renovation');
});

test('includes claim-submission documents when the result has them', () => {
    const result = { ...baseResult, supportingDocs: { grantSubmission: [{ text: 'Quotation' }], claimSubmission: [{ text: 'Official receipt & proof of payment' }] } };
    const html = buildHTML(result, { scheme: 'it', trainingType: 'IT' });
    expect(html).toContain('Supporting Documents Required — Grant Submission');
    expect(html).toContain('Supporting Documents Required — Claim Submission');
    expect(html).toContain('Official receipt &amp; proof of payment');
    // HCC/SBL/SLB results have grant docs only — no claim heading.
    expect(buildHTML(baseResult, { scheme: 'hcc' })).not.toContain('Claim Submission');
});

test('company name is spelled Millenium', () => {
    expect(buildHTML(baseResult, {})).toContain('Millenium Resource Ltd');
    expect(buildHTML(baseResult, {})).not.toContain('Millennium');
});

describe('comparison PDF', () => {
    const plan = (id, name, prog) => ({
        id, name, schemeId: 'hcc', schemeLabel: 'HCC — Training Course',
        inputs: { scheme: 'hcc', trainingProgrammeName: prog, trainingType: 'inhouse', host: { pax: 5 }, days: 1 },
        resultSnapshot: { items: [], totalClaimable: 100 },
    });

    test('shows each plan\'s programme name, escaped, and spells Millenium', () => {
        const data = comparePlans([plan('a', 'A <1>', 'Lean & Mean'), plan('b', 'B', '')]);
        expect(data.planHeaders.map(p => p.programmeName)).toEqual(['Lean & Mean', '']);
        const html = buildComparisonHtml(data);
        expect(html).toContain('Lean &amp; Mean');
        expect(html).toContain('A &lt;1&gt;');
        expect(html.match(/class="plan-prog"/g)).toHaveLength(1);
        expect(html).toContain('Millenium Resource Ltd');
        expect(html).not.toContain('Millennium');
    });
});
