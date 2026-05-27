import React, { useState, useEffect, useRef } from 'react';

const API_BASE = window.location.origin;

const ActivationGate = ({ children }) => {
    const [activated, setActivated] = useState(false);
    const [checking, setChecking] = useState(true);
    const [code, setCode] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [qrMode, setQrMode] = useState(false);
    const [qrSession, setQrSession] = useState(null);
    const [qrPolling, setQrPolling] = useState(false);
    const pollRef = useRef(null);

    // Check if already activated on mount
    useEffect(() => {
        // Local development bypass: skip the activation gate when running the
        // dev server (`npm start`). Production builds (`npm run build`) — which
        // is what deploys to the web and is wrapped into the mobile app — set
        // NODE_ENV to 'production', so the gate stays fully active when deployed.
        if (process.env.NODE_ENV === 'development') {
            setActivated(true);
            setChecking(false);
            return;
        }
        const token = localStorage.getItem('hrd_activation_token');
        if (token) {
            setActivated(true);
        }
        setChecking(false);
    }, []);

    // Cleanup polling on unmount
    useEffect(() => {
        return () => {
            if (pollRef.current) clearInterval(pollRef.current);
        };
    }, []);

    const handleActivate = async () => {
        const trimmed = code.trim().toUpperCase();
        if (!trimmed) {
            setError('Please enter your activation code');
            return;
        }
        if (!/^HRD-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(trimmed)) {
            setError('Invalid format. Expected: HRD-XXXX-XXXX-XXXX');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const res = await fetch(`${API_BASE}/api/employer/validate-code`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: trimmed }),
            });
            const data = await res.json();
            if (data.success) {
                localStorage.setItem('hrd_activation_token', data.data.session_token);
                localStorage.setItem('hrd_activation_code', trimmed);
                setActivated(true);
            } else {
                setError(data.message || 'Invalid activation code');
            }
        } catch {
            setError('Network error. Please try again.');
        }
        setLoading(false);
    };

    const startQrSession = async () => {
        setQrMode(true);
        setError('');
        try {
            const res = await fetch(`${API_BASE}/api/employer/generate-qr-session`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            });
            const data = await res.json();
            if (data.success) {
                setQrSession(data.data);
                // Start polling for activation
                setQrPolling(true);
                pollRef.current = setInterval(async () => {
                    try {
                        const check = await fetch(
                            `${API_BASE}/api/employer/check-session?session_token=${data.data.session_token}`
                        );
                        const result = await check.json();
                        if (result.success) {
                            clearInterval(pollRef.current);
                            localStorage.setItem('hrd_activation_token', data.data.session_token);
                            setActivated(true);
                        }
                    } catch {}
                }, 3000);
            }
        } catch {
            setError('Failed to generate QR session');
        }
    };

    const stopQrSession = () => {
        setQrMode(false);
        setQrSession(null);
        setQrPolling(false);
        if (pollRef.current) clearInterval(pollRef.current);
    };

    if (checking) return null;
    if (activated) return children;

    // Build QR payload for mobile app to scan
    const qrPayload = qrSession
        ? JSON.stringify({
            session_token: qrSession.session_token,
            activation_url: qrSession.activation_url,
        })
        : '';

    return (
        <div style={{ minHeight: '100vh', background: '#f4f6f9', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
            <div style={{ background: '#fff', borderRadius: '16px', padding: '40px', maxWidth: '480px', width: '100%', boxShadow: '0 8px 32px rgba(0,0,0,0.1)' }}>
                <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                    <div style={{ fontSize: '48px', marginBottom: '12px' }}>🔐</div>
                    <h2 style={{ margin: '0 0 8px', color: '#1b5e20', fontSize: '22px' }}>Activate HRD Grant Calculator</h2>
                    <p style={{ margin: 0, color: '#666', fontSize: '14px' }}>
                        Purchase the app on Google Play, then enter your activation code here.
                    </p>
                </div>

                {!qrMode ? (
                    <>
                        {/* Manual code entry */}
                        <div style={{ marginBottom: '16px' }}>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#333', marginBottom: '6px' }}>
                                Activation Code
                            </label>
                            <input
                                type="text"
                                value={code}
                                onChange={e => { setCode(e.target.value.toUpperCase()); setError(''); }}
                                placeholder="HRD-XXXX-XXXX-XXXX"
                                maxLength={19}
                                style={{
                                    width: '100%', padding: '14px', fontSize: '18px', fontFamily: 'monospace',
                                    fontWeight: '700', letterSpacing: '2px', textAlign: 'center',
                                    border: `2px solid ${error ? '#e53935' : '#e0e0e0'}`, borderRadius: '10px',
                                    outline: 'none', boxSizing: 'border-box',
                                    transition: 'border-color 0.2s',
                                }}
                                onFocus={e => { if (!error) e.target.style.borderColor = '#2e7d32'; }}
                                onBlur={e => { if (!error) e.target.style.borderColor = '#e0e0e0'; }}
                                onKeyDown={e => { if (e.key === 'Enter') handleActivate(); }}
                            />
                        </div>

                        {error && (
                            <p style={{ color: '#e53935', fontSize: '13px', margin: '0 0 12px', textAlign: 'center' }}>{error}</p>
                        )}

                        <button
                            onClick={handleActivate}
                            disabled={loading}
                            style={{
                                width: '100%', padding: '14px', background: '#2e7d32', color: '#fff',
                                border: 'none', borderRadius: '10px', fontSize: '15px', fontWeight: '700',
                                cursor: loading ? 'wait' : 'pointer', opacity: loading ? 0.7 : 1,
                                marginBottom: '16px',
                            }}
                        >
                            {loading ? 'Verifying...' : 'Activate'}
                        </button>

                        <div style={{ textAlign: 'center' }}>
                            <button
                                onClick={startQrSession}
                                style={{
                                    background: 'none', border: '2px solid #1565c0', color: '#1565c0',
                                    borderRadius: '10px', padding: '12px 24px', fontSize: '14px',
                                    fontWeight: '600', cursor: 'pointer', width: '100%',
                                }}
                            >
                                Or Scan QR with Mobile App
                            </button>
                        </div>
                    </>
                ) : (
                    <>
                        {/* QR Code display */}
                        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                            {qrSession ? (
                                <>
                                    <div style={{
                                        background: '#fff', border: '2px solid #e0e0e0', borderRadius: '12px',
                                        padding: '20px', display: 'inline-block', marginBottom: '16px',
                                    }}>
                                        <img
                                            src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrPayload)}`}
                                            alt="QR Code"
                                            style={{ width: '200px', height: '200px' }}
                                        />
                                    </div>
                                    <p style={{ fontSize: '14px', color: '#333', fontWeight: '600', margin: '0 0 6px' }}>
                                        Scan this QR code with the mobile app
                                    </p>
                                    <p style={{ fontSize: '12px', color: '#999', margin: '0 0 4px' }}>
                                        Open the app {'>'} About {'>'} Activate on Web {'>'} Scan QR
                                    </p>
                                    {qrPolling && (
                                        <p style={{ fontSize: '13px', color: '#1565c0', margin: '12px 0 0' }}>
                                            Waiting for activation...
                                        </p>
                                    )}
                                </>
                            ) : (
                                <p style={{ color: '#666' }}>Generating QR code...</p>
                            )}
                        </div>

                        {error && (
                            <p style={{ color: '#e53935', fontSize: '13px', margin: '0 0 12px', textAlign: 'center' }}>{error}</p>
                        )}

                        <button
                            onClick={stopQrSession}
                            style={{
                                width: '100%', padding: '12px', background: 'none', border: '2px solid #999',
                                color: '#666', borderRadius: '10px', fontSize: '14px', fontWeight: '600',
                                cursor: 'pointer',
                            }}
                        >
                            Back to Code Entry
                        </button>
                    </>
                )}

                <div style={{ marginTop: '24px', padding: '16px', background: '#f5f5f5', borderRadius: '10px' }}>
                    <p style={{ fontSize: '12px', color: '#888', margin: '0 0 4px', fontWeight: '600' }}>
                        Don't have a code?
                    </p>
                    <p style={{ fontSize: '12px', color: '#999', margin: 0 }}>
                        Download the HRD Grant Calculator from Google Play. Your activation code will be generated after purchase.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default ActivationGate;
