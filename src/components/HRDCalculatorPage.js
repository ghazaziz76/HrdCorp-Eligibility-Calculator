import React, { useState } from 'react';
import CalculatorTab from './CalculatorTab';
import { useACMData } from '../context/ACMDataContext';
import milleniumLogo from '../assets/Millenium-removebg-preview.png';
import auraLogo from '../assets/AURA-remove.png';
import appIcon from '../assets/app-icon.png';

const FORM_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSfYgJEpz_b9HthuFVrAv_3Ep7q2YtXTusQlD7ZUEzvhIHXpqg/viewform?usp=dialog';
const AURA_WEBSITE_URL = 'https://www.milleniumrx.biz/product/aura/index.html';

const TABS = [
    { id: 'calculator', label: 'Calculator', icon: '🧮' },
    { id: 'history', label: 'History', icon: '📋' },
    { id: 'reference', label: 'ACM Reference', icon: '📖' },
    { id: 'about', label: 'About', icon: 'ℹ️' },
];

// ── History Tab ─────────────────────────────────────────
const SCHEME_NAMES = { hcc: 'HCC', sbl: 'SBL', slb: 'SLB', alat: 'ALAT', it: 'IT' };
const TRAINING_NAMES = {
    inhouse: 'In-House', rot_inhouse: 'ROT In-House', coaching_mentoring: 'Coaching',
    rot_public: 'ROT Public', public: 'Public', seminar_conference: 'Seminar',
    elearning: 'E-Learning', mobile_elearning: 'Mobile E-Learning',
    overseas: 'Overseas', overseas_seminar: 'Overseas Seminar', development: 'Development',
};

