import React, { useState } from 'react';
import { HRDCorpCostCalculator } from './HRDCorpCostCalculator';

const FORM_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSfYgJEpz_b9HthuFVrAv_3Ep7q2YtXTusQlD7ZUEzvhIHXpqg/viewform?usp=dialog';

const HRDCalculatorPage = () => {
    const [feedbackOpen, setFeedbackOpen] = useState(false);

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
                <div>
                    <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '700' }}>
                        🏛️ HRD Corp Eligibility Calculator
                    </h2>
                    <p style={{ margin: '2px 0 0', fontSize: '13px', opacity: 0.85 }}>
                        Allowable Cost Matrix (ACM) — Public Preview · No login required
                    </p>
                </div>
                <a
                    href="/"
                    style={{
                        color: 'white',
                        textDecoration: 'none',
                        fontSize: '13px',
                        background: 'rgba(255,255,255,0.15)',
                        padding: '7px 16px',
                        borderRadius: '20px',
                        border: '1px solid rgba(255,255,255,0.3)'
                    }}
                >
                    ← Back to Login
                </a>
            </div>

            {/* Calculator */}
            <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '24px 16px' }}>
                <HRDCorpCostCalculator />
            </div>

            {/* ── Floating Feedback Button ── */}
            <button
                onClick={() => setFeedbackOpen(true)}
                style={{
                    position: 'fixed',
                    bottom: '28px',
                    right: '24px',
                    background: 'linear-gradient(135deg, #e65100, #f57c00)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '50px',
                    padding: '13px 22px',
                    fontSize: '14px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    boxShadow: '0 4px 16px rgba(230,81,0,0.45)',
                    zIndex: 999,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    letterSpacing: '0.3px'
                }}
            >
                💬 Give Feedback
            </button>

            {/* ── Feedback Modal ── */}
            {feedbackOpen && (
                <div
                    onClick={() => setFeedbackOpen(false)}
                    style={{
                        position: 'fixed',
                        inset: 0,
                        background: 'rgba(0,0,0,0.55)',
                        zIndex: 1000,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '16px'
                    }}
                >
                    <div
                        onClick={e => e.stopPropagation()}
                        style={{
                            background: 'white',
                            borderRadius: '14px',
                            width: '100%',
                            maxWidth: '620px',
                            maxHeight: '90vh',
                            display: 'flex',
                            flexDirection: 'column',
                            overflow: 'hidden',
                            boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
                        }}
                    >
                        {/* Modal header */}
                        <div style={{
                            background: 'linear-gradient(135deg, #1a237e, #283593)',
                            color: 'white',
                            padding: '16px 20px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            flexShrink: 0
                        }}>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700' }}>
                                    💬 Share Your Feedback
                                </h3>
                                <p style={{ margin: '2px 0 0', fontSize: '12px', opacity: 0.8 }}>
                                    Help us improve the HRD Corp Calculator
                                </p>
                            </div>
                            <button
                                onClick={() => setFeedbackOpen(false)}
                                style={{
                                    background: 'rgba(255,255,255,0.15)',
                                    border: '1px solid rgba(255,255,255,0.3)',
                                    color: 'white',
                                    borderRadius: '50%',
                                    width: '32px',
                                    height: '32px',
                                    fontSize: '18px',
                                    cursor: 'pointer',
                                    lineHeight: '1',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}
                            >
                                ×
                            </button>
                        </div>

                        {/* Embedded Google Form */}
                        <iframe
                            src={FORM_URL}
                            title="Feedback Form"
                            style={{
                                width: '100%',
                                flex: 1,
                                border: 'none',
                                minHeight: '520px'
                            }}
                            loading="lazy"
                        >
                            Loading form…
                        </iframe>
                    </div>
                </div>
            )}

        </div>
    );
};

export default HRDCalculatorPage;
