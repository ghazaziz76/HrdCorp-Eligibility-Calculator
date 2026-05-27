import React, { useState } from 'react';
import { calculateFwt, groupsFor } from './calculateFwt';
import PurchaseResult from '../shared/PurchaseResult';
import { iStyle, lStyle, rStyle, primaryBtn } from '../shared/styles';

const FWT_NOTES = [
  'FWT funds in-house or public pre-employment training, with the aim of employing the trainees upon completion. Employers must identify the future workers under the pre-employment training course.',
  'Each training session must be at least 4 hours. Maximum training period is 1 year.',
  'In-house: minimum 2 trainees; maximum 25 (technical) or 50 (soft skills) PER trainer/group — the number of trainers is set automatically from the trainees. Public certification: minimum 1, no maximum. General public: minimum 1, maximum 9.',
  'In-house internal trainer allowance: RM1,400/full day or RM800/half day per group. In-house external training-provider course fee is capped at RM10,500/full day or RM6,000/half day per group (prorated if a group has fewer than 5 trainees).',
  'Short programmes (under 1 month): claim EITHER the trainee daily allowance (RM250/day under 100km, RM500/day 100km+, or actual paid — whichever is lower) OR the meal allowance (RM100/day per trainee) — not both.',
  'Longer programmes (over 1 month): trainees’ monthly allowance is paid by the employer. The salary offered on employment must be at least the monthly allowance paid during training; the claim is based on whichever is lower.',
  'Employers must have no legal issues with HRD Corp to apply.',
];

const SUBTYPES = [
  { value: 'inhouse', label: 'In-House Training' },
  { value: 'public_cert', label: 'Public Certification Course' },
  { value: 'general_public', label: 'General Public Course' },
];

const readOnlyStyle = { ...iStyle, background: '#e3e7ee', color: '#5b6b8c', cursor: 'not-allowed' };

