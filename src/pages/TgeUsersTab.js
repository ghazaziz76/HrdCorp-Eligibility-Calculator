import React from 'react';

const iStyle = { padding: '5px 8px', borderRadius: '6px', border: '1px solid #ccc', fontSize: '12px', boxSizing: 'border-box' };
const lStyle = { fontSize: '12px', fontWeight: '600', color: '#555', marginBottom: '3px', display: 'block' };
const card = { background: '#fff', borderRadius: '10px', padding: '20px', boxShadow: '0 1px 6px rgba(0,0,0,0.08)', marginBottom: '16px' };
const th = { textAlign: 'left', padding: '6px 8px', borderBottom: '2px solid #1b5e20', color: '#1b5e20', whiteSpace: 'nowrap' };
const td = { padding: '6px 8px', borderBottom: '1px solid #eee', verticalAlign: 'top' };
const btn = (bg) => ({ background: bg, color: '#fff', border: 'none', padding: '4px 10px', borderRadius: '5px', fontSize: '11px', fontWeight: '600', cursor: 'pointer', marginRight: '4px' });

const linkBtn = { background: 'none', border: 'none', color: '#1565c0', fontSize: '11px', cursor: 'pointer', padding: 0, textDecoration: 'underline' };
const fmtDate = (s) => (s ? String(s).slice(0, 10) : '');
// Malaysia wall-clock time (UTC+8, no DST), "YYYY-MM-DD HH:mm".
const fmtTime = (s) => {
    if (!s) return 'never';
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return String(s);
    return new Date(d.getTime() + 8 * 3600e3).toISOString().replace('T', ' ').slice(0, 16);
};
const usd = (n) => `$${Number(n || 0).toFixed(2)}`;

