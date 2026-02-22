import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useACMData } from '../context/ACMDataContext';

// ─────────────────────────────────────────────────────────
// ADMIN PAGE — ACM Data Management
// ─────────────────────────────────────────────────────────
export default function AdminPage() {
    const navigate          = useNavigate();
    const { reload }        = useACMData() || {};

    // ── Auth ──────────────────────────────────────────────
    const [authed,    setAuthed]    = React.useState(false);
    const [password,  setPassword]  = React.useState('');
    const [authError, setAuthError] = React.useState('');

    // ── Active tab ────────────────────────────────────────
    const [tab, setTab] = React.useState('rates');

    // ── Rates state ───────────────────────────────────────
    const [rates,   setRates]   = React.useState(null);
    const [version, setVersion] = React.useState(null);
    const [saving,  setSaving]  = React.useState(false);
    const [msg,     setMsg]     = React.useState('');

    // ── PDF upload state ──────────────────────────────────
    const [guideFile, setGuideFile] = React.useState(null);
    const [tableFile, setTableFile] = React.useState(null);

    const showMsg = (text, isError = false) => {
        setMsg({ text, isError });
        setTimeout(() => setMsg(''), 3000);
    };

    const adminHeader = { 'Content-Type': 'application/json', 'x-admin-password': password };

    // ── Login ─────────────────────────────────────────────
    const handleLogin = async () => {
        setAuthError('');
        try {
            const res = await fetch('/api/admin/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password })
            });
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                setAuthError(`Error ${res.status}: ${body.error || 'Incorrect password. Please try again.'}`);
                return;
            }
            setAuthed(true);
            // Load current data
            const [ratesData, versionData] = await Promise.all([
                fetch('/api/rates').then(r => r.json()),
                fetch('/api/version').then(r => r.json()),
            ]);
            setRates(ratesData);
            setVersion(versionData);
        } catch {
            setAuthError('Could not connect to server. Make sure the backend is running.');
        }
    };

    // ── Save rates ────────────────────────────────────────
    const saveRates = async () => {
        setSaving(true);
        try {
            const res = await fetch('/api/admin/rates', {
                method: 'POST', headers: adminHeader, body: JSON.stringify(rates)
            });
            if (res.ok) { showMsg('✅ Rates saved successfully.'); reload?.(); }
            else showMsg('❌ Failed to save rates.', true);
        } catch { showMsg('❌ Server error.', true); }
        setSaving(false);
    };

    // ── Save version ──────────────────────────────────────
    const saveVersion = async () => {
        setSaving(true);
        try {
            const res = await fetch('/api/admin/version', {
                method: 'POST', headers: adminHeader, body: JSON.stringify(version)
            });
            if (res.ok) { showMsg('✅ Version stamp saved.'); reload?.(); }
            else showMsg('❌ Failed to save version.', true);
        } catch { showMsg('❌ Server error.', true); }
        setSaving(false);
    };

    // ── Upload PDF ────────────────────────────────────────
    const uploadPDF = async (type) => {
        const file = type === 'guide' ? guideFile : tableFile;
        if (!file) { showMsg('❌ Please select a PDF file first.', true); return; }
        setSaving(true);
        const formData = new FormData();
        formData.append('file', file);
        try {
            const res = await fetch(`/api/admin/upload/${type}`, {
                method: 'POST',
                headers: { 'x-admin-password': password },
                body: formData
            });
            if (res.ok) {
                showMsg(`✅ ${type === 'guide' ? 'ACM Guide' : 'ACM Table'} PDF uploaded successfully.`);
                const updated = await fetch('/api/version').then(r => r.json());
                setVersion(updated);
                if (type === 'guide') setGuideFile(null);
                else setTableFile(null);
            } else {
                const err = await res.json();
                showMsg(`❌ Upload failed: ${err.error}`, true);
            }
        } catch { showMsg('❌ Server error during upload.', true); }
        setSaving(false);
    };

    const setR = (path, value) => {
        const parts = path.split('.');
        setRates(prev => {
            const next = JSON.parse(JSON.stringify(prev));
            let obj = next;
            for (let i = 0; i < parts.length - 1; i++) obj = obj[parts[i]];
            obj[parts[parts.length - 1]] = value === '' ? '' : Number(value);
            return next;
        });
    };

    // ── Styles ────────────────────────────────────────────
    const iStyle = { width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid #ccc', fontSize: '13px', boxSizing: 'border-box' };
    const lStyle = { fontSize: '12px', fontWeight: '600', color: '#555', marginBottom: '3px', display: 'block' };
    const fieldRow = (label, path, unit = '') => (
        <div key={path} style={{ marginBottom: '12px' }}>
            <label style={lStyle}>{label}{unit && <span style={{ fontWeight: '400', color: '#888' }}> ({unit})</span>}</label>
            <input type="number" style={iStyle} value={rates ? (path.split('.').reduce((o, k) => o?.[k], rates) ?? '') : ''} onChange={e => setR(path, e.target.value)} />
        </div>
    );

    const sectionHeader = (title, color = '#1b5e20') => (
        <h4 style={{ color, margin: '20px 0 12px', fontSize: '13px', borderBottom: `2px solid ${color}`, paddingBottom: '6px' }}>{title}</h4>
    );

    // ── LOGIN SCREEN ──────────────────────────────────────
    if (!authed) {
        return (
            <div style={{ minHeight: '100vh', background: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ background: '#fff', borderRadius: '12px', padding: '40px', width: '360px', boxShadow: '0 4px 24px rgba(0,0,0,0.1)' }}>
                    <div style={{ textAlign: 'center', marginBottom: '28px' }}>
                        <div style={{ fontSize: '32px', marginBottom: '8px' }}>🔐</div>
                        <h2 style={{ margin: 0, color: '#1b5e20', fontSize: '20px' }}>Admin Login</h2>
                        <p style={{ color: '#888', fontSize: '12px', margin: '6px 0 0' }}>HRD Corp Calculator — ACM Management</p>
                    </div>
                    <label style={lStyle}>Password</label>
                    <input type="password" style={{ ...iStyle, marginBottom: '16px' }}
                        value={password} onChange={e => setPassword(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleLogin()}
                        placeholder="Enter admin password" autoFocus />
                    {authError && <p style={{ color: '#c62828', fontSize: '12px', margin: '0 0 12px' }}>{authError}</p>}
                    <button onClick={handleLogin} style={{ width: '100%', background: '#2e7d32', color: '#fff', border: 'none', padding: '10px', borderRadius: '7px', fontSize: '14px', fontWeight: '700', cursor: 'pointer' }}>
                        Login
                    </button>
                    <button onClick={() => navigate('/')} style={{ width: '100%', background: 'none', border: 'none', color: '#888', fontSize: '12px', marginTop: '12px', cursor: 'pointer' }}>
                        ← Back to Calculator
                    </button>
                </div>
            </div>
        );
    }

    // ── ADMIN PANEL ───────────────────────────────────────
    const tabs = [
        { id: 'rates',   label: '📊 Rates & Thresholds' },
        { id: 'version', label: '🕐 Version Stamp' },
        { id: 'pdfs',    label: '📁 Replace PDFs' },
    ];

    return (
        <div style={{ minHeight: '100vh', background: '#f5f5f5' }}>
            {/* Header */}
            <div style={{ background: '#1b5e20', color: '#fff', padding: '16px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h2 style={{ margin: 0, fontSize: '18px' }}>⚙️ ACM Admin Panel</h2>
                    <p style={{ margin: '2px 0 0', fontSize: '11px', opacity: 0.8 }}>Millenium Resource Ltd — HRD Corp Calculator</p>
                </div>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    {msg && (
                        <span style={{ fontSize: '12px', background: msg.isError ? '#c62828' : '#388e3c', color: '#fff', padding: '5px 14px', borderRadius: '20px' }}>
                            {msg.text}
                        </span>
                    )}
                    <button onClick={() => navigate('/')} style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.3)', padding: '7px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>
                        ← Calculator
                    </button>
                    <button onClick={() => setAuthed(false)} style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.3)', padding: '7px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>
                        Logout
                    </button>
                </div>
            </div>

            <div style={{ maxWidth: '900px', margin: '0 auto', padding: '28px 24px' }}>
                {/* Tabs */}
                <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
                    {tabs.map(t => (
                        <button key={t.id} onClick={() => setTab(t.id)} style={{
                            padding: '9px 20px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: '600',
                            background: tab === t.id ? '#2e7d32' : '#fff',
                            color: tab === t.id ? '#fff' : '#555',
                            boxShadow: '0 1px 4px rgba(0,0,0,0.1)'
                        }}>{t.label}</button>
                    ))}
                </div>

                {/* ── TAB: RATES & THRESHOLDS ────────────────────── */}
                {tab === 'rates' && rates && (
                    <div style={{ background: '#fff', borderRadius: '10px', padding: '28px', boxShadow: '0 1px 6px rgba(0,0,0,0.08)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                            <h3 style={{ margin: 0, color: '#1b5e20' }}>Rates & Thresholds</h3>
                            <button onClick={saveRates} disabled={saving} style={{ background: '#2e7d32', color: '#fff', border: 'none', padding: '9px 24px', borderRadius: '7px', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}>
                                {saving ? 'Saving…' : '💾 Save All Changes'}
                            </button>
                        </div>
                        <p style={{ color: '#888', fontSize: '12px', margin: '0 0 8px' }}>
                            Update these values when HRD Corp releases a new ACM edition. All changes take effect immediately for all users after saving.
                        </p>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 32px' }}>
                            <div>
                                {sectionHeader('In-House Training')}
                                {fieldRow('Full Day Rate', 'inhouse.full_day', 'RM/day/group')}
                                {fieldRow('Half Day Rate', 'inhouse.half_day', 'RM/day/group')}
                                {fieldRow('Prorate Threshold', 'inhouse.prorate_threshold', 'pax')}
                                {fieldRow('Min Pax — Face-to-Face', 'inhouse.min_pax_f2f', 'pax')}
                                {fieldRow('Min Pax — ROT', 'inhouse.min_pax_rot', 'pax')}
                                {fieldRow('Max Pax — Soft Skills', 'inhouse.max_pax_soft', 'pax/trainer')}
                                {fieldRow('Max Pax — Technical', 'inhouse.max_pax_tech', 'pax/trainer')}

                                {sectionHeader('Public Training')}
                                {fieldRow('Full Day Rate', 'public_training.full_day', 'RM/pax/day')}
                                {fieldRow('Half Day Rate', 'public_training.half_day', 'RM/pax/day')}
                                {fieldRow('Max Pax Per Employer', 'public_training.max_pax_per_employer', 'pax')}

                                {sectionHeader('E-Learning (per pax per programme)')}
                                {[1,2,3,4,5,6,7].map(h => fieldRow(`${h} hour${h>1?'s':''}`, `elearning.hour_table.${h}`, 'RM/pax'))}

                                {sectionHeader('Overseas Training')}
                                {fieldRow('Daily Allowance', 'overseas.daily_allowance', 'RM/pax/day')}
                                {fieldRow('Max Extra Travel Days', 'overseas.extra_days_max', 'days')}
                                {fieldRow('Assistance Rate', 'overseas.assistance_rate', '0.50 = 50%')}
                            </div>
                            <div>
                                {sectionHeader('Allowances')}
                                {fieldRow('Internal Trainer — Full Day', 'allowances.internal_trainer_full', 'RM/day')}
                                {fieldRow('Internal Trainer — Half Day', 'allowances.internal_trainer_half', 'RM/day')}
                                {fieldRow('Travel < 100 km', 'allowances.travel_under_100', 'RM/pax/day')}
                                {fieldRow('Travel ≥ 100 km', 'allowances.travel_over_100', 'RM/pax/day')}
                                {fieldRow('Meal — Full Day', 'allowances.meal_full', 'RM/pax/day')}
                                {fieldRow('Meal — Half Day', 'allowances.meal_half', 'RM/pax/day')}
                                {fieldRow('Overseas Trainer Daily', 'allowances.overseas_trainer', 'RM/trainer/day')}
                                {fieldRow('Consumable Materials', 'allowances.consumable', 'RM/group')}

                                {sectionHeader('Development Programme')}
                                {fieldRow('Study Allowance — Local', 'development.study_local', 'RM/month')}
                                {fieldRow('Study Allowance — Overseas', 'development.study_overseas', 'RM/month')}
                                {fieldRow('Thesis Allowance — Masters', 'development.thesis_masters', 'RM/month')}
                                {fieldRow('Thesis Allowance — PhD', 'development.thesis_phd', 'RM/month')}

                                {sectionHeader('Seminar & Conference')}
                                {fieldRow('Min Pax — In-House Event', 'seminar.min_pax_inhouse', 'pax')}
                                {fieldRow('Min Pax — Public (per TP)', 'seminar.min_pax_public_per_tp', 'pax')}
                                {fieldRow('Overseas Assistance Rate', 'seminar.overseas_assistance', '0.50 = 50%')}

                                {sectionHeader('Estimates & Thresholds')}
                                {fieldRow('"As Charged" Estimate', 'as_charged_estimate', 'RM — proxy for unknown fees')}
                                {fieldRow('Development Estimate', 'dev_estimate', 'RM — proxy for unknown fees')}
                                {fieldRow('Audit Risk Threshold', 'audit_risk_pax', 'pax')}
                            </div>
                        </div>
                        <div style={{ marginTop: '20px', textAlign: 'right' }}>
                            <button onClick={saveRates} disabled={saving} style={{ background: '#2e7d32', color: '#fff', border: 'none', padding: '10px 32px', borderRadius: '7px', fontSize: '14px', fontWeight: '700', cursor: 'pointer' }}>
                                {saving ? 'Saving…' : '💾 Save All Changes'}
                            </button>
                        </div>
                    </div>
                )}

                {/* ── TAB: VERSION STAMP ─────────────────────────── */}
                {tab === 'version' && version && (
                    <div style={{ background: '#fff', borderRadius: '10px', padding: '28px', boxShadow: '0 1px 6px rgba(0,0,0,0.08)' }}>
                        <h3 style={{ margin: '0 0 8px', color: '#1b5e20' }}>Version Stamp</h3>
                        <p style={{ color: '#888', fontSize: '12px', margin: '0 0 24px' }}>
                            Update these whenever you verify the calculator against a new ACM edition. These values appear in the disclaimer shown to all users.
                        </p>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', maxWidth: '600px' }}>
                            <div>
                                <label style={lStyle}>ACM Guide Edition</label>
                                <input type="text" style={iStyle} value={version.acm_guide_edition || ''}
                                    onChange={e => setVersion(v => ({ ...v, acm_guide_edition: e.target.value }))}
                                    placeholder="e.g. September 2025" />
                            </div>
                            <div>
                                <label style={lStyle}>ACM Table Edition</label>
                                <input type="text" style={iStyle} value={version.acm_table_edition || ''}
                                    onChange={e => setVersion(v => ({ ...v, acm_table_edition: e.target.value }))}
                                    placeholder="e.g. November 2025" />
                            </div>
                            <div>
                                <label style={lStyle}>Last Reviewed Date</label>
                                <input type="date" style={iStyle} value={version.last_reviewed || ''}
                                    onChange={e => setVersion(v => ({ ...v, last_reviewed: e.target.value }))} />
                            </div>
                        </div>
                        {version.guide_uploaded_at && (
                            <p style={{ fontSize: '11px', color: '#888', margin: '16px 0 0' }}>
                                ACM Guide last uploaded: {new Date(version.guide_uploaded_at).toLocaleString()}
                            </p>
                        )}
                        {version.table_uploaded_at && (
                            <p style={{ fontSize: '11px', color: '#888', margin: '4px 0 0' }}>
                                ACM Table last uploaded: {new Date(version.table_uploaded_at).toLocaleString()}
                            </p>
                        )}
                        <div style={{ marginTop: '24px' }}>
                            <button onClick={saveVersion} disabled={saving} style={{ background: '#2e7d32', color: '#fff', border: 'none', padding: '10px 32px', borderRadius: '7px', fontSize: '14px', fontWeight: '700', cursor: 'pointer' }}>
                                {saving ? 'Saving…' : '💾 Save Version Stamp'}
                            </button>
                        </div>
                    </div>
                )}

                {/* ── TAB: REPLACE PDFs ──────────────────────────── */}
                {tab === 'pdfs' && (
                    <div style={{ background: '#fff', borderRadius: '10px', padding: '28px', boxShadow: '0 1px 6px rgba(0,0,0,0.08)' }}>
                        <h3 style={{ margin: '0 0 8px', color: '#1b5e20' }}>Replace ACM Documents</h3>
                        <p style={{ color: '#888', fontSize: '12px', margin: '0 0 28px' }}>
                            Upload the latest PDF editions from HRD Corp. The new file replaces the existing one immediately for all users.
                        </p>

                        {/* ACM Guide */}
                        <div style={{ border: '1px solid #e0e0e0', borderRadius: '8px', padding: '20px', marginBottom: '20px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
                                <div>
                                    <h4 style={{ margin: '0 0 4px', color: '#333', fontSize: '14px' }}>📘 ACM Guide</h4>
                                    <p style={{ margin: 0, fontSize: '11px', color: '#888' }}>
                                        {version?.acm_guide_edition ? `Current: ${version.acm_guide_edition}` : 'No edition set'}
                                        {version?.guide_uploaded_at ? ` · Uploaded ${new Date(version.guide_uploaded_at).toLocaleDateString()}` : ''}
                                    </p>
                                </div>
                                <a href="/api/pdf/guide" target="_blank" rel="noreferrer" style={{ fontSize: '12px', color: '#1565c0', textDecoration: 'none' }}>
                                    View Current PDF ↗
                                </a>
                            </div>
                            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                <input type="file" accept=".pdf" onChange={e => setGuideFile(e.target.files[0])} style={{ fontSize: '13px', flex: 1 }} />
                                <button onClick={() => uploadPDF('guide')} disabled={saving || !guideFile}
                                    style={{ background: guideFile ? '#1565c0' : '#ccc', color: '#fff', border: 'none', padding: '8px 20px', borderRadius: '6px', fontSize: '13px', fontWeight: '700', cursor: guideFile ? 'pointer' : 'not-allowed', whiteSpace: 'nowrap' }}>
                                    {saving ? 'Uploading…' : '⬆ Upload'}
                                </button>
                            </div>
                        </div>

                        {/* ACM Table */}
                        <div style={{ border: '1px solid #e0e0e0', borderRadius: '8px', padding: '20px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
                                <div>
                                    <h4 style={{ margin: '0 0 4px', color: '#333', fontSize: '14px' }}>📋 ACM Table</h4>
                                    <p style={{ margin: 0, fontSize: '11px', color: '#888' }}>
                                        {version?.acm_table_edition ? `Current: ${version.acm_table_edition}` : 'No edition set'}
                                        {version?.table_uploaded_at ? ` · Uploaded ${new Date(version.table_uploaded_at).toLocaleDateString()}` : ''}
                                    </p>
                                </div>
                                <a href="/api/pdf/table" target="_blank" rel="noreferrer" style={{ fontSize: '12px', color: '#1565c0', textDecoration: 'none' }}>
                                    View Current PDF ↗
                                </a>
                            </div>
                            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                <input type="file" accept=".pdf" onChange={e => setTableFile(e.target.files[0])} style={{ fontSize: '13px', flex: 1 }} />
                                <button onClick={() => uploadPDF('table')} disabled={saving || !tableFile}
                                    style={{ background: tableFile ? '#1565c0' : '#ccc', color: '#fff', border: 'none', padding: '8px 20px', borderRadius: '6px', fontSize: '13px', fontWeight: '700', cursor: tableFile ? 'pointer' : 'not-allowed', whiteSpace: 'nowrap' }}>
                                    {saving ? 'Uploading…' : '⬆ Upload'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
