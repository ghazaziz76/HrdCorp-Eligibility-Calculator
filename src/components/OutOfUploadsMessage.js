import React from 'react';
import { aiBlockedMessage } from '../utils/tgeAccess';

const OutOfUploadsMessage = ({ reason, platform = 'web' }) => {
    const m = aiBlockedMessage(reason, platform);
    return (
        <div style={{ background: '#fff8e1', border: '1px solid #ffe082', borderRadius: '10px', padding: '14px 16px', fontSize: '14px', color: '#5d4037' }}>
            <p style={{ margin: '0 0 6px', fontWeight: 700 }}>{m.title}</p>
            <p style={{ margin: 0 }}>{m.body}</p>
            {m.links.length > 0 && (
                <ul style={{ margin: '8px 0 0', paddingLeft: '18px' }}>
                    {m.links.map(l => (
                        <li key={l.href}><a href={l.href} style={{ color: '#1565c0' }}>{l.label}</a></li>
                    ))}
                </ul>
            )}
        </div>
    );
};

export default OutOfUploadsMessage;