export default function FwtForm() {
  const [subType, setSubType] = useState('inhouse');
  const [courseCategory, setCourseCategory] = useState('soft_skills');
  const [trainerType, setTrainerType] = useState('internal');
  const [numberOfTrainees, setNumberOfTrainees] = useState('');
  const [trainingDays, setTrainingDays] = useState('');
  const [dailyDuration, setDailyDuration] = useState('full_day');
  const [distance, setDistance] = useState('under_100');
  const [allowanceType, setAllowanceType] = useState('daily');
  const [courseFee, setCourseFee] = useState('');
  const [durationType, setDurationType] = useState('less_than_month');
  const [months, setMonths] = useState('');
  const [monthlyAllowancePerTrainee, setMonthlyAllowancePerTrainee] = useState('');
  const [consumableCost, setConsumableCost] = useState('');
  const [result, setResult] = useState(null);

  const isInhouse = subType === 'inhouse';
  const isInternal = isInhouse && trainerType === 'internal';
  const isLess = durationType === 'less_than_month';
  const trainees = parseInt(numberOfTrainees, 10) || 0;
  const groups = isInhouse ? groupsFor(trainees, courseCategory) : 0;

  const calculate = () => setResult(calculateFwt({
    subType, courseCategory, trainerType, numberOfTrainees, trainingDays,
    dailyDuration, distance, allowanceType, courseFee, durationType, months, monthlyAllowancePerTrainee, consumableCost,
  }));

  return (
    <div style={{ padding: '24px', maxWidth: '960px', margin: '0 auto' }}>
      <h2 style={{ color: '#2e7d32', marginBottom: '6px' }}>FWT — Future Workers Training</h2>
      <p style={{ color: '#777', fontSize: '13px', marginBottom: '24px' }}>Pre-employment training that aims to employ the trainees upon completion. In-house, public certification, or general public.</p>

      <div style={{ background: '#fff8e1', border: '1px solid #ffe082', borderRadius: '8px', padding: '14px 18px', marginBottom: '20px' }}>
        <p style={{ fontWeight: '700', fontSize: '12px', color: '#e65100', margin: '0 0 8px' }}>FWT — Rules &amp; Conditions</p>
        <ul style={{ margin: 0, padding: '0 0 0 18px' }}>
          {FWT_NOTES.map((n, i) => <li key={i} style={{ fontSize: '12px', color: '#555', marginBottom: '5px', lineHeight: '1.6' }}>{n}</li>)}
        </ul>
      </div>

      <div style={{ background: '#f9fafb', borderRadius: '10px', padding: '24px', marginBottom: '20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div style={rStyle}>
            <label style={lStyle}>FWT Type</label>
            <select style={iStyle} value={subType} onChange={e => { setSubType(e.target.value); setResult(null); }}>
              {SUBTYPES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>

          {isInhouse && (
            <div style={rStyle}>
              <label style={lStyle}>Course Category</label>
              <select style={iStyle} value={courseCategory} onChange={e => setCourseCategory(e.target.value)}>
                <option value="soft_skills">Soft Skills (max 50 pax/group)</option>
                <option value="technical">Technical (max 25 pax/group)</option>
              </select>
            </div>
          )}

          {isInhouse && (
            <div style={rStyle}>
              <label style={lStyle}>Trainer Type</label>
              <select style={iStyle} value={trainerType} onChange={e => { setTrainerType(e.target.value); setResult(null); }}>
                <option value="internal">Internal Trainer (trainer allowance)</option>
                <option value="external">External Trainer / Training Provider (course fee)</option>
              </select>
            </div>
          )}

          <div style={rStyle}>
            <label style={lStyle}>Number of Trainees</label>
            <input type="number" min="0" style={iStyle} value={numberOfTrainees} onChange={e => setNumberOfTrainees(e.target.value)} />
          </div>

          {isInhouse && (
            <div style={rStyle}>
              <label style={lStyle}>Number of Trainers (auto)</label>
              <input type="number" style={readOnlyStyle} value={groups} readOnly tabIndex={-1} />
              <p style={{ fontSize: '11px', color: '#888', margin: '4px 0 0' }}>
                Auto-calculated: {trainees || 0} trainee(s) ÷ {courseCategory === 'technical' ? 25 : 50}/group = {groups} group(s)/trainer(s).
              </p>
            </div>
          )}

          {isInhouse && (
            <div style={rStyle}>
              <label style={lStyle}>Session Length</label>
              <select style={iStyle} value={dailyDuration} onChange={e => setDailyDuration(e.target.value)}>
                <option value="full_day">Full Day (7 hrs){isInternal ? ' — RM1,400/group' : ' — RM10,500/group'}</option>
                <option value="half_day">Half Day (≤4 hrs){isInternal ? ' — RM800/group' : ' — RM6,000/group'}</option>
              </select>
            </div>
          )}

          <div style={rStyle}>
            <label style={lStyle}>Training Days</label>
            <input type="number" min="0" style={iStyle} value={trainingDays} onChange={e => setTrainingDays(e.target.value)} />
          </div>

          <div style={rStyle}>
            <label style={lStyle}>Programme Length</label>
            <select style={iStyle} value={durationType} onChange={e => setDurationType(e.target.value)}>
              <option value="less_than_month">Less than 1 month</option>
              <option value="more_than_month">More than 1 month</option>
            </select>
          </div>

          {!isInhouse && (
            <div style={rStyle}>
              <label style={lStyle}>Course Fee (RM, as charged)</label>
              <input type="number" min="0" style={iStyle} value={courseFee} onChange={e => setCourseFee(e.target.value)} />
            </div>
          )}

          {isLess && (
            <div style={rStyle}>
              <label style={lStyle}>Trainee Allowance Type</label>
              <select style={iStyle} value={allowanceType} onChange={e => setAllowanceType(e.target.value)}>
                <option value="daily">Daily Allowance (distance-based)</option>
                <option value="meal">Meal Allowance (RM100/day/pax)</option>
              </select>
              <p style={{ fontSize: '11px', color: '#888', margin: '4px 0 0' }}>Claim either the daily allowance or the meal allowance — not both.</p>
            </div>
          )}
          {isLess && allowanceType === 'daily' && (
            <div style={rStyle}>
              <label style={lStyle}>Distance to Venue</label>
              <select style={iStyle} value={distance} onChange={e => setDistance(e.target.value)}>
                <option value="under_100">&lt;100 km → RM250/day/pax</option>
                <option value="over_100">≥100 km → RM500/day/pax</option>
              </select>
            </div>
          )}

          {!isLess && (
            <>
              <div style={rStyle}>
                <label style={lStyle}>Duration (months)</label>
                <input type="number" min="1" style={iStyle} value={months} onChange={e => setMonths(e.target.value)} />
              </div>
              <div style={rStyle}>
                <label style={lStyle}>Monthly Allowance per Trainee (RM)</label>
                <input type="number" min="0" style={iStyle} value={monthlyAllowancePerTrainee} onChange={e => setMonthlyAllowancePerTrainee(e.target.value)} />
              </div>
              {isInhouse && (
                <div style={rStyle}>
                  <label style={lStyle}>Consumable Training Materials (RM, optional)</label>
                  <input type="number" min="0" style={iStyle} value={consumableCost} onChange={e => setConsumableCost(e.target.value)} />
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <button onClick={calculate} style={primaryBtn}>Calculate Eligibility</button>
      <PurchaseResult schemeId="fwt" schemeLabel="FWT — Future Workers Training" result={result} />
    </div>
  );
}
