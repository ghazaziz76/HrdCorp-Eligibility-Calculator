import React from 'react';
import { calculateEligibility } from '../utils/HRDEligibilityCalculator';

// =============================================
// HRDCORP ELIGIBILITY CALCULATOR
// =============================================
export const HRDCorpCostCalculator = () => {
    // ── Scheme ────────────────────────────────────────────────
    const [scheme,          setScheme]          = React.useState('');   // '' = not yet chosen

    // ── Basic fields ──────────────────────────────────────────
    const [trainingType,    setTrainingType]    = React.useState('inhouse');
    const [trainerType,     setTrainerType]     = React.useState('external');
    const [venue,           setVenue]           = React.useState('employer_premises');
    const [courseCategory,  setCourseCategory]  = React.useState('general');
    const [duration,        setDuration]        = React.useState('full_day');
    const [days,            setDays]            = React.useState(1);
    const [elearningHours,  setElearningHours]  = React.useState(7);
    const [extraDays,       setExtraDays]       = React.useState(0);
    const [internalTrainerFromBranch, setInternalTrainerFromBranch] = React.useState(false);

    // ── Development Programme fields ──────────────────────────
    const [devLevel,              setDevLevel]              = React.useState('degree');  // 'phd'|'masters'|'degree'|'diploma'|'skm'
    const [skmLevel,              setSkmLevel]              = React.useState('3');       // SKM Level 1–5
    const [devLocation,           setDevLocation]           = React.useState('local');
    const [devPrivateInstitution, setDevPrivateInstitution] = React.useState(false);    // overseas private higher ed → 100% fee
    const [devMonths,             setDevMonths]             = React.useState(3);
    const [devFullTime,           setDevFullTime]           = React.useState(true);
    const [actualCourseFee,       setActualCourseFee]       = React.useState('');  // per pax, from brochure

    // ── Participant groups ────────────────────────────────────
    const [host,         setHost]         = React.useState({ pax: 10, kmDistance: 'under_100' });
    const [branches,     setBranches]     = React.useState([]);
    const [subsidiaries, setSubsidiaries] = React.useState([]);

    // ── Result ────────────────────────────────────────────────
    const [result, setResult] = React.useState(null);

    const isROT         = trainingType === 'rot_inhouse' || trainingType === 'rot_public';
    const isHotel       = venue === 'external_hotel' && !isROT;
    const isInhouse     = trainingType === 'inhouse' || trainingType === 'rot_inhouse';
    const isDevelopment = trainingType === 'development';

    // ── Branch handlers ───────────────────────────────────────
    const addBranch = () => setBranches(prev => [...prev, { label: `Branch ${prev.length + 1}`, pax: 2, kmDistance: 'under_100' }]);
    const removeBranch = (i) => setBranches(prev => prev.filter((_, idx) => idx !== i));
    const updateBranch = (i, field, val) => setBranches(prev => prev.map((b, idx) => idx === i ? { ...b, [field]: val } : b));

    // ── Subsidiary handlers ───────────────────────────────────
    const addSubsidiary = () => setSubsidiaries(prev => [...prev, { label: `Subsidiary ${prev.length + 1}`, pax: 5, kmDistance: 'under_100' }]);
    const removeSubsidiary = (i) => setSubsidiaries(prev => prev.filter((_, idx) => idx !== i));
    const updateSubsidiary = (i, field, val) => setSubsidiaries(prev => prev.map((s, idx) => idx === i ? { ...s, [field]: val } : s));

    const calculate = () => {
        const r = calculateEligibility({
            scheme,
            trainingType,
            trainerType,
            venue,
            courseCategory,
            duration,
            days:           parseInt(days)           || 1,
            extraDays:      parseInt(extraDays)      || 0,
            elearningHours: parseInt(elearningHours) || 7,
            internalTrainerFromBranch,
            host:        { ...host,  pax: parseInt(host.pax) || 0 },
            branches:    branches.map(b    => ({ ...b,    pax: parseInt(b.pax)    || 0 })),
            subsidiaries:subsidiaries.map(s => ({ ...s,   pax: parseInt(s.pax)   || 0 })),
            devLevel,
            skmLevel,
            devLocation,
            devPrivateInstitution,
            devMonths:             parseInt(devMonths)      || 3,
            devFullTime,
            actualCourseFeePerPax: parseFloat(actualCourseFee) || 0
        });
        setResult(r);
    };

    const iStyle  = { width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '14px', boxSizing: 'border-box' };
    const lStyle  = { fontSize: '13px', fontWeight: '600', color: '#555', marginBottom: '4px', display: 'block' };
    const rStyle  = { marginBottom: '16px' };

    const totalPax = (parseInt(host.pax) || 0)
        + branches.reduce((s, b) => s + (parseInt(b.pax) || 0), 0)
        + subsidiaries.reduce((s, c) => s + (parseInt(c.pax) || 0), 0);

    // ── Participant row renderer ───────────────────────────────
    const ParticipantRow = ({ label, pax, kmDistance, showKm, hint, onPaxChange, onKmChange, onRemove, badge, badgeColor }) => (
        <div style={{ background: '#fff', border: '1px solid #ddd', borderRadius: '8px', padding: '14px', marginBottom: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <span style={{ fontWeight: '700', fontSize: '13px', color: badgeColor || '#333' }}>
                    {label}
                    {badge && <span style={{ marginLeft: '8px', fontSize: '10px', background: badgeColor, color: '#fff', padding: '2px 8px', borderRadius: '10px' }}>{badge}</span>}
                </span>
                {onRemove && (
                    <button onClick={onRemove} style={{ background: 'none', border: '1px solid #e57373', color: '#e57373', padding: '2px 10px', borderRadius: '5px', cursor: 'pointer', fontSize: '12px' }}>Remove</button>
                )}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: showKm ? '1fr 1fr' : '1fr', gap: '12px' }}>
                <div>
                    <label style={lStyle}>Number of Pax</label>
                    <input type="number" min="0" style={iStyle} value={pax} onChange={e => onPaxChange(e.target.value)} />
                </div>
                {showKm && (
                    <div>
                        <label style={lStyle}>Distance to Venue</label>
                        <select style={iStyle} value={kmDistance} onChange={e => onKmChange(e.target.value)}>
                            <option value="under_100">&lt;100 km → RM250/day/pax</option>
                            <option value="over_100">≥100 km → RM500/day/pax</option>
                        </select>
                    </div>
                )}
            </div>
            {!showKm && hint !== false && <p style={{ fontSize: '11px', color: '#888', margin: '6px 0 0' }}>At own location — eligible for Meal Allowance (RM100/day)</p>}
        </div>
    );

    return (
        <div style={{ padding: '24px', maxWidth: '960px', margin: '0 auto' }}>
            <h2 style={{ color: '#2e7d32', marginBottom: '6px' }}>💰 HRDCorp Eligibility Calculator</h2>
            <p style={{ color: '#777', fontSize: '13px', marginBottom: '24px' }}>
                Based on HRDCorp Allowable Cost Matrix (ACM). Calculates maximum claimable cost per training.
            </p>

            {/* ── STEP 1: SCHEME SELECTION ──────────────────────── */}
            <div style={{ background: '#e8f5e9', border: '2px solid #2e7d32', borderRadius: '10px', padding: '20px', marginBottom: '20px' }}>
                <h4 style={{ margin: '0 0 12px', color: '#1b5e20' }}>Step 1 — Select Scheme</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                    {[
                        { value: 'hcc', label: 'HRD Corp Claimable Courses (HCC)', desc: 'HRD Corp pays TP directly. Accredited TPs only.' },
                        { value: 'sbl', label: 'Skim Bantuan Latihan (SBL)', desc: 'Employer pays upfront, claims reimbursement. Non-registered TPs allowed.' },
                        { value: 'slb', label: 'Skim Latihan Bersama (SLB)', desc: 'Joint in-house training across multiple employers. Cost shared by pax.' }
                    ].map(s => (
                        <div key={s.value} onClick={() => { setScheme(s.value); setResult(null);
                            // SLB: in-house only — reset if current type not in-house
                            if (s.value === 'slb' && trainingType !== 'inhouse' && trainingType !== 'rot_inhouse') {
                                setTrainingType('inhouse'); setBranches([]); setSubsidiaries([]);
                            }
                            // Development Programme only for HCC/SBL
                            if (s.value === 'slb' && trainingType === 'development') setTrainingType('inhouse');
                        }}
                            style={{ padding: '14px', borderRadius: '8px', cursor: 'pointer', border: scheme === s.value ? '2px solid #2e7d32' : '2px solid #ddd',
                                background: scheme === s.value ? '#c8e6c9' : '#fff', transition: 'all 0.15s' }}>
                            <div style={{ fontWeight: '700', fontSize: '13px', color: '#1b5e20', marginBottom: '4px' }}>{s.label}</div>
                            <div style={{ fontSize: '11px', color: '#555' }}>{s.desc}</div>
                        </div>
                    ))}
                </div>
            </div>

            {/* ── REST OF FORM (only shown after scheme is chosen) ── */}
            {scheme && (<>

            {/* ── BASIC FIELDS ─────────────────────────────────── */}
            <div style={{ background: '#f9fafb', borderRadius: '10px', padding: '24px', marginBottom: '20px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>

                    <div style={rStyle}>
                        <label style={lStyle}>Type of Training</label>
                        <select style={iStyle} value={trainingType} onChange={e => {
                            const t = e.target.value;
                            setTrainingType(t);
                            // Subsidiaries only for in-house / ROT-inhouse; branches cleared for some types
                            if (t !== 'inhouse' && t !== 'rot_inhouse') setSubsidiaries([]);
                            if (t === 'elearning' || t === 'overseas' || t === 'development') setBranches([]);
                            setResult(null);
                        }}>
                            <option value="inhouse">In-House (Face-to-Face)</option>
                            <option value="rot_inhouse">ROT — In-House (Employer-organised, Remote)</option>
                            {scheme !== 'slb' && <option value="rot_public">ROT — Public (TP-organised, Remote)</option>}
                            {scheme !== 'slb' && <option value="public">Local Public Training / Seminar / Conference</option>}
                            {scheme !== 'slb' && <option value="elearning">E-Learning</option>}
                            {scheme !== 'slb' && <option value="overseas">Overseas (Training / Seminar / Conference)</option>}
                            {scheme !== 'slb' && <option value="development">Development Programme (Academic / Technical / Vocational / Professional)</option>}
                        </select>
                    </div>

                    {!isDevelopment && (
                    <div style={rStyle}>
                        <label style={lStyle}>Course Category</label>
                        <select style={iStyle} value={courseCategory} onChange={e => setCourseCategory(e.target.value)}>
                            <option value="general">General Course</option>
                            <option value="focus_area">Focus Area (est. RM10,000/pax)</option>
                            <option value="industry_specific">Industry Specific (est. RM10,000/pax)</option>
                            <option value="certification">Professional Certification (est. RM10,000/pax)</option>
                        </select>
                    </div>
                    )}
                    {isDevelopment && (
                    <div style={rStyle}>
                        <label style={lStyle}>Programme Level</label>
                        <select style={iStyle} value={devLevel} onChange={e => { setDevLevel(e.target.value); setSkmLevel('3'); }}>
                            <option value="phd">PhD / Doctoral</option>
                            <option value="masters">Master's Programme</option>
                            <option value="degree">Degree</option>
                            <option value="diploma">Diploma</option>
                            <option value="skm">Sijil Kemahiran Malaysia (SKM)</option>
                        </select>
                    </div>
                    )}

                    {(trainingType === 'inhouse' || isDevelopment) && (
                        <div style={rStyle}>
                            <label style={lStyle}>Training Venue</label>
                            <select style={iStyle} value={venue} onChange={e => { setVenue(e.target.value); setResult(null); }}>
                                <option value="employer_premises">Employer's Own Premises</option>
                                <option value="external_hotel">{isDevelopment ? 'College / University / Training Institution' : 'Hotel / External Training Centre'}</option>
                            </select>
                        </div>
                    )}

                    {isInhouse && !isDevelopment && (
                        <div style={rStyle}>
                            <label style={lStyle}>Trainer Type</label>
                            <select style={iStyle} value={trainerType} onChange={e => setTrainerType(e.target.value)}>
                                <option value="internal">Internal Trainer</option>
                                <option value="external">External Trainer</option>
                                {trainingType === 'inhouse' && <option value="overseas">Overseas Trainer</option>}
                            </select>
                        </div>
                    )}

                    {trainingType === 'inhouse' && trainerType === 'internal' && (
                        <div style={{ ...rStyle, display: 'flex', alignItems: 'center', gap: '10px', paddingTop: '20px' }}>
                            <input type="checkbox" id="branchTrainer" checked={internalTrainerFromBranch}
                                onChange={e => setInternalTrainerFromBranch(e.target.checked)}
                                style={{ width: '16px', height: '16px', cursor: 'pointer', flexShrink: 0 }} />
                            <label htmlFor="branchTrainer" style={{ ...lStyle, marginBottom: 0, cursor: 'pointer', color: '#333' }}>
                                Internal trainer is from a branch (entitled to air ticket &amp; travel allowance)
                            </label>
                        </div>
                    )}


                    {trainingType !== 'elearning' && !isDevelopment && (
                        <div style={rStyle}>
                            <label style={lStyle}>Daily Duration</label>
                            <select style={iStyle} value={duration} onChange={e => setDuration(e.target.value)}>
                                <option value="full_day">Full Day (7 training hours)</option>
                                <option value="half_day">Half Day (4 training hours)</option>
                            </select>
                        </div>
                    )}

                    {trainingType !== 'elearning' && !isDevelopment && (
                        <div style={rStyle}>
                            <label style={lStyle}>Number of Training Days</label>
                            <input type="number" min="1" style={iStyle} value={days} onChange={e => setDays(e.target.value)} />
                        </div>
                    )}

                    {trainingType === 'elearning' && (
                        <div style={rStyle}>
                            <label style={lStyle}>Total E-Learning Hours</label>
                            <input type="number" min="1" style={iStyle} value={elearningHours}
                                onChange={e => setElearningHours(e.target.value)}
                                placeholder="e.g. 7, 10, 14..." />
                            <p style={{ fontSize: '11px', color: '#888', margin: '4px 0 0' }}>
                                ≤7 hrs: RM125/hr/pax. &gt;7 hrs: first 7hrs + additional half-day (4hrs=RM500) or full-day (7hrs=RM875) blocks per pax.
                            </p>
                        </div>
                    )}

                    {trainingType === 'overseas' && (
                        <div style={rStyle}>
                            <label style={lStyle}>Extra Travel Days for Daily Allowance</label>
                            <select style={iStyle} value={extraDays} onChange={e => setExtraDays(e.target.value)}>
                                <option value={0}>0 extra days (training days only)</option>
                                <option value={1}>+1 extra travel day</option>
                                <option value={2}>+2 extra travel days (max allowed)</option>
                            </select>
                            <p style={{ fontSize: '11px', color: '#888', margin: '4px 0 0' }}>
                                HRDCorp allows up to 2 extra days for international travel. Daily allowance = RM1,500 × pax × (training days + extra) × 50%.
                            </p>
                        </div>
                    )}

                    {/* ── DEVELOPMENT PROGRAMME FIELDS ── */}
                    {isDevelopment && (<>
                        {devLevel === 'skm' && (
                        <div style={rStyle}>
                            <label style={lStyle}>SKM Level</label>
                            <select style={iStyle} value={skmLevel} onChange={e => setSkmLevel(e.target.value)}>
                                <option value="1">SKM Level 1</option>
                                <option value="2">SKM Level 2</option>
                                <option value="3">SKM Level 3</option>
                                <option value="4">SKM Level 4</option>
                                <option value="5">SKM Level 5</option>
                            </select>
                        </div>
                        )}

                        <div style={rStyle}>
                            <label style={lStyle}>Study Location</label>
                            <select style={iStyle} value={devLocation} onChange={e => { setDevLocation(e.target.value); setDevPrivateInstitution(false); }}>
                                <option value="local">Local (Malaysia)</option>
                                <option value="overseas">Overseas</option>
                            </select>
                        </div>

                        {devLocation === 'overseas' && (
                        <div style={{ ...rStyle, display: 'flex', alignItems: 'flex-start', gap: '10px', paddingTop: '4px' }}>
                            <input type="checkbox" id="devPrivateInst" checked={devPrivateInstitution}
                                onChange={e => setDevPrivateInstitution(e.target.checked)}
                                style={{ width: '16px', height: '16px', cursor: 'pointer', flexShrink: 0, marginTop: '2px' }} />
                            <label htmlFor="devPrivateInst" style={{ ...lStyle, marginBottom: 0, cursor: 'pointer', color: '#333' }}>
                                Programme at a private higher education institution
                                <span style={{ display: 'block', fontSize: '11px', color: '#888', fontWeight: '400', marginTop: '2px' }}>
                                    ACM section iii — 100% course fee assistance (instead of 50%)
                                </span>
                            </label>
                        </div>
                        )}

                        <div style={rStyle}>
                            <label style={lStyle}>Programme Duration (Months)</label>
                            <input type="number" min="3" style={iStyle} value={devMonths}
                                onChange={e => setDevMonths(e.target.value)}
                                placeholder="Minimum 3 months" />
                            <p style={{ fontSize: '11px', color: '#888', margin: '4px 0 0' }}>
                                1 month = 30 training days &nbsp;·&nbsp;
                                {Math.max(3, parseInt(devMonths) || 3) * 30} training days total
                            </p>
                        </div>

                        <div style={{ ...rStyle, display: 'flex', alignItems: 'center', gap: '10px', paddingTop: '20px' }}>
                            <input type="checkbox" id="devFullTime" checked={devFullTime}
                                onChange={e => setDevFullTime(e.target.checked)}
                                style={{ width: '16px', height: '16px', cursor: 'pointer', flexShrink: 0 }} />
                            <label htmlFor="devFullTime" style={{ ...lStyle, marginBottom: 0, cursor: 'pointer', color: '#333' }}>
                                Full-Time Study (employee on study leave — no salary claimable)
                            </label>
                        </div>
                    </>)}
                </div>
            </div>

            {/* ── ACTUAL COURSE FEE (from brochure / offer letter) ── */}
            {(trainingType === 'public' || trainingType === 'rot_public' || trainingType === 'overseas' || isDevelopment || (isInhouse && subsidiaries.length > 0)) && (
                <div style={{ background: '#fff8e1', border: '1px solid #ffe082', borderRadius: '10px', padding: '20px', marginBottom: '24px' }}>
                    <h4 style={{ margin: '0 0 4px', color: '#e65100' }}>💰 Actual Course Fee (from Brochure / Offer Letter)</h4>
                    <p style={{ fontSize: '12px', color: '#795548', margin: '0 0 14px', lineHeight: '1.5' }}>
                        Enter the actual fee charged by the training provider.
                        If the actual fee is <strong>within the ACM ceiling</strong>, the system uses it as-is.
                        If it <strong>exceeds the ceiling</strong>, the system claims only up to the ACM limit and shows the <strong>deficit you must fund from your own budget</strong>.
                        Leave blank to use the ACM system rate only.
                    </p>
                    <div style={{ maxWidth: '380px' }}>
                        <label style={lStyle}>
                            {isDevelopment
                                ? 'Actual Programme Fee per Person (RM — total from brochure / offer letter)'
                                : 'Actual Course Fee per Pax (RM — total for the full course)'}
                        </label>
                        <input
                            type="number"
                            min="0"
                            step="1"
                            style={iStyle}
                            value={actualCourseFee}
                            onChange={e => setActualCourseFee(e.target.value)}
                            placeholder="e.g. 2500 (leave blank = use ACM rate)"
                        />
                    </div>
                </div>
            )}

            {/* ── PARTICIPANTS ──────────────────────────────────── */}
            <div style={{ background: '#f0f7ff', border: '1px solid #90caf9', borderRadius: '10px', padding: '20px', marginBottom: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <h4 style={{ margin: 0, color: '#1565c0' }}>👥 Participants</h4>
                    <span style={{ fontSize: '13px', fontWeight: '700', color: totalPax > 25 ? '#e65100' : '#2e7d32' }}>
                        Total: {totalPax} pax
                        {totalPax > 25 && <span style={{ marginLeft: '8px', fontSize: '11px', background: '#fff3e0', color: '#e65100', padding: '2px 8px', borderRadius: '4px' }}>⚠ audit risk</span>}
                    </span>
                </div>
                <p style={{ fontSize: '12px', color: '#666', margin: '0 0 14px' }}>
                    {scheme === 'slb'
                        ? <><strong>Branches</strong> = same company departments (share host's proportional cost). <strong>Other Employers</strong> = separate participating companies (public rate per pax applies).</>
                        : <><strong>Branches</strong> = same company (in-house rate stays). <strong>Subsidiaries</strong> = separate companies (triggers public rate for course fee).</>
                    }
                </p>

                {/* Host Company */}
                <p style={{ fontSize: '12px', fontWeight: '700', color: '#1565c0', margin: '0 0 6px' }}>HOST COMPANY</p>
                <ParticipantRow
                    label={trainingType === 'elearning' ? 'Total Employees' : 'Host Company'}
                    badge="Host"
                    badgeColor="#1565c0"
                    pax={host.pax}
                    kmDistance={host.kmDistance}
                    showKm={!isROT && (isHotel || trainingType === 'public')}
                    hint={trainingType === 'elearning' || trainingType === 'rot_public' ? false : undefined}
                    onPaxChange={v => setHost(h => ({ ...h, pax: v }))}
                    onKmChange={v  => setHost(h => ({ ...h, kmDistance: v }))}
                />

                {/* Branches — not applicable for e-learning, overseas or development */}
                {trainingType !== 'elearning' && trainingType !== 'overseas' && trainingType !== 'development' && branches.length > 0 && (
                    <p style={{ fontSize: '12px', fontWeight: '700', color: '#2e7d32', margin: '10px 0 6px' }}>BRANCHES (same company — in-house rate)</p>
                )}
                {trainingType !== 'elearning' && trainingType !== 'overseas' && trainingType !== 'development' && branches.map((b, i) => (
                    <ParticipantRow key={i}
                        label={b.label}
                        badge="Branch"
                        badgeColor="#2e7d32"
                        pax={b.pax}
                        kmDistance={b.kmDistance}
                        showKm={!isROT}
                        hint={isROT ? false : undefined}
                        onPaxChange={v => updateBranch(i, 'pax', v)}
                        onKmChange={v  => updateBranch(i, 'kmDistance', v)}
                        onRemove={() => removeBranch(i)}
                    />
                ))}

                {/* Subsidiaries — In-House / ROT only */}
                {isInhouse && subsidiaries.length > 0 && (
                    <p style={{ fontSize: '12px', fontWeight: '700', color: '#e65100', margin: '10px 0 6px' }}>
                        {scheme === 'slb' ? 'OTHER PARTICIPATING EMPLOYERS (separate companies — public rate applies)' : 'SUBSIDIARIES (separate companies — public rate applies)'}
                    </p>
                )}
                {isInhouse && subsidiaries.map((s, i) => (
                    <ParticipantRow key={i}
                        label={s.label}
                        badge="Subsidiary"
                        badgeColor="#e65100"
                        pax={s.pax}
                        kmDistance={s.kmDistance}
                        showKm={!isROT}
                        hint={isROT ? false : undefined}
                        onPaxChange={v => updateSubsidiary(i, 'pax', v)}
                        onKmChange={v  => updateSubsidiary(i, 'kmDistance', v)}
                        onRemove={() => removeSubsidiary(i)}
                    />
                ))}

                {/* Add buttons */}
                <div style={{ display: 'flex', gap: '12px', marginTop: '14px' }}>
                    {trainingType !== 'elearning' && trainingType !== 'overseas' && trainingType !== 'development' && (
                        <button onClick={addBranch} style={{ background: '#2e7d32', color: '#fff', border: 'none', padding: '7px 18px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>
                            + Add Branch
                        </button>
                    )}
                    {isInhouse && (
                        <button onClick={addSubsidiary} style={{ background: '#e65100', color: '#fff', border: 'none', padding: '7px 18px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>
                            {scheme === 'slb' ? '+ Add Participating Employer' : '+ Add Subsidiary'}
                        </button>
                    )}
                </div>
                {!isInhouse && (
                    <p style={{ fontSize: '11px', color: '#888', margin: '8px 0 0' }}>
                        ℹ️ Subsidiaries are only applicable for In-House training where the company organises the programme.
                    </p>
                )}
            </div>

            {/* ── CALCULATE BUTTON ─────────────────────────────── */}
            <button onClick={calculate} style={{
                background: '#2e7d32', color: 'white', border: 'none',
                padding: '12px 36px', borderRadius: '8px', fontSize: '15px',
                fontWeight: '700', cursor: 'pointer', marginBottom: '28px'
            }}>
                🧮 Calculate Eligibility
            </button>

            {/* ── RESULTS ──────────────────────────────────────── */}
            {result && (
                <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: '10px', padding: '24px' }}>
                    <h3 style={{ color: '#2e7d32', marginBottom: '16px' }}>📋 Eligibility Breakdown</h3>

                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', marginBottom: '20px' }}>
                        <thead>
                            <tr style={{ background: '#f1f8e9' }}>
                                <th style={{ textAlign: 'left', padding: '10px 12px', color: '#2e7d32', fontWeight: '700' }}>Component</th>
                                <th style={{ textAlign: 'left', padding: '10px 12px', color: '#2e7d32', fontWeight: '700' }}>Basis / Notes</th>
                                <th style={{ textAlign: 'right', padding: '10px 12px', color: '#2e7d32', fontWeight: '700' }}>Max Claimable</th>
                            </tr>
                        </thead>
                        <tbody>
                            {result.items.map((row, i) => (
                                <React.Fragment key={i}>
                                    <tr style={{ borderBottom: '1px solid #f0f0f0', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                                        <td style={{ padding: '10px 12px', fontWeight: '600', color: '#333' }}>
                                            {row.label}
                                            {row.isEstimate && <span style={{ marginLeft: '6px', fontSize: '11px', color: '#f57c00', background: '#fff3e0', padding: '1px 6px', borderRadius: '4px' }}>est.</span>}
                                        </td>
                                        <td style={{ padding: '10px 12px', color: '#666', fontSize: '12px' }}>{row.note}</td>
                                        <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '700', color: '#1b5e20' }}>
                                            {row.entitledCount != null
                                                ? `${row.entitledCount} person(s) — actual cost`
                                                : row.amount != null
                                                    ? `RM ${row.amount.toLocaleString()}`
                                                    : 'As per quotation'}
                                        </td>
                                    </tr>
                                    {row.perCompany && row.perCompany.length > 1 && row.perCompany.map((pc, j) => (
                                        <tr key={`pc-${i}-${j}`} style={{ background: '#f9f9f9', borderBottom: '1px solid #f5f5f5' }}>
                                            <td style={{ padding: '6px 12px 6px 30px', color: '#888', fontSize: '12px' }}>↳ {pc.label}</td>
                                            <td style={{ padding: '6px 12px', color: '#999', fontSize: '11px' }}>{pc.note}</td>
                                            <td style={{ padding: '6px 12px', textAlign: 'right', color: '#555', fontSize: '12px', fontWeight: '600' }}>RM {pc.amount.toLocaleString()}</td>
                                        </tr>
                                    ))}
                                </React.Fragment>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr style={{ background: '#e8f5e9', borderTop: '2px solid #4CAF50' }}>
                                <td colSpan="2" style={{ padding: '12px', fontWeight: '700', color: '#1b5e20', fontSize: '15px' }}>
                                    Total Maximum Claimable
                                    <span style={{ fontSize: '11px', fontWeight: '400', marginLeft: '8px', color: '#666' }}>(excl. air ticket &amp; chartered transport — actual cost)</span>
                                </td>
                                <td style={{ padding: '12px', textAlign: 'right', fontWeight: '800', color: '#1b5e20', fontSize: '17px' }}>
                                    RM {result.totalClaimable.toLocaleString()}
                                </td>
                            </tr>
                        </tfoot>
                    </table>

                    {/* Air Ticket Banner */}
                    {result.airTicketEntitled > 0 && (
                        <div style={{ background: '#e3f2fd', border: '1px solid #90caf9', borderRadius: '8px', padding: '14px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ fontSize: '20px' }}>✈️</span>
                            <p style={{ margin: 0, color: '#0d47a1', fontWeight: '600', fontSize: '14px' }}>
                                Air Ticket: <strong>{result.airTicketEntitled} person(s)</strong> entitled — submit actual airfare cost with ticket stub / e-Ticket / travel agent invoice.
                            </p>
                        </div>
                    )}

                    {/* Warnings & Notes */}
                    {result.warnings.length > 0 && (
                        <div style={{ background: '#fffde7', border: '1px solid #f9a825', borderRadius: '8px', padding: '16px' }}>
                            <p style={{ fontWeight: '700', color: '#f57f17', marginBottom: '8px', fontSize: '13px' }}>📌 Notes &amp; Reminders:</p>
                            {result.warnings.map((w, i) => (
                                <p key={i} style={{ color: '#555', fontSize: '12px', margin: '4px 0' }}>{w}</p>
                            ))}
                        </div>
                    )}
                </div>
            )}
            </>)}
        </div>
    );
};
