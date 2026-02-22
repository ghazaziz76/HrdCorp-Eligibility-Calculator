import React from 'react';
import { calculateEligibility } from '../utils/HRDEligibilityCalculator';
import { useACMData } from '../context/ACMDataContext';

// =============================================
// HRDCORP ELIGIBILITY CALCULATOR
// =============================================
export const HRDCorpCostCalculator = () => {
    const { rates: liveRates, claimDocs: liveClaimDocs, version: liveVersion } = useACMData() || {};
    const guideEdition = liveVersion?.acm_guide_edition || 'September 2025';
    const tableEdition = liveVersion?.acm_table_edition || 'November 2025';
    // ── Scheme ────────────────────────────────────────────────
    const [scheme,          setScheme]          = React.useState('');   // '' = not yet chosen

    // ── Basic fields ──────────────────────────────────────────
    const [trainingType,    setTrainingType]    = React.useState('inhouse');
    const [trainerType,     setTrainerType]     = React.useState('external');
    const [numberOfTrainers, setNumberOfTrainers] = React.useState(1);
    const [venue,           setVenue]           = React.useState('employer_premises');
    const [courseCategory,  setCourseCategory]  = React.useState('general_non_technical');
    const [duration,        setDuration]        = React.useState('full_day');
    const [days,            setDays]            = React.useState(1);
    const [elearningHours,  setElearningHours]  = React.useState(7);
    const [extraDays,       setExtraDays]       = React.useState(0);
    const [internalTrainerFromBranch, setInternalTrainerFromBranch] = React.useState(false);
    const [numberOfSpeakers, setNumberOfSpeakers] = React.useState(2);
    const [hasLTM,          setHasLTM]          = React.useState(false);
    const [ltmActualCost,   setLtmActualCost]   = React.useState('');

    // ── Development Programme fields ──────────────────────────
    const [devLevel,              setDevLevel]              = React.useState('degree');
    const [skmLevel,              setSkmLevel]              = React.useState('3');
    const [devLocation,           setDevLocation]           = React.useState('local');
    const [devPrivateInstitution, setDevPrivateInstitution] = React.useState(false);
    const [devMonths,             setDevMonths]             = React.useState(3);
    const [devFullTime,           setDevFullTime]           = React.useState(true);
    const [actualCourseFee,       setActualCourseFee]       = React.useState('');

    // ── Participant groups ────────────────────────────────────
    const [host,         setHost]         = React.useState({ pax: 10, kmDistance: 'under_100' });
    const [branches,     setBranches]     = React.useState([]);
    const [subsidiaries, setSubsidiaries] = React.useState([]);

    // ── Result ────────────────────────────────────────────────
    const [result,          setResult]          = React.useState(null);
    const [blockError,      setBlockError]      = React.useState(null);

    // ── Derived flags (mirror engine logic) ──────────────────
    const isCoachingMentoring = trainingType === 'coaching_mentoring';
    const isMobileElearning   = trainingType === 'mobile_elearning';
    const isLocalSeminar      = trainingType === 'seminar_conference';
    const isOverseasSeminar   = trainingType === 'overseas_seminar';
    const isSeminar           = isLocalSeminar || isOverseasSeminar;
    const isElearning         = trainingType === 'elearning' || isMobileElearning;
    const isDevelopment       = trainingType === 'development';
    const isROTInhouse        = trainingType === 'rot_inhouse';
    const isROTPublic         = trainingType === 'rot_public';
    const isROT               = isROTInhouse || isROTPublic;
    const isOverseas          = trainingType === 'overseas';
    const isAnyOverseas       = isOverseas || isOverseasSeminar;
    const isPublic            = trainingType === 'public';
    const isInhouse           = trainingType === 'inhouse' || isROTInhouse || isCoachingMentoring;
    const isHotel             = venue === 'external_hotel'; // no !isROT — ROT at hotel is valid
    const isGeneralCourse     = courseCategory === 'general_non_technical' || courseCategory === 'general_technical' || courseCategory === 'general';

    // ── Branch handlers ───────────────────────────────────────
    const addBranch = () => setBranches(prev => [...prev, { label: `Branch ${prev.length + 1}`, pax: 2, kmDistance: 'under_100' }]);
    const removeBranch = (i) => setBranches(prev => prev.filter((_, idx) => idx !== i));
    const updateBranch = (i, field, val) => setBranches(prev => prev.map((b, idx) => idx === i ? { ...b, [field]: val } : b));

    // ── Subsidiary handlers ───────────────────────────────────
    const addSubsidiary = () => setSubsidiaries(prev => [...prev, {
        label:        scheme === 'slb' ? `Employer ${prev.length + 1}` : `Subsidiary ${prev.length + 1}`,
        pax:          5,
        kmDistance:   'under_100',
        hrdcorpRegNo: '',
    }]);
    const removeSubsidiary = (i) => setSubsidiaries(prev => prev.filter((_, idx) => idx !== i));
    const updateSubsidiary = (i, field, val) => setSubsidiaries(prev => prev.map((s, idx) => idx === i ? { ...s, [field]: val } : s));

    const calculate = () => {
        setBlockError(null);

        // Hard enforcement: max pax per group for general in-house courses
        if (isInhouse && isGeneralCourse) {
            const numT      = parseInt(numberOfTrainers) || 1;
            const isTech    = courseCategory === 'general_technical';
            const maxAllowed = isTech ? 25 * numT : 50 * numT;
            if (totalPax > maxAllowed) {
                setBlockError(
                    `Cannot calculate — participant limit exceeded.\n\n` +
                    `General (${isTech ? 'Technical' : 'Non-Technical'}) in-house courses allow a maximum of ` +
                    `${maxAllowed} pax with ${numT} trainer${numT > 1 ? 's' : ''} ` +
                    `(${numT} × ${isTech ? 25 : 50} pax/trainer — Employer's Circular No. 3/2024).\n\n` +
                    `Current total: ${totalPax} pax. ` +
                    `Please reduce the number of participants or add more trainers.`
                );
                setResult(null);
                return;
            }
        }

        const r = calculateEligibility({
            scheme,
            trainingType,
            trainerType,
            numberOfTrainers:          parseInt(numberOfTrainers)   || 1,
            venue,
            courseCategory,
            duration,
            days:                      parseInt(days)               || 1,
            extraDays:                 parseInt(extraDays)          || 0,
            elearningHours:            parseInt(elearningHours)     || 7,
            internalTrainerFromBranch,
            numberOfSpeakers:          parseInt(numberOfSpeakers)   || 1,
            hasLTM,
            ltmActualCost:             parseFloat(ltmActualCost)    || 0,
            host:        { ...host,  pax: parseInt(host.pax) || 0 },
            branches:    branches.map(b    => ({ ...b, pax: parseInt(b.pax) || 0 })),
            subsidiaries:subsidiaries.map(s => ({ ...s, pax: parseInt(s.pax) || 0 })),
            devLevel,
            skmLevel,
            devLocation,
            devPrivateInstitution,
            devMonths:                 parseInt(devMonths)          || 3,
            devFullTime,
            actualCourseFeePerPax:     parseFloat(actualCourseFee)  || 0
        }, liveRates || null, liveClaimDocs || null);
        setResult(r);
    };

    const iStyle  = { width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '14px', boxSizing: 'border-box' };
    const lStyle  = { fontSize: '13px', fontWeight: '600', color: '#555', marginBottom: '4px', display: 'block' };
    const rStyle  = { marginBottom: '16px' };

    const totalPax = (parseInt(host.pax) || 0)
        + branches.reduce((s, b) => s + (parseInt(b.pax) || 0), 0)
        + subsidiaries.reduce((s, c) => s + (parseInt(c.pax) || 0), 0);

    // Clear block error whenever key inputs change (must be after totalPax is defined)
    React.useEffect(() => { setBlockError(null); }, [totalPax, numberOfTrainers, courseCategory, trainingType]);

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
                            <option value="over_100">≥100 km → RM500/day/pax (+1 extra travel day for full-day)</option>
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
                        <div key={s.value} onClick={() => {
                            setScheme(s.value);
                            setResult(null);
                            // SLB: in-house and ROT in-house only — reset if current type not eligible
                            if (s.value === 'slb' && !['inhouse', 'rot_inhouse', 'coaching_mentoring'].includes(trainingType)) {
                                setTrainingType('inhouse');
                                setBranches([]);
                            }
                            // SLB: no subsidiary input — clear any existing
                            if (s.value === 'slb') setSubsidiaries([]);
                        }}
                            style={{ padding: '14px', borderRadius: '8px', cursor: 'pointer', border: scheme === s.value ? '2px solid #2e7d32' : '2px solid #ddd',
                                background: scheme === s.value ? '#c8e6c9' : '#fff', transition: 'all 0.15s' }}>
                            <div style={{ fontWeight: '700', fontSize: '13px', color: '#1b5e20', marginBottom: '4px' }}>{s.label}</div>
                            <div style={{ fontSize: '11px', color: '#555' }}>{s.desc}</div>
                        </div>
                    ))}
                </div>
            </div>

            {/* ── DISCLAIMER ───────────────────────────────────────── */}
            <div style={{ background: '#fffde7', border: '1px solid #f9a825', borderRadius: '10px', padding: '18px 22px', marginBottom: '20px' }}>
                <p style={{ fontWeight: '700', fontSize: '12px', color: '#e65100', margin: '0 0 10px' }}>⚠️ DISCLAIMER — Please Read Before Use</p>
                <ol style={{ margin: 0, padding: '0 0 0 18px' }}>
                    <li style={{ fontSize: '12px', color: '#555', marginBottom: '6px', lineHeight: '1.6' }}>
                        All calculations in this tool are based on the <strong>HRD Corp Allowable Cost Matrix (ACM) Guide — {guideEdition} Edition</strong> and the <strong>ACM Table — {tableEdition} Edition</strong>. Figures may not reflect subsequent revisions issued by HRD Corp.
                    </li>
                    <li style={{ fontSize: '12px', color: '#555', marginBottom: '6px', lineHeight: '1.6' }}>
                        All results are <strong>estimates only</strong>. Actual claimable amounts are subject to HRD Corp's review, verification, and final approval at the time of grant submission and claim.
                    </li>
                    <li style={{ fontSize: '12px', color: '#555', marginBottom: '6px', lineHeight: '1.6' }}>
                        This calculator is <strong>not an official HRD Corp tool</strong>. It is an independent initiative by <strong>Millenium Resource Ltd</strong> to assist registered employers in estimating HRD Corp claimable costs. It does not constitute professional or legal advice.
                    </li>
                    <li style={{ fontSize: '12px', color: '#555', marginBottom: '6px', lineHeight: '1.6' }}>
                        <strong>HRD Corp may revise</strong> the ACM, allowable rates, eligibility conditions, and document requirements at any time without prior notice. Users are advised to verify all figures with HRD Corp or a certified HRD Corp consultant before submitting any grant application.
                    </li>
                    <li style={{ fontSize: '12px', color: '#555', marginBottom: '6px', lineHeight: '1.6' }}>
                        It is the <strong>employer's sole responsibility</strong> to ensure all grant submissions comply with HRD Corp requirements. Millenium Resource Ltd is not liable for any grant rejection, underclaim, overclaim, or audit findings arising from the use of this calculator.
                    </li>
                    <li style={{ fontSize: '12px', color: '#555', marginBottom: '6px', lineHeight: '1.6' }}>
                        <strong>No data entered into this calculator is stored or transmitted.</strong> All calculations are performed locally in your browser. No information is shared with Millenium Resource Ltd or any third party.
                    </li>
                </ol>
            </div>

            {/* ── REST OF FORM (only shown after scheme is chosen) ── */}
            {scheme && (<>

            {/* ── BASIC FIELDS ─────────────────────────────────── */}
            <div style={{ background: '#f9fafb', borderRadius: '10px', padding: '24px', marginBottom: '20px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>

                    {/* Training Type */}
                    <div style={rStyle}>
                        <label style={lStyle}>Type of Training</label>
                        <select style={iStyle} value={trainingType} onChange={e => {
                            const t = e.target.value;
                            setTrainingType(t);
                            // Clear subsidiaries for non-inhouse types
                            if (!['inhouse', 'rot_inhouse', 'coaching_mentoring'].includes(t)) setSubsidiaries([]);
                            // Clear branches for e-learning, overseas, and development types
                            if (['elearning', 'mobile_elearning', 'overseas', 'overseas_seminar', 'development'].includes(t)) setBranches([]);
                            // Reset LTM when not in-house
                            if (!['inhouse', 'rot_inhouse', 'coaching_mentoring'].includes(t)) setHasLTM(false);
                            setResult(null);
                        }}>
                            <optgroup label="── In-House / Coaching ──────────────">
                                <option value="inhouse">In-House (Face-to-Face)</option>
                                <option value="rot_inhouse">ROT — In-House (Remote, Employer-organised)</option>
                                {scheme !== 'slb' && <option value="coaching_mentoring">Coaching &amp; Mentoring</option>}
                            </optgroup>
                            {scheme !== 'slb' && (
                                <optgroup label="── Public / Remote ──────────────────">
                                    <option value="rot_public">ROT — Public (Remote, TP-organised)</option>
                                    <option value="public">Local Public Training</option>
                                    <option value="seminar_conference">Local Seminar &amp; Conference</option>
                                </optgroup>
                            )}
                            {scheme !== 'slb' && (
                                <optgroup label="── E-Learning ───────────────────────">
                                    <option value="elearning">E-Learning (Asynchronous, Self-paced)</option>
                                    <option value="mobile_elearning">Mobile E-Learning</option>
                                </optgroup>
                            )}
                            {scheme !== 'slb' && (
                                <optgroup label="── Overseas ─────────────────────────">
                                    <option value="overseas">Overseas Training</option>
                                    <option value="overseas_seminar">Overseas Seminar &amp; Conference</option>
                                </optgroup>
                            )}
                            {scheme !== 'slb' && (
                                <optgroup label="── Academic / Vocational ────────────">
                                    <option value="development">Development Programme (Degree / Diploma / SKM / Masters / PhD)</option>
                                </optgroup>
                            )}
                        </select>
                    </div>

                    {/* Course Category — not for development */}
                    {!isDevelopment && (
                    <div style={rStyle}>
                        <label style={lStyle}>Course Category</label>
                        <select style={iStyle} value={courseCategory} onChange={e => setCourseCategory(e.target.value)}>
                            <option value="general_non_technical">General (Non-Technical)</option>
                            <option value="general_technical">General (Technical)</option>
                            <option value="focus_area">Focus Area (as charged, per pax)</option>
                            <option value="industry_specific">Industry Specific (as charged, per pax)</option>
                            <option value="certification">Professional Certification (as charged, per pax)</option>
                        </select>
                    </div>
                    )}

                    {/* Programme Level — development only */}
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

                    {/* Venue — for in-house (including ROT inhouse) and development */}
                    {(isInhouse || isDevelopment) && (
                        <div style={rStyle}>
                            <label style={lStyle}>Training Venue</label>
                            <select style={iStyle} value={venue} onChange={e => { setVenue(e.target.value); setResult(null); }}>
                                <option value="employer_premises">
                                    {isDevelopment ? 'College / University / Training Institution' : isROT ? 'Employer\'s Own Premises (ROT — Inhouse)' : 'Employer\'s Own Premises'}
                                </option>
                                <option value="external_hotel">
                                    {isDevelopment ? 'Overseas Institution' : isROT ? 'External Venue / Hotel (ROT — Outside)' : 'Hotel / External Training Centre'}
                                </option>
                            </select>
                        </div>
                    )}

                    {/* Number of Trainers — in-house general courses only (for pax cap calculation) */}
                    {isInhouse && !isDevelopment && isGeneralCourse && (
                        <div style={rStyle}>
                            <label style={lStyle}>Number of Trainers</label>
                            <input type="number" min="1" style={iStyle} value={numberOfTrainers}
                                onChange={e => setNumberOfTrainers(e.target.value)} />
                            <p style={{ fontSize: '11px', color: '#888', margin: '4px 0 0' }}>
                                Max pax: Non-Technical = {50 * (parseInt(numberOfTrainers) || 1)} pax · Technical = {25 * (parseInt(numberOfTrainers) || 1)} pax (Employer's Circular No. 3/2024)
                            </p>
                        </div>
                    )}

                    {/* Trainer Type — in-house training only */}
                    {isInhouse && !isDevelopment && (
                        <div style={rStyle}>
                            <label style={lStyle}>Trainer Type</label>
                            <select style={iStyle} value={trainerType} onChange={e => setTrainerType(e.target.value)}>
                                <option value="internal">Internal Trainer</option>
                                <option value="external">External Trainer</option>
                                {/* Overseas trainer only for face-to-face in-house (not ROT — trainer is online) */}
                                {(trainingType === 'inhouse' || isCoachingMentoring) && !isROT && (
                                    <option value="overseas">Overseas Trainer</option>
                                )}
                            </select>
                        </div>
                    )}

                    {/* Internal Trainer From Branch checkbox */}
                    {(trainingType === 'inhouse' || isCoachingMentoring) && trainerType === 'internal' && (
                        <div style={{ ...rStyle, display: 'flex', alignItems: 'center', gap: '10px', paddingTop: '20px' }}>
                            <input type="checkbox" id="branchTrainer" checked={internalTrainerFromBranch}
                                onChange={e => setInternalTrainerFromBranch(e.target.checked)}
                                style={{ width: '16px', height: '16px', cursor: 'pointer', flexShrink: 0 }} />
                            <label htmlFor="branchTrainer" style={{ ...lStyle, marginBottom: 0, cursor: 'pointer', color: '#333' }}>
                                Internal trainer is from a branch (entitled to air ticket &amp; travel allowance)
                            </label>
                        </div>
                    )}

                    {/* Duration — not for e-learning or development */}
                    {!isElearning && !isDevelopment && (
                        <div style={rStyle}>
                            <label style={lStyle}>Daily Duration</label>
                            <select style={iStyle} value={duration} onChange={e => setDuration(e.target.value)}>
                                <option value="full_day">Full Day (7 training hours)</option>
                                <option value="half_day">Half Day (4 training hours)</option>
                            </select>
                        </div>
                    )}

                    {/* Number of Training Days — not for e-learning or development */}
                    {!isElearning && !isDevelopment && (
                        <div style={rStyle}>
                            <label style={lStyle}>Number of Training Days</label>
                            <input type="number" min="1" style={iStyle} value={days} onChange={e => setDays(e.target.value)} />
                        </div>
                    )}

                    {/* Number of Speakers — seminar / conference only */}
                    {isSeminar && (
                        <div style={rStyle}>
                            <label style={lStyle}>Number of Speakers</label>
                            <input type="number" min="1" style={iStyle} value={numberOfSpeakers}
                                onChange={e => setNumberOfSpeakers(e.target.value)} />
                            <p style={{ fontSize: '11px', color: '#888', margin: '4px 0 0' }}>
                                Minimum: 1 speaker (half-day) · 2 speakers (full-day)
                            </p>
                        </div>
                    )}

                    {/* E-Learning hours */}
                    {isElearning && (
                        <div style={rStyle}>
                            <label style={lStyle}>Total E-Learning Hours</label>
                            <input type="number" min="1" style={iStyle} value={elearningHours}
                                onChange={e => setElearningHours(e.target.value)}
                                placeholder="e.g. 7, 10, 14..." />
                            <p style={{ fontSize: '11px', color: '#888', margin: '4px 0 0' }}>
                                ≤7 hrs: RM125/hr/pax. &gt;7 hrs: first 7hrs + additional half-day (4hrs = RM500) or full-day (7hrs = RM875) blocks per pax.
                            </p>
                        </div>
                    )}

                    {/* Extra Travel Days — overseas training and overseas seminar */}
                    {isAnyOverseas && (
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

                    {/* LTM — Licensed Training Materials (in-house only) */}
                    {isInhouse && (
                        <div style={{ ...rStyle, background: '#f3e5f5', border: '1px solid #ce93d8', borderRadius: '8px', padding: '14px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: hasLTM ? '12px' : 0 }}>
                                <input type="checkbox" id="hasLTM" checked={hasLTM}
                                    onChange={e => { setHasLTM(e.target.checked); if (!e.target.checked) setLtmActualCost(''); }}
                                    style={{ width: '16px', height: '16px', cursor: 'pointer', flexShrink: 0 }} />
                                <label htmlFor="hasLTM" style={{ ...lStyle, marginBottom: 0, cursor: 'pointer', color: '#6a1b9a' }}>
                                    Licensed Training Materials (LTM)
                                    <span style={{ display: 'block', fontSize: '11px', color: '#888', fontWeight: '400', marginTop: '2px' }}>
                                        Requires HRD Corp Special Approval Letter — pre-approval mandatory
                                    </span>
                                </label>
                            </div>
                            {hasLTM && (
                                <div>
                                    <label style={lStyle}>LTM Actual Cost (RM) — leave blank if unknown</label>
                                    <input type="number" min="0" style={iStyle} value={ltmActualCost}
                                        onChange={e => setLtmActualCost(e.target.value)}
                                        placeholder="As charged — enter actual cost or leave blank" />
                                </div>
                            )}
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
            {(isPublic || isROTPublic || isLocalSeminar || isAnyOverseas || isDevelopment || (isInhouse && trainerType !== 'internal')) && (
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
                        ? <><strong>Branches</strong> = same company departments (share host's proportional cost). <strong>Other Employers</strong> = separate participating companies (cost prorated by total pax).</>
                        : <><strong>Branches</strong> = same company (in-house rate stays). <strong>Subsidiaries</strong> = separate companies (triggers public rate for course fee).</>
                    }
                </p>

                {/* Host Company */}
                <p style={{ fontSize: '12px', fontWeight: '700', color: '#1565c0', margin: '0 0 6px' }}>HOST COMPANY</p>
                <ParticipantRow
                    label={isElearning ? 'Total Employees' : 'Host Company'}
                    badge="Host"
                    badgeColor="#1565c0"
                    pax={host.pax}
                    kmDistance={host.kmDistance}
                    showKm={isHotel || isPublic || isROTPublic || isSeminar}
                    hint={isElearning || isROTPublic ? false : undefined}
                    onPaxChange={v => setHost(h => ({ ...h, pax: v }))}
                    onKmChange={v  => setHost(h => ({ ...h, kmDistance: v }))}
                />

                {/* Branches */}
                {!isElearning && !isAnyOverseas && !isDevelopment && branches.length > 0 && (
                    <p style={{ fontSize: '12px', fontWeight: '700', color: '#2e7d32', margin: '10px 0 6px' }}>BRANCHES (same company — in-house rate)</p>
                )}
                {!isElearning && !isAnyOverseas && !isDevelopment && branches.map((b, i) => (
                    <ParticipantRow key={i}
                        label={b.label}
                        badge="Branch"
                        badgeColor="#2e7d32"
                        pax={b.pax}
                        kmDistance={b.kmDistance}
                        showKm={true}
                        hint={false}
                        onPaxChange={v => updateBranch(i, 'pax', v)}
                        onKmChange={v  => updateBranch(i, 'kmDistance', v)}
                        onRemove={() => removeBranch(i)}
                    />
                ))}

                {/* Subsidiaries — HCC / SBL in-house only */}
                {isInhouse && scheme !== 'slb' && subsidiaries.length > 0 && (
                    <p style={{ fontSize: '12px', fontWeight: '700', color: '#e65100', margin: '10px 0 6px' }}>
                        SUBSIDIARIES (separate companies — public rate applies)
                    </p>
                )}
                {isInhouse && scheme !== 'slb' && subsidiaries.map((s, i) => (
                    <ParticipantRow key={i}
                        label={s.label}
                        badge="Subsidiary"
                        badgeColor="#e65100"
                        pax={s.pax}
                        kmDistance={s.kmDistance}
                        showKm={true}
                        hint={false}
                        onPaxChange={v => updateSubsidiary(i, 'pax', v)}
                        onKmChange={v  => updateSubsidiary(i, 'kmDistance', v)}
                        onRemove={() => removeSubsidiary(i)}
                    />
                ))}

                {/* SLB — Participating Employers */}
                {scheme === 'slb' && isInhouse && subsidiaries.length > 0 && (
                    <p style={{ fontSize: '12px', fontWeight: '700', color: '#6a1b9a', margin: '10px 0 6px' }}>
                        OTHER PARTICIPATING EMPLOYERS (group rate ÷ total pax × each employer's pax)
                    </p>
                )}
                {scheme === 'slb' && isInhouse && subsidiaries.map((s, i) => (
                    <div key={i} style={{ background: '#fff', border: '1px solid #ce93d8', borderRadius: '8px', padding: '14px', marginBottom: '10px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                            <span style={{ fontWeight: '700', fontSize: '13px', color: '#6a1b9a' }}>
                                Participating Employer {i + 1}
                                <span style={{ marginLeft: '8px', fontSize: '10px', background: '#6a1b9a', color: '#fff', padding: '2px 8px', borderRadius: '10px' }}>SLB</span>
                            </span>
                            <button onClick={() => removeSubsidiary(i)} style={{ background: 'none', border: '1px solid #e57373', color: '#e57373', padding: '2px 10px', borderRadius: '5px', cursor: 'pointer', fontSize: '12px' }}>Remove</button>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                            <div>
                                <label style={lStyle}>Employer Name</label>
                                <input type="text" style={iStyle} value={s.label} onChange={e => updateSubsidiary(i, 'label', e.target.value)} placeholder={`Employer ${i + 1}`} />
                            </div>
                            <div>
                                <label style={lStyle}>HRD Corp Employer Code</label>
                                <input type="text" style={iStyle} value={s.hrdcorpRegNo || ''} onChange={e => updateSubsidiary(i, 'hrdcorpRegNo', e.target.value)} placeholder="e.g. 12345678" />
                            </div>
                            <div>
                                <label style={lStyle}>Number of Pax</label>
                                <input type="number" min="0" style={iStyle} value={s.pax} onChange={e => updateSubsidiary(i, 'pax', e.target.value)} />
                            </div>
                        </div>
                    </div>
                ))}

                {/* Add buttons */}
                <div style={{ display: 'flex', gap: '12px', marginTop: '14px' }}>
                    {!isElearning && !isAnyOverseas && !isDevelopment && (
                        <button onClick={addBranch} style={{ background: '#2e7d32', color: '#fff', border: 'none', padding: '7px 18px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>
                            + Add Branch
                        </button>
                    )}
                    {isInhouse && scheme !== 'slb' && (
                        <button onClick={addSubsidiary} style={{ background: '#e65100', color: '#fff', border: 'none', padding: '7px 18px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>
                            + Add Subsidiary
                        </button>
                    )}
                    {scheme === 'slb' && isInhouse && (
                        <button onClick={addSubsidiary} style={{ background: '#6a1b9a', color: '#fff', border: 'none', padding: '7px 18px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>
                            + Add Participating Employer
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

            {/* ── BLOCK ERROR ──────────────────────────────────── */}
            {blockError && (
                <div style={{ background: '#ffebee', border: '2px solid #e53935', borderRadius: '10px', padding: '18px 20px', marginBottom: '20px' }}>
                    <p style={{ fontWeight: '700', color: '#b71c1c', fontSize: '14px', margin: '0 0 6px' }}>🚫 Calculation Blocked</p>
                    <p style={{ color: '#c62828', fontSize: '13px', margin: 0, whiteSpace: 'pre-line', lineHeight: '1.7' }}>{blockError}</p>
                </div>
            )}

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
                                {isAnyOverseas && <span style={{ fontWeight: '400', marginLeft: '4px' }}>(50% financial assistance applies)</span>}
                            </p>
                        </div>
                    )}

                    {/* Supporting Documents */}
                    {result.supportingDocs && (
                    <div style={{ background: '#e8eaf6', border: '1px solid #9fa8da', borderRadius: '8px', padding: '18px', marginBottom: '16px' }}>
                        <p style={{ fontWeight: '700', color: '#283593', marginBottom: '14px', fontSize: '13px' }}>📄 Supporting Documents Required</p>

                        {/* Grant Submission */}
                        <ol style={{ margin: 0, padding: '0 0 0 18px' }}>
                            {result.supportingDocs.grantSubmission.map((doc, i) => (
                                <li key={i} style={{ color: '#333', fontSize: '12px', marginBottom: '5px', lineHeight: '1.6' }}>
                                    {doc.text}
                                    {doc.subItems && doc.subItems.length > 0 && (
                                        <ul style={{ margin: '4px 0 2px', padding: '0 0 0 16px', listStyle: 'none' }}>
                                            {doc.subItems.map((sub, j) => (
                                                <li key={j} style={{ color: '#555', fontSize: '11px', marginBottom: '2px', lineHeight: '1.5' }}>{sub}</li>
                                            ))}
                                        </ul>
                                    )}
                                </li>
                            ))}
                        </ol>
                    </div>
                    )}

                    {/* Warnings & Notes */}
                    {result.warnings.length > 0 && (
                        <div style={{ background: '#fffde7', border: '1px solid #f9a825', borderRadius: '8px', padding: '16px' }}>
                            <p style={{ fontWeight: '700', color: '#f57f17', marginBottom: '8px', fontSize: '13px' }}>📌 Notes &amp; Reminders:</p>
                            {result.warnings.map((w, i) => (
                                <p key={i} style={{ color: '#555', fontSize: '12px', margin: '4px 0', whiteSpace: 'pre-line' }}>{w}</p>
                            ))}
                        </div>
                    )}
                </div>
            )}
            </>)}
        </div>
    );
};
