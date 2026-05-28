import React, { useState } from 'react';
import { calculateOjt } from './calculateOjt';
import PurchaseResult from '../shared/PurchaseResult';
import { iStyle, lStyle, rStyle, primaryBtn } from '../shared/styles';

const OJT_NOTES = [
  'OJT is when a skilled worker or supervisor trains another unskilled or new worker who works alongside them.',
  'Internal trainer allowance: RM50/trainee/hour. Maximum total training hours: 300 (with a maximum of 7 hours per day).',
  'Each training session must be at least 4 hours. Training may be conducted in a series of sessions, with a minimum of 1 continuous hour per sub-session.',
  'Trainer-to-trainee ratio per session: minimum 1:1, maximum 1:4. For 5 or more trainees, the employer should apply under the SBL scheme for the internal trainer allowance.',
  'Examination fee is claimable as per receipt. For self-learning, learning materials are based on receipts from suppliers (journals, books, online subscriptions).',
  'OJT application must be submitted within 6 months AFTER the training date ended.',
  'Trainer and trainee details with handwritten signatures are required for the grant submission. No claim submission is required under the OJT scheme.',
  'Professional Assessment (e.g. MBOT for technologists/technicians) is claimable under OJT for HRD Corp Registered Employers, without a prior grant application.',
];

const readOnlyStyle = { ...iStyle, background: '#e3e7ee', color: '#5b6b8c', cursor: 'not-allowed' };

export default function OjtForm() {
  const [numberOfTrainees, setNumberOfTrainees] = useState('');
  const [trainingHours, setTrainingHours] = useState('');
  const [examinationFee, setExaminationFee] = useState('');
  const [learningMaterials, setLearningMaterials] = useState('');
  const [trainingStartDate, setTrainingStartDate] = useState('');
  const [trainingEndDate, setTrainingEndDate] = useState('');
  const [result, setResult] = useState(null);

  // Derived: live duration display for the user before they click Calculate.
  const liveDuration = (() => {
    if (!trainingStartDate || !trainingEndDate) return null;
    const s = new Date(trainingStartDate), e = new Date(trainingEndDate);
    if (isNaN(s) || isNaN(e) || e < s) return null;
    return Math.round((e - s) / 86400000) + 1;
  })();

  const calculate = () => setResult(calculateOjt({
    numberOfTrainees, trainingHours, examinationFee, learningMaterials, trainingStartDate, trainingEndDate,
  }));

  return (
    <div style={{ padding: '24px', maxWidth: '960px', margin: '0 auto' }}>
      <h2 style={{ color: '#2e7d32', marginBottom: '6px' }}>OJT — On-the-Job Training</h2>
      <p style={{ color: '#777', fontSize: '13px', marginBottom: '24px' }}>A skilled worker trains an unskilled / new worker on the job. RM50/trainee/hour internal-trainer allowance, max 300 hours, ratio 1:1–1:4 per session.</p>

      <div style={{ background: '#fff8e1', border: '1px solid #ffe082', borderRadius: '8px', padding: '14px 18px', marginBottom: '20px' }}>
        <p style={{ fontWeight: '700', fontSize: '12px', color: '#e65100', margin: '0 0 8px' }}>OJT — Rules &amp; Conditions</p>
        <ul style={{ margin: 0, padding: '0 0 0 18px' }}>
          {OJT_NOTES.map((n, i) => <li key={i} style={{ fontSize: '12px', color: '#555', marginBottom: '5px', lineHeight: '1.6' }}>{n}</li>)}
        </ul>
      </div>

      <div style={{ background: '#f9fafb', borderRadius: '10px', padding: '24px', marginBottom: '20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>

          <div style={rStyle}>
            <label style={lStyle}>Number of Trainees (1–4 per session)</label>
            <input type="number" min="1" max="4" style={iStyle} value={numberOfTrainees}
              onChange={e => {
                const v = e.target.value;
                // Hard-clamp at 4 — for 5+ trainees, the SBL scheme applies instead.
                if ((parseInt(v, 10) || 0) > 4) { setNumberOfTrainees('4'); return; }
                setNumberOfTrainees(v);
              }} />
            <p style={{ fontSize: '11px', color: '#888', margin: '4px 0 0' }}>Capped at 4. For 5 or more trainees, apply under the SBL scheme instead.</p>
          </div>

          <div style={rStyle}>
            <label style={lStyle}>Total Training Hours (max 300)</label>
            <input type="number" min="0" max="300" style={iStyle} value={trainingHours}
              onChange={e => {
                const v = e.target.value;
                // Hard-clamp at 300 total hours.
                if ((parseInt(v, 10) || 0) > 300) { setTrainingHours('300'); return; }
                setTrainingHours(v);
              }} />
            <p style={{ fontSize: '11px', color: '#888', margin: '4px 0 0' }}>Capped at 300 hours. Max 7 hours/day; minimum 4 hours per session.</p>
          </div>

          <div style={rStyle}>
            <label style={lStyle}>Training Start Date</label>
            <input type="date" style={iStyle} value={trainingStartDate} onChange={e => setTrainingStartDate(e.target.value)} />
          </div>

          <div style={rStyle}>
            <label style={lStyle}>Training End Date</label>
            <input type="date" style={iStyle} value={trainingEndDate} onChange={e => setTrainingEndDate(e.target.value)} />
            <p style={{ fontSize: '11px', color: '#888', margin: '4px 0 0' }}>Application can be submitted within 6 months <strong>AFTER</strong> the training ends.</p>
          </div>

          <div style={rStyle}>
            <label style={lStyle}>Total Training Duration</label>
            <input type="text" style={readOnlyStyle} value={liveDuration != null ? `${liveDuration} day(s)` : '—'} readOnly tabIndex={-1} />
            <p style={{ fontSize: '11px', color: '#888', margin: '4px 0 0' }}>Auto-calculated from start and end dates.</p>
          </div>

          <div /> {/* spacer for grid alignment */}

          <div style={rStyle}>
            <label style={lStyle}>Examination Fee (RM, optional)</label>
            <input type="number" min="0" style={iStyle} value={examinationFee} onChange={e => setExaminationFee(e.target.value)} />
            <p style={{ fontSize: '11px', color: '#888', margin: '4px 0 0' }}>As per receipt — e.g. MBOT, certification body.</p>
          </div>

          <div style={rStyle}>
            <label style={lStyle}>Learning Materials — self-learning (RM, optional)</label>
            <input type="number" min="0" style={iStyle} value={learningMaterials} onChange={e => setLearningMaterials(e.target.value)} />
            <p style={{ fontSize: '11px', color: '#888', margin: '4px 0 0' }}>As per supplier receipts — journals, books, online subscriptions.</p>
          </div>

        </div>
      </div>

      <button onClick={calculate} style={primaryBtn}>Calculate Eligibility</button>
      <PurchaseResult schemeId="ojt" schemeLabel="OJT — On-the-Job Training" result={result} />
    </div>
  );
}