export default function TgeUsersTab({ adminHeader, showMsg }) {
    const [data, setData] = React.useState(null);
    const [log, setLog] = React.useState([]);
    const [search, setSearch] = React.useState('');
    const [limitInput, setLimitInput] = React.useState('');
    const [cost, setCost] = React.useState({});

    const pw = adminHeader && adminHeader['x-admin-password'];

    const load = React.useCallback(async () => {
        try {
            const [r1, r2] = await Promise.all([
                fetch('/api/admin/tge-users', { headers: adminHeader }),
                fetch('/api/admin/tge-log?limit=200', { headers: adminHeader }),
            ]);
            if (!r1.ok) throw new Error(`Error ${r1.status}`);
            const d = await r1.json();
            setData(d);
            setLimitInput(String(d.settings.monthly_spend_limit_usd));
            setCost(d.settings.cost || {});
            const l = r2.ok ? await r2.json() : [];
            setLog(Array.isArray(l) ? l : []);
        } catch (e) {
            showMsg(`Could not load TGE users: ${e.message}`, true);
        }
    }, [pw]);

    React.useEffect(() => { load(); }, [load]);

    const post = async (url, body, okText) => {
        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: { ...adminHeader, 'Content-Type': 'application/json' },
                body: JSON.stringify(body || {}),
            });
            const out = await res.json().catch(() => ({}));
            if (!res.ok) { showMsg(out.error || `Error ${res.status}`, true); return null; }
            showMsg(okText || 'Saved');
            await load();
            return out;
        } catch (e) {
            showMsg(e.message, true);
            return null;
        }
    };

    const base = (code) => `/api/admin/tge-users/${encodeURIComponent(code)}`;

    const setAi = (u, v) => post(base(u.code), { ai_enabled: v });
    const commitLimit = (u, text) => {
        const t = text.trim();
        const next = t === '' ? null : Number(t);
        if (next !== null && !(Number.isInteger(next) && next >= 0)) { showMsg('Limit must be a whole number or blank', true); return; }
        if (next === u.admin.monthly_limit) return;
        post(base(u.code), { monthly_limit: next });
    };
    const reset = (u) => {
        if (window.confirm(`Reset this month's upload count for ${u.code}?`)) post(`${base(u.code)}/reset-count`, {}, 'Count reset');
    };
    const toggleRevoke = (u) => {
        const revoke = !u.admin.revoked;
        if (window.confirm(`${revoke ? 'Remove' : 'Restore'} TGE access for ${u.email || u.code}?`)) post(base(u.code), { revoked: revoke });
    };
    const verify = async (u) => {
        const out = await post(`${base(u.code)}/verify-play`, {}, 'Verification run');
        if (out && out.result && out.result.reason) showMsg(`Play verification: ${out.result.reason}`);
    };
    const saveSettings = () => {
        const raw = [limitInput, cost.input_per_mtok, cost.output_per_mtok, cost.fallback_per_call_usd];
        if (raw.some((v) => String(v ?? '').trim() === '')) {
            showMsg('Settings fields cannot be blank', true);
            return;
        }
        const lim = Number(limitInput);
        const c = {};
        for (const k of ['input_per_mtok', 'output_per_mtok', 'fallback_per_call_usd']) c[k] = Number(cost[k]);
        if (!Number.isFinite(lim) || lim < 0 || Object.values(c).some((v) => !Number.isFinite(v) || v < 0)) {
            showMsg('Settings must be numbers >= 0', true);
            return;
        }
        post('/api/admin/ai-settings', { monthly_spend_limit_usd: lim, cost: c }, 'Settings saved');
    };

    if (!data) return <div style={card}>Loading…</div>;

    const q = search.trim().toLowerCase();
    const users = data.users.filter((u) => !q
        || [u.code, u.email, u.name].some((s) => s && String(s).toLowerCase().includes(q)));
    const t = data.totals;

    return (
        <div>
            {data.warnings.map((w) => (
                <div key={w} style={{ background: '#ffebee', color: '#c62828', border: '1px solid #ef9a9a', borderRadius: '8px', padding: '10px 14px', marginBottom: '8px', fontSize: '13px', fontWeight: '600' }}>{w}</div>
            ))}

            <div style={{ ...card, display: 'flex', gap: '32px', fontSize: '14px', color: '#1b5e20', fontWeight: '700' }}>
                <span>AI spend this month {usd(t.spend_month_usd)} of {usd(t.limit_usd)} ({Math.round(t.spend_pct)}%)</span>
                <span>AI users {t.ai_users}</span>
            </div>

            <div style={card}>
                <h3 style={{ margin: '0 0 10px', color: '#1b5e20', fontSize: '15px' }}>AI settings</h3>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                    <div><label style={lStyle}>Monthly limit ($)</label>
                        <input style={{ ...iStyle, width: '90px' }} type="number" min="0" value={limitInput} onChange={(e) => setLimitInput(e.target.value)} /></div>
                    {[['input_per_mtok', 'Input $/M tokens'], ['output_per_mtok', 'Output $/M tokens'], ['fallback_per_call_usd', 'Fallback $/call']].map(([k, label]) => (
                        <div key={k}><label style={lStyle}>{label}</label>
                            <input style={{ ...iStyle, width: '90px' }} type="number" min="0" step="any" value={cost[k] ?? ''} onChange={(e) => setCost({ ...cost, [k]: e.target.value })} /></div>
                    ))}
                    <button style={{ ...btn('#2e7d32'), padding: '7px 16px', fontSize: '12px' }} onClick={saveSettings}>Save settings</button>
                </div>
                <p style={{ color: '#888', fontSize: '11px', margin: '10px 0 0' }}>
                    Set the cost rates to the extraction model's current price, otherwise the spend figures and the limit will be wrong.
                </p>
            </div>

            <div style={card}>
                <input style={{ ...iStyle, width: '100%', marginBottom: '12px', padding: '8px 10px' }} placeholder="Search code, email or name"
                    value={search} onChange={(e) => setSearch(e.target.value)} />
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '12px' }}>
                        <thead><tr>
                            {['Who', 'Access', 'Code', 'Source', 'Newsletter status', 'TGE', 'Used / limit', 'Last used', 'Total', 'Cost this month', 'Upload limit / month'].map((h) => <th key={h} style={th}>{h}</th>)}
                        </tr></thead>
                        <tbody>
                            {users.map((u) => {
                                const play = u.source === 'play';
                                const tgeOn = u.tge === 'activated';
                                // Locked by the subscriber's own status (cancelled, refunded, ...), not by an admin.
                                const lockedElsewhere = !tgeOn && !u.admin.revoked;
                                const uploadOn = tgeOn && u.admin.ai_enabled !== false && u.ai.limit > 0;
                                return (
                                    <tr key={u.code}>
                                        <td style={td}>{play ? 'Play Store' : <>{u.name}<br /><span style={{ color: '#888' }}>{u.email}</span></>}</td>
                                        <td style={{ ...td, whiteSpace: 'nowrap' }}>
                                            <label style={{ display: 'block', cursor: lockedElsewhere ? 'not-allowed' : 'pointer' }}
                                                title={lockedElsewhere ? `Locked by subscription status: ${u.newsletter_status || u.ai.reason}` : ''}>
                                                <input type="checkbox" data-testid="tick-tge" checked={tgeOn} disabled={lockedElsewhere}
                                                    onChange={() => toggleRevoke(u)} /> TGE
                                            </label>
                                            <label style={{ display: 'block', cursor: tgeOn ? 'pointer' : 'not-allowed' }}>
                                                <input type="checkbox" data-testid="tick-upload" checked={uploadOn} disabled={!tgeOn}
                                                    onChange={() => setAi(u, !uploadOn)} /> Upload
                                            </label>
                                            {u.admin.ai_enabled !== null && (
                                                <button style={linkBtn} title="Go back to what the plan gives" onClick={() => setAi(u, null)}>{'\u21ba'} plan</button>
                                            )}
                                        </td>
                                        <td style={{ ...td, fontFamily: 'monospace' }}>{u.code}</td>
                                        <td style={td}>{u.source}</td>
                                        <td style={td}>{u.newsletter_status || '-'}</td>
                                        <td style={{ ...td, color: u.tge === 'activated' ? '#2e7d32' : '#c62828', fontWeight: '600' }}>
                                            {u.tge}{u.refunded_at && <><br /><span style={{ color: '#c62828', fontWeight: '400' }}>Refunded {fmtDate(u.refunded_at)}</span></>}
                                        </td>
                                        <td style={td} title={u.ai.reason}>{`${u.ai.used} / ${u.ai.limit}`}</td>
                                        <td style={td}>{fmtTime(u.last_used_at)}</td>
                                        <td style={td}>{u.total}</td>
                                        <td style={td}>{usd(u.cost_month_usd)}</td>
                                        <td style={{ ...td, whiteSpace: 'nowrap' }}>
                                            <input key={`${u.code}:${u.admin.monthly_limit}`} style={{ ...iStyle, width: '60px' }} type="number" min="0" placeholder="plan" title="Blank = the plan's default (yearly 50, monthly 3, VIP 5, Play 10). Type a number to override."
                                                defaultValue={u.admin.monthly_limit === null ? '' : u.admin.monthly_limit}
                                                onBlur={(e) => commitLimit(u, e.target.value)}
                                                onKeyDown={(e) => e.key === 'Enter' && e.target.blur()} />{' '}
                                            <button style={btn('#1565c0')} onClick={() => reset(u)}>Reset</button>
                                            {play && <button style={btn('#6a1b9a')} onClick={() => verify(u)}>Verify</button>}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            <div style={card}>
                <h3 style={{ margin: '0 0 10px', color: '#1b5e20', fontSize: '15px' }}>Change log</h3>
                {log.length === 0 && <p style={{ color: '#888', fontSize: '12px', margin: 0 }}>No changes yet.</p>}
                <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '12px', color: '#333' }}>
                    {log.map((e, i) => (
                        <li key={`${e.at}-${i}`}>
                            {fmtTime(e.at)} · {e.who} · {e.action}{e.code ? ` · ${e.code}` : ''} · {Object.entries(e.changes || {}).map(([k, v]) => `${k}: ${JSON.stringify(v[0])} → ${JSON.stringify(v[1])}`).join(', ')}
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
}
