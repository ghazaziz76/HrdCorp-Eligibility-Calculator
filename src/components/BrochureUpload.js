import React, { useEffect, useRef, useState } from 'react';
import { fetchAccess, uploadsLeftText, uploadBrochure, announceAiAllowance } from '../utils/tgeAccess';
import OutOfUploadsMessage from './OutOfUploadsMessage';

export const ACCEPT = '.pdf,.docx,.jpg,.jpeg,.png,.webp';
const ALLOWED_EXT = ACCEPT.split(',');
const MAX_BYTES = 10 * 1024 * 1024;
// The AI rejects images over 5 MB once encoded, so photos are capped lower than other files.
const IMAGE_EXT = ['.jpg', '.jpeg', '.png', '.webp'];
const MAX_IMAGE_BYTES = 3.5 * 1024 * 1024;
const FIELD_KEYS = ['trainingProgrammeName', 'trainingType', 'venue', 'days', 'duration', 'actualCourseFee'];

const MSG = {
    tooBig: 'File too large (max 10 MB)',
    imageTooBig: 'Image too large — max 3.5 MB; please use a smaller photo or a PDF',
    noCode: 'Please enter your activation code again',
    readFailed: "We couldn't read the details from this file. It didn't use up an upload.",
    unsupported: 'Please upload a PDF, Word (.docx) or image (JPG, PNG, WEBP) file.',
    unavailable: "Brochure reading isn't available right now. Please fill in the form yourself.",
    aiUnavailable: 'Brochure reading is temporarily unavailable. Please try again later — this did not use one of your uploads.',
    check: 'Please check these values. Fill in the rest (pax, trainers…) yourself.',
    sst: 'Fee may include SST, please check',
};

function readCode() {
    try { return localStorage.getItem('hrd_activation_code') || ''; } catch { return ''; }
}

function errorText(r) {
    const { status, reason } = r;
    if (status === 404) return MSG.noCode; // "Code not found"
    if (status === 422) return MSG.readFailed;
    if (status === 413) {
        const image = reason === 'image_too_large' || /image/i.test(r.message || '');
        return image ? MSG.imageTooBig : MSG.tooBig;
    }
    if (status === 400) return MSG.unsupported;
    if (status === 503 && reason === 'ai_unavailable') return MSG.aiUnavailable;
    return MSG.unavailable;
}

// Upload one brochure; the server's AI reads six calculator fields from it.
// state: idle | reading | done | error | blocked
// onStart(): called when the read starts. onFields(fields) may return
// { feeUsed, notice }: feeUsed false hides the SST warning; notice is shown under the result.
// hideSst: the parent hides the SST warning (e.g. the user edited the fee box).
const BrochureUpload = ({ onFields, onStart, hideSst = false, platform = 'web' }) => {
    const [ai, setAi] = useState(null);
    const [state, setState] = useState('idle');
    const [message, setMessage] = useState('');
    const [reason, setReason] = useState('');
    const [sst, setSst] = useState(false);
    const [notice, setNotice] = useState('');
    const inputRef = useRef(null);
    const alive = useRef(true);
    // The reply arrives later: always call the callbacks of the latest render.
    const onFieldsRef = useRef(onFields);
    onFieldsRef.current = onFields;
    const onStartRef = useRef(onStart);
    onStartRef.current = onStart;

    useEffect(() => {
        alive.current = true;
        const code = readCode();
        if (code) fetchAccess(code).then(a => { if (alive.current && a && a.ai) setAi(a.ai); });
        return () => { alive.current = false; };
    }, []);

    const fail = (text) => { setState('error'); setMessage(text); };

    const onPick = async (e) => {
        const file = e.target.files && e.target.files[0];
        if (inputRef.current) inputRef.current.value = ''; // allow picking the same file again
        if (!file) return;
        setSst(false);
        setNotice('');

        const name = (file.name || '').toLowerCase();
        if (!ALLOWED_EXT.some(ext => name.endsWith(ext))) return fail(MSG.unsupported);
        if (file.size > MAX_BYTES) return fail(MSG.tooBig);
        if (IMAGE_EXT.some(ext => name.endsWith(ext)) && file.size > MAX_IMAGE_BYTES) return fail(MSG.imageTooBig);
        const code = readCode();
        if (!code) return fail(MSG.noCode);

        setState('reading');
        setMessage('');
        if (onStartRef.current) onStartRef.current();
        const r = await uploadBrochure(file, code);
        if (!alive.current) return;
        if (r.ai) { setAi(r.ai); announceAiAllowance(r.ai); }
        if (r.ok) {
            const fields = {};
            FIELD_KEYS.forEach(k => { fields[k] = r.fields[k] === undefined ? null : r.fields[k]; });
            const out = onFieldsRef.current ? onFieldsRef.current(fields) : null;
            const feeUsed = !(out && out.feeUsed === false);
            setSst(feeUsed && r.fields.feeMayIncludeSst === true);
            setNotice((out && out.notice) || '');
            setState('done');
            return;
        }
        if (r.status === 403 || r.status === 429) {
            setReason(r.reason || (r.status === 429 ? 'limit_reached' : ''));
            setState('blocked');
            return;
        }
        fail(errorText(r));
    };

    return (
        <div style={{ background: '#fff', border: '1px solid #c8e6c9', borderRadius: '10px', padding: '16px 20px', marginBottom: '16px' }}>
            <label htmlFor="brochure-upload" style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#1b5e20', marginBottom: '4px' }}>
                📄 Upload brochure to fill in the form
            </label>
            {ai && ai.limit ? (
                <p style={{ fontSize: '12px', color: '#555', margin: '0 0 8px' }}>{uploadsLeftText(ai)}</p>
            ) : null}
            <input
                id="brochure-upload"
                ref={inputRef}
                type="file"
                accept={ACCEPT}
                onChange={onPick}
                disabled={state === 'reading'}
                style={{ fontSize: '13px' }}
            />
            <p style={{ fontSize: '11px', color: '#888', margin: '6px 0 0' }}>
                PDF, Word (.docx) or image (JPG, PNG, WEBP), max 10 MB (images max 3.5 MB).
            </p>
            {state === 'reading' && (
                <p style={{ fontSize: '13px', color: '#1565c0', margin: '10px 0 0' }}>Reading your brochure…</p>
            )}
            {state === 'done' && (
                <div style={{ fontSize: '13px', color: '#2e7d32', margin: '10px 0 0' }}>
                    <p style={{ margin: 0 }}>{MSG.check}</p>
                    {sst && !hideSst && <p style={{ margin: '4px 0 0', color: '#e65100' }}>{MSG.sst}</p>}
                    {notice && <p data-testid="brochure-notice" style={{ margin: '4px 0 0', color: '#e65100' }}>{notice}</p>}
                </div>
            )}
            {state === 'error' && (
                <p style={{ fontSize: '13px', color: '#c62828', margin: '10px 0 0' }}>{message}</p>
            )}
            {state === 'blocked' && (
                <div style={{ marginTop: '10px' }}>
                    <OutOfUploadsMessage reason={reason} platform={platform} />
                </div>
            )}
        </div>
    );
};

export default BrochureUpload;
