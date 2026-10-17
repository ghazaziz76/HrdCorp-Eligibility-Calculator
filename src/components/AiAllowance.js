import React, { useEffect, useState } from 'react';
import { fetchAccess, uploadsLeftText, clearStoredActivation, AI_ALLOWANCE_EVENT } from '../utils/tgeAccess';

// Clears the stored code/token and reopens the activation gate. The new code
// replaces the old one ("highest limit, not the sum").
export const DifferentCodeLink = ({ onReopenGate }) => {
    const reopen = () => {
        clearStoredActivation();
        if (onReopenGate) onReopenGate();
        else window.location.reload();
    };
    return (
        <button
            type="button"
            onClick={reopen}
            style={{ background: 'none', border: 'none', padding: 0, color: '#1565c0', fontSize: '12px', textDecoration: 'underline', cursor: 'pointer' }}
        >
            Have a different code?
        </button>
    );
};

const AiAllowance = ({ code, onReopenGate }) => {
    const [ai, setAi] = useState(null);

    useEffect(() => {
        let alive = true;
        if (code) {
            fetchAccess(code).then(a => { if (alive && a) setAi(a.ai); });
        }
        return () => { alive = false; };
    }, [code]);

    // Refresh after each brochure upload (BrochureUpload announces the new allowance).
    useEffect(() => {
        const onChange = (e) => { if (e && e.detail) setAi(e.detail); };
        window.addEventListener(AI_ALLOWANCE_EVENT, onChange);
        return () => window.removeEventListener(AI_ALLOWANCE_EVENT, onChange);
    }, []);

    return (
        <div style={{ fontSize: '13px', color: '#555' }}>
            {ai && ai.limit ? <span style={{ marginRight: '10px' }}>{uploadsLeftText(ai)}</span> : null}
            <DifferentCodeLink onReopenGate={onReopenGate} />
        </div>
    );
};

export default AiAllowance;