const HistoryTab = () => {
    const [history, setHistory] = useState(() => {
        try { return JSON.parse(localStorage.getItem('hrd_calc_history') || '[]'); } catch { return []; }
    });
    const [expanded, setExpanded] = useState(null);

    const deleteItem = (id) => {
        if (!window.confirm('Remove this calculation from history?')) return;
        const updated = history.filter(h => h.id !== id);
        localStorage.setItem('hrd_calc_history', JSON.stringify(updated));
        setHistory(updated);
    };

    const clearAll = () => {
        if (!window.confirm('Remove all calculation history?')) return;
        localStorage.setItem('hrd_calc_history', '[]');
        setHistory([]);
    };

    if (history.length === 0) {
        return (
            <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                <p style={{ fontSize: '16px', color: '#999' }}>No calculations yet.</p>
                <p style={{ fontSize: '13px', color: '#bbb' }}>Results will appear here after you calculate.</p>
            </div>
        );
    }

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ margin: 0, color: '#1b5e20' }}>Calculation History</h3>
                <button onClick={clearAll} style={{ background: 'none', border: 'none', color: '#e53935', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>Clear All</button>
            </div>
            {history.map(item => (
                <div key={item.id} style={{ background: '#fff', borderRadius: '10px', padding: '16px', marginBottom: '10px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', cursor: 'pointer' }}
                    onClick={() => setExpanded(expanded === item.id ? null : item.id)}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                <span style={{
                                    padding: '2px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: '700',
                                    background: item.scheme === 'hcc' ? '#e3f2fd' : item.scheme === 'slb' ? '#f3e5f5' : '#e8f5e9',
                                    color: item.scheme === 'hcc' ? '#1565c0' : item.scheme === 'slb' ? '#6a1b9a' : '#2e7d32',
                                }}>{SCHEME_NAMES[item.scheme] || item.scheme}</span>
                                <span style={{ fontSize: '13px', fontWeight: '600', color: '#333' }}>{TRAINING_NAMES[item.trainingType] || item.trainingType}</span>
                            </div>
                            <span style={{ fontSize: '11px', color: '#999' }}>
                                {new Date(item.timestamp).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                {' · '}{item.totalPax} pax
                            </span>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '16px', fontWeight: '800', color: '#1b5e20' }}>RM {item.totalClaimable?.toLocaleString() || '0'}</div>
                            <span style={{ fontSize: '12px', color: '#bbb' }}>{expanded === item.id ? '▲' : '▼'}</span>
                        </div>
                    </div>
                    {expanded === item.id && (
                        <div style={{ marginTop: '12px', borderTop: '1px solid #f0f0f0', paddingTop: '12px' }}>
                            {item.items?.map((row, i) => (
                                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                                    <span style={{ fontSize: '12px', color: '#555' }}>{row.label}</span>
                                    <span style={{ fontSize: '12px', fontWeight: '600', color: '#1b5e20' }}>
                                        {row.amount != null ? `RM ${row.amount.toLocaleString()}` : row.entitledCount != null ? `${row.entitledCount} person(s)` : '—'}
                                    </span>
                                </div>
                            ))}
                            {item.airTicketEntitled > 0 && (
                                <p style={{ fontSize: '11px', color: '#1565c0', marginTop: '6px' }}>Air Ticket: {item.airTicketEntitled} person(s) entitled</p>
                            )}
                            <div style={{ textAlign: 'right', marginTop: '10px' }}>
                                <button onClick={(e) => { e.stopPropagation(); deleteItem(item.id); }}
                                    style={{ background: 'none', border: '1px solid #e57373', borderRadius: '6px', padding: '4px 14px', color: '#e53935', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>
                                    Delete
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
};

// ── ACM Reference Tab ───────────────────────────────────
const ReferenceTab = () => {
    const { version, reload } = useACMData() || {};
    const [syncing, setSyncing] = useState(false);

    const handleSync = async () => {
        setSyncing(true);
        try { reload?.(); } catch {}
        setTimeout(() => setSyncing(false), 1500);
    };

    return (
        <div>
            <h3 style={{ color: '#1b5e20', marginBottom: '16px' }}>ACM Reference</h3>
            <div style={{ background: '#fff', borderRadius: '10px', padding: '20px', marginBottom: '16px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                <h4 style={{ margin: '0 0 8px', color: '#333' }}>ACM Data</h4>
                {version && (
                    <>
                        <p style={{ margin: '4px 0', fontSize: '13px', color: '#555' }}>Guide Edition: {version.acm_guide_edition || '—'}</p>
                        <p style={{ margin: '4px 0', fontSize: '13px', color: '#555' }}>Table Edition: {version.acm_table_edition || '—'}</p>
                    </>
                )}
                <button onClick={handleSync} disabled={syncing}
                    style={{ marginTop: '14px', background: '#2e7d32', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 20px', fontSize: '13px', fontWeight: '700', cursor: 'pointer', opacity: syncing ? 0.7 : 1 }}>
                    {syncing ? 'Checking...' : 'Check for Updates'}
                </button>
            </div>
            <div style={{ background: '#fff', borderRadius: '10px', padding: '40px', textAlign: 'center', border: '1px dashed #e0e0e0' }}>
                <p style={{ fontSize: '14px', color: '#999' }}>ACM rates table will be displayed here</p>
            </div>
        </div>
    );
};

// ── About Tab ───────────────────────────────────────────
const AboutTab = () => (
    <div>
        <h3 style={{ color: '#1b5e20', marginBottom: '16px' }}>About</h3>
        <div style={{ background: '#fff', borderRadius: '10px', padding: '20px', marginBottom: '16px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <h4 style={{ margin: '0 0 8px', color: '#333' }}>Training Grant Estimator</h4>
            <p style={{ fontSize: '13px', color: '#555', margin: '4px 0' }}>
                Calculate your HRD Corp training grant eligibility based on the latest Allowable Cost Matrix (ACM).
                Supports SBL, HCC, and SLB schemes.
            </p>
            <p style={{ fontSize: '11px', color: '#999', marginTop: '8px' }}>Version 1.0.0</p>
        </div>

        <div style={{ background: '#e8f5e9', borderRadius: '10px', padding: '20px', marginBottom: '16px', border: '2px solid #2e7d32' }}>
            <h4 style={{ margin: '0 0 14px', color: '#1b5e20', fontSize: '14px' }}>Want to conduct a Training Needs Plan Analysis with AI Capabilities?</h4>
            <a href={AURA_WEBSITE_URL} target="_blank" rel="noopener noreferrer"
                style={{ display: 'block', background: '#2e7d32', color: '#fff', textAlign: 'center', padding: '12px', borderRadius: '8px', textDecoration: 'none', fontSize: '14px', fontWeight: '700', marginBottom: '14px' }}>
                Visit AURA
            </a>
            <div>
                <p style={{ fontSize: '12px', fontWeight: '600', color: '#333', marginBottom: '6px' }}>Register with AURA to get:</p>
                <p style={{ fontSize: '12px', color: '#555', margin: '3px 0' }}>  All schemes unlocked</p>
                <p style={{ fontSize: '12px', color: '#555', margin: '3px 0' }}>  TNA (Training Needs Analysis) tools</p>
                <p style={{ fontSize: '12px', color: '#555', margin: '3px 0' }}>  Many more schemes (ALAT, IT, CBT, FWT, etc.)</p>
            </div>
        </div>

        <div style={{ background: '#fff', borderRadius: '10px', padding: '20px', marginBottom: '16px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <h4 style={{ margin: '0 0 8px', color: '#333' }}>Contact</h4>
            <p style={{ fontSize: '13px', color: '#555', margin: '4px 0' }}>Millenium Resource Ltd</p>
            <p style={{ fontSize: '13px', color: '#555', margin: '4px 0' }}>support@milleniumrx.biz</p>
        </div>

        <p style={{ textAlign: 'center', fontSize: '11px', color: '#999', marginTop: '8px' }}>Powered by AURA</p>
    </div>
);

// ── Main Page ───────────────────────────────────────────
const HRDCalculatorPage = () => {
    const [feedbackOpen, setFeedbackOpen] = useState(false);
    const [activeTab, setActiveTab] = useState('calculator');

    return (
        <div style={{ minHeight: '100vh', background: '#f4f6f9' }}>

            {/* Banner */}
            <div style={{
                background: 'linear-gradient(135deg, #1a237e 0%, #283593 100%)',
                color: 'white',
                padding: '16px 32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <img src={appIcon} alt="Training Grant Estimator" style={{ height: '44px', width: '44px', borderRadius: '10px', objectFit: 'contain' }} />
                    <div>
                        <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '700' }}>
                            Training Grant Estimator
                        </h2>
                        <p style={{ margin: '2px 0 0', fontSize: '13px', opacity: 0.85 }}>
                            Allowable Cost Matrix (ACM) — Public Preview
                        </p>
                    </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <a href="/admin" style={{ color: 'white', textDecoration: 'none', fontSize: '13px', background: 'rgba(255,255,255,0.12)', padding: '7px 14px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.25)' }}>
                        Admin
                    </a>
                </div>
            </div>

            {/* Tab Navigation */}
            <div style={{
                background: '#fff',
                borderBottom: '1px solid #e0e0e0',
                display: 'flex',
                justifyContent: 'center',
                gap: '0',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            }}>
                {TABS.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        style={{
                            background: 'none',
                            border: 'none',
                            borderBottom: activeTab === tab.id ? '3px solid #2e7d32' : '3px solid transparent',
                            padding: '14px 24px',
                            fontSize: '14px',
                            fontWeight: activeTab === tab.id ? '700' : '500',
                            color: activeTab === tab.id ? '#1b5e20' : '#888',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            transition: 'all 0.2s',
                        }}
                    >
                        <span>{tab.icon}</span> {tab.label}
                    </button>
                ))}
            </div>

            {/* Logos row */}
            {activeTab === 'calculator' && (
                <div style={{ display: 'flex', alignItems: 'center', padding: '12px 32px' }}>
                    <img src={milleniumLogo} alt="Millenium" style={{ height: '80px', objectFit: 'contain' }} />
                    <div style={{ flex: 1 }} />
                    <img src={auraLogo} alt="AURA" style={{ height: '80px', objectFit: 'contain' }} />
                </div>
            )}

            {/* Tab Content */}
            <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '24px 16px' }}>
                {activeTab === 'calculator' && <CalculatorTab />}
                {activeTab === 'history' && <HistoryTab />}
                {activeTab === 'reference' && <ReferenceTab />}
                {activeTab === 'about' && <AboutTab />}
            </div>

            {/* Floating Feedback Button */}
            <button
                onClick={() => setFeedbackOpen(true)}
                style={{
                    position: 'fixed', bottom: '28px', right: '24px',
                    background: 'linear-gradient(135deg, #e65100, #f57c00)',
                    color: 'white', border: 'none', borderRadius: '50px',
                    padding: '13px 22px', fontSize: '14px', fontWeight: '700',
                    cursor: 'pointer', boxShadow: '0 4px 16px rgba(230,81,0,0.45)',
                    zIndex: 999, display: 'flex', alignItems: 'center', gap: '8px',
                }}
            >
                Give Feedback
            </button>

            {/* Feedback Modal */}
            {feedbackOpen && (
                <div onClick={() => setFeedbackOpen(false)}
                    style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
                    <div onClick={e => e.stopPropagation()}
                        style={{ background: 'white', borderRadius: '14px', width: '100%', maxWidth: '620px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
                        <div style={{ background: 'linear-gradient(135deg, #1a237e, #283593)', color: 'white', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700' }}>Share Your Feedback</h3>
                                <p style={{ margin: '2px 0 0', fontSize: '12px', opacity: 0.8 }}>Help us improve the HRD Corp Calculator</p>
                            </div>
                            <button onClick={() => setFeedbackOpen(false)}
                                style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', color: 'white', borderRadius: '50%', width: '32px', height: '32px', fontSize: '18px', cursor: 'pointer', lineHeight: '1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                ×
                            </button>
                        </div>
                        <iframe src={FORM_URL} title="Feedback Form" style={{ width: '100%', flex: 1, border: 'none', minHeight: '520px' }} loading="lazy">Loading form…</iframe>
                    </div>
                </div>
            )}
        </div>
    );
};

export default HRDCalculatorPage;
