/**
 * HRD Corp Allowable Cost Matrix (ACM) — Eligibility Calculator Engine
 * Version: Based on HRD Corp ACM November 2025
 *
 * Pure JavaScript utility — no React, no UI.
 * Called by HRDCorpCostCalculator component in CompanyAdminDashboard.
 *
 * Participant structure:
 *   host        — Host company staff at training venue (meal allowance at own premise)
 *   branches[]  — Branches of same company (travel allowance, do NOT affect course fee rate)
 *   subsidiaries[] — For HCC/SBL: separate companies (triggers public rate per pax)
 *                    For SLB: other participating employers (group rate ÷ total pax)
 *
 * Max pax per group: 50 (non-technical) / 25 (technical) per Employer's Circular No. 3/2024
 */

import { RATES } from '../data/acm-rates.js';
import { CLAIM_DOCS, GRANT_DOCS } from '../data/acm-documents.js';

/**
 * Calculate HRD Corp ACM eligibility.
 *
 * @param {object} inputs
 *   scheme                    {string}  'hcc'|'sbl'|'slb'
 *   trainingType              {string}  'inhouse'|'rot_inhouse'|'rot_public'|'public'|
 *                                       'elearning'|'mobile_elearning'|'overseas'|'overseas_seminar'|
 *                                       'development'|'seminar_conference'|'coaching_mentoring'
 *   trainerType               {string}  'internal'|'external'|'overseas'
 *   numberOfTrainers          {number}  1 or more
 *   venue                     {string}  'employer_premises'|'external_hotel'
 *   courseCategory            {string}  'general'|'general_non_technical'|'general_technical'|
 *                                       'focus_area'|'industry_specific'|'certification'
 *   duration                  {string}  'full_day'|'half_day'
 *   days                      {number}
 *   extraDays                 {number}  extra travel days (overseas only, max 2)
 *   elearningHours            {number}  1–7
 *   internalTrainerFromBranch {boolean}
 *   numberOfSpeakers          {number}  for seminar/conference min-speaker validation
 *   hasLTM                    {boolean} Licensed Training Materials flag (in-house only)
 *   ltmActualCost             {number}  actual LTM cost (0 = as charged)
 *
 *   host          {object}  { pax, kmDistance }
 *     pax         {number}  host company staff attending
 *     kmDistance  {string}  'under_100'|'over_100'
 *
 *   branches      {Array}   branches of the SAME company — do NOT trigger public rate
 *     { label, pax, kmDistance }
 *
 *   subsidiaries  {Array}   HCC/SBL: separate companies that trigger public per-pax rate
 *                           SLB: other participating employers (cost prorated by pax)
 *     { label, pax, kmDistance }
 *
 * @returns {object}  { items, airTicketEntitled, totalClaimable, warnings }
 */
export function calculateEligibility(inputs) {
    const {
        scheme                    = 'hcc',
        trainingType              = 'inhouse',
        trainerType               = 'external',
        numberOfTrainers          = 1,
        venue                     = 'employer_premises',
        courseCategory            = 'general',
        duration                  = 'full_day',
        days                      = 1,
        extraDays                 = 0,
        elearningHours            = 7,
        internalTrainerFromBranch = false,
        numberOfSpeakers          = 1,
        hasLTM                    = false,
        ltmActualCost             = 0,
        host                      = { pax: 10, kmDistance: 'under_100' },
        branches                  = [],
        subsidiaries              = [],
        // Development Programme specific
        devLevel                  = 'degree',  // 'phd'|'masters'|'degree'|'diploma'|'skm'
        skmLevel                  = '3',
        devLocation               = 'local',   // 'local'|'overseas'
        devPrivateInstitution     = false,
        devMonths                 = 3,
        devFullTime               = true,
        // Actual fee input — per pax total for the full course/programme (NOT per day)
        actualCourseFeePerPax     = 0
    } = inputs;

    // Supporting document labels depend on scheme
    const courseFeeDoc = scheme === 'hcc'
        ? CLAIM_DOCS.course_fee_hcc
        : CLAIM_DOCS.course_fee_other;

    const isHalfDay           = duration === 'half_day';
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
    // isPublicFee: training types whose course fee uses the public per-pax rate (isLocalSeminar only, not overseas seminar)
    const isPublicFee         = isPublic || isROTPublic || isLocalSeminar;
    const isInhouse           = trainingType === 'inhouse' || isROTInhouse || isCoachingMentoring;
    // FIX: removed `&& !isROT` — ROT at external venue is a valid hotel scenario
    const isHotel             = venue === 'external_hotel';

    // Course category flags — supports legacy 'general' alias as non-technical
    const isGeneralNonTech = courseCategory === 'general_non_technical';
    const isGeneralTech    = courseCategory === 'general_technical';
    const isGeneralCourse  = courseCategory === 'general' || isGeneralNonTech || isGeneralTech;

    const hostPax        = parseInt(host.pax)                              || 0;
    const branchPaxTotal = branches.reduce((s, b) => s + (parseInt(b.pax) || 0), 0);
    const subPaxTotal    = subsidiaries.reduce((s, c) => s + (parseInt(c.pax) || 0), 0);
    const totalPax       = hostPax + branchPaxTotal + subPaxTotal;

    const numSubsidiaries = subsidiaries.length;
    const numCompanies    = 1 + numSubsidiaries;

    // Public rate applies for HCC/SBL when subsidiaries (separate companies) are present.
    // NOT used for SLB — SLB always uses group_rate ÷ total_pax regardless. (BUG #1 fix)
    const usePublicRate = numSubsidiaries > 0 && scheme !== 'slb';

    const items    = [];
    const warnings = [];
    let   totalClaimable = 0;

    // ── HELPERS ──────────────────────────────────────────────
    const push = (item) => {
        items.push(item);
        if (item.eligible && typeof item.amount === 'number' && item.amount !== null) {
            totalClaimable += item.amount;
        }
    };

    const prorateGroup = (rate, pax) =>
        pax < RATES.inhouse.prorate_threshold
            ? (rate / RATES.inhouse.prorate_threshold) * pax
            : rate;

    const travelRate = (kmDistance) =>
        kmDistance === 'over_100'
            ? RATES.allowances.travel_over_100
            : RATES.allowances.travel_under_100;

    const kmLabel = (kmDistance) => kmDistance === 'over_100' ? '≥100km' : '<100km';

    // DEFICIT 11 FIX: +1 extra travel day for staff ≥100km (full day training only)
    const travelDaysFor = (kmDistance) =>
        !isHalfDay && kmDistance === 'over_100' ? days + 1 : days;

    const mealRate = isHalfDay ? RATES.allowances.meal_half : RATES.allowances.meal_full;

    // ── SCHEME VALIDATION WARNINGS ───────────────────────────

    // DEFICIT 13 FIX: SLB + overseas trainer not applicable
    if (scheme === 'slb' && trainerType === 'overseas') {
        warnings.push(
            `⚠️ SLB scheme does not support overseas trainers. An overseas trainer is not applicable under SLB.`
        );
    }

    // DEFICIT 14 FIX: SLB restricted to in-house and ROT in-house only
    if (scheme === 'slb' && !['inhouse', 'rot_inhouse', 'coaching_mentoring'].includes(trainingType)) {
        warnings.push(
            `⚠️ SLB (Skim Latihan Bersama) only covers In-House training and ROT (In-House). ` +
            `The selected training type (${trainingType}) is not claimable under SLB.`
        );
    }

    // ── AUDIT RISK FLAGS ──────────────────────────────────────
    if (isInhouse && totalPax > RATES.audit_risk_pax) {
        warnings.push(
            `⚠️ Medium audit risk: Group size (${totalPax} pax) exceeds the standard threshold of ${RATES.audit_risk_pax} pax. ` +
            `Ensure trainer adequacy is documented. HRD Corp may request justification during audit.`
        );
    }

    if (isInhouse && isGeneralCourse && totalPax < RATES.inhouse.prorate_threshold) {
        warnings.push(
            `ℹ️ Compliance note: Less than ${RATES.inhouse.prorate_threshold} participants — course fee and trainer allowance are prorated by ACM rules.`
        );
    }

    if (!isROT && isInhouse && !isDevelopment && totalPax < RATES.inhouse.min_pax_f2f) {
        warnings.push(
            `⚠️ Minimum ${RATES.inhouse.min_pax_f2f} participants required for face-to-face in-house training. ` +
            `Current group size (${totalPax} pax) does not meet the ACM eligibility threshold.`
        );
    }
    if (isROT && totalPax < RATES.inhouse.min_pax_rot) {
        warnings.push(`⚠️ Minimum ${RATES.inhouse.min_pax_rot} participant required for ROT (Remote Online Training).`);
    }

    // DEFICIT 4 FIX: Max pax per group validation for general courses (Employer's Circular No. 3/2024)
    if (isInhouse && isGeneralCourse) {
        const baseLimit     = isGeneralTech ? RATES.inhouse.max_pax_tech : RATES.inhouse.max_pax_soft;
        const maxPaxAllowed = baseLimit * numberOfTrainers;
        const catLabel      = isGeneralTech ? 'Technical' : 'Non-Technical';
        if (totalPax > maxPaxAllowed) {
            warnings.push(
                `⚠️ Pax limit exceeded: General (${catLabel}) in-house courses allow a maximum of ` +
                `${maxPaxAllowed} pax (${numberOfTrainers} trainer(s) × ${baseLimit} pax/trainer per Employer's Circular No. 3/2024). ` +
                `Current group: ${totalPax} pax.`
            );
        }
    }

    // DEFICIT 15 FIX: Seminar min speakers validation
    if (isSeminar) {
        const minSpeakers = isHalfDay ? 1 : 2;
        if ((parseInt(numberOfSpeakers) || 0) < minSpeakers) {
            warnings.push(
                `⚠️ Seminar / Conference requires a minimum of ${minSpeakers} speaker(s) for a ` +
                `${isHalfDay ? 'half-day' : 'full-day'} event. Current: ${numberOfSpeakers || 0} speaker(s).`
            );
        }
    }

    // Seminar / Conference 51-pax minimum (local only — GAP #4 fix)
    if (isLocalSeminar) {
        warnings.push(
            `📋 Seminar / Conference eligibility requirement: The event must have a minimum of ` +
            `${RATES.seminar.min_pax_inhouse} total attendees (in-house) or ${RATES.seminar.min_pax_public_per_tp} attendees per Training Provider (public). ` +
            `Verify that the event meets this threshold. HRD Corp may request attendance records during audit.`
        );
    }

    if (courseCategory === 'focus_area') {
        warnings.push(
            `📋 Focus Area Courses cover 9 key sectors: Industry 4.0 · Green Technology & Renewable Energy · ` +
            `Fintech · Smart Construction · Smart Farming · Aerospace · Blockchain · Micro-credential · Future Technology. ` +
            `Costs are "as charged" and quoted on a per-pax basis, prorated by attendance completion.`
        );
    }

    // ─────────────────────────────────────────────────────────
    // A) INTERNAL TRAINER ALLOWANCE
    // ─────────────────────────────────────────────────────────
    if (isInhouse && trainerType === 'internal') {
        const rate    = isHalfDay ? RATES.allowances.internal_trainer_half : RATES.allowances.internal_trainer_full;
        const dayRate = prorateGroup(rate, totalPax);
        const amount  = Math.round(dayRate * days);
        push({
            label:     'A) Internal Trainer Allowance',
            eligible:  true,
            amount,
            note:      `RM${rate}/day/group × ${days} day(s)` +
                       (totalPax < RATES.inhouse.prorate_threshold ? ' (prorated — less than 5 pax)' : ''),
            documents: CLAIM_DOCS.none
        });
    }

    // ─────────────────────────────────────────────────────────
    // B) COURSE FEE
    // ─────────────────────────────────────────────────────────

    // IN-HOUSE / ROT — Course fee only when External or Overseas trainer
    // (Internal trainer → A) allowance instead; A and B are mutually exclusive)
    if (isInhouse && trainerType !== 'internal') {
        if (isGeneralCourse) {
            if (scheme === 'slb') {
                // BUG #1 FIX: SLB always uses group_rate ÷ total_pax regardless of subsidiaries.
                const rate      = isHalfDay ? RATES.inhouse.half_day : RATES.inhouse.full_day;
                const hasActual = actualCourseFeePerPax > 0;
                const perCompany = [];
                let   slbTotal   = 0;

                if (hasActual) {
                    const ceiling     = Math.round(prorateGroup(rate, totalPax) * days);
                    const totalActual = Math.round(actualCourseFeePerPax * totalPax);
                    const claimTotal  = Math.min(totalActual, ceiling);
                    const deficitSlb  = Math.max(0, totalActual - ceiling);

                    const addSLBActual = (lbl, pax) => {
                        if (pax <= 0) return;
                        const share = totalPax > 0 ? Math.round(claimTotal * pax / totalPax) : 0;
                        slbTotal += share;
                        perCompany.push({
                            label: lbl, pax, amount: share,
                            note: `Actual RM${actualCourseFeePerPax.toLocaleString()}/pax × ${pax} pax` +
                                  (deficitSlb > 0 ? ' [ACM ceiling applied]' : '')
                        });
                    };
                    addSLBActual('Host Company', hostPax);
                    branches.forEach(b => addSLBActual(b.label || 'Branch', parseInt(b.pax) || 0));
                    subsidiaries.forEach(s => addSLBActual(s.label || 'Participating Employer', parseInt(s.pax) || 0));

                    push({
                        label:     'B) Course Fee',
                        eligible:  true,
                        amount:    slbTotal,
                        note:      `Actual RM${actualCourseFeePerPax.toLocaleString()}/pax × ${totalPax} pax = RM${totalActual.toLocaleString()} — ACM ceiling RM${ceiling.toLocaleString()}` +
                                   (deficitSlb > 0
                                       ? ` — ceiling applied — HRD Corp pays RM${claimTotal.toLocaleString()} / 💰 Deficit RM${deficitSlb.toLocaleString()} to be funded from employer's own budget`
                                       : ` — within ceiling — HRD Corp pays RM${claimTotal.toLocaleString()}`) +
                                   ` (shared proportionally per employer)`,
                        documents: courseFeeDoc,
                        perCompany
                    });
                } else {
                    const perPaxRate = totalPax > 0 ? rate / totalPax : rate;

                    const addSLBRow = (lbl, pax) => {
                        if (pax <= 0) return;
                        const share = Math.round(perPaxRate * pax * days);
                        slbTotal += share;
                        perCompany.push({
                            label:  lbl, pax, amount: share,
                            note:   `RM${rate.toLocaleString()}/day ÷ ${totalPax} pax × ${pax} pax × ${days} day(s)`
                        });
                    };
                    addSLBRow('Host Company', hostPax);
                    branches.forEach(b => addSLBRow(b.label || 'Branch', parseInt(b.pax) || 0));
                    subsidiaries.forEach(s => addSLBRow(s.label || 'Participating Employer', parseInt(s.pax) || 0));

                    push({
                        label:     'B) Course Fee',
                        eligible:  true,
                        amount:    slbTotal,
                        note:      `SLB — Group rate RM${rate.toLocaleString()}/day ÷ ${totalPax} pax = RM${Math.round(perPaxRate).toLocaleString()}/pax/day (shared proportionally per employer)`,
                        documents: courseFeeDoc,
                        perCompany
                    });
                }
            } else if (usePublicRate) {
                // HCC/SBL with subsidiaries → public per-pax rate
                const sysRate         = isHalfDay ? RATES.public_training.half_day : RATES.public_training.full_day;
                const sysTotalPerPax  = sysRate * days;
                const hasActual       = actualCourseFeePerPax > 0;
                const claimPerPax     = hasActual ? Math.min(actualCourseFeePerPax, sysTotalPerPax) : sysTotalPerPax;
                const deficitPerPax   = hasActual ? Math.max(0, actualCourseFeePerPax - sysTotalPerPax) : 0;
                const ratePerDay      = claimPerPax / days;

                const perCompany = [];
                let totalCourseFee = 0;

                const addPubRow = (label, pax) => {
                    if (pax <= 0) return;
                    const share          = claimPerPax * pax;
                    const companyDeficit = Math.round(deficitPerPax * pax);
                    totalCourseFee += share;
                    perCompany.push({
                        label,
                        pax,
                        amount: Math.round(share),
                        note:   `RM${Math.round(ratePerDay).toLocaleString()}/pax/day × ${pax} pax × ${days} day(s)` +
                                (deficitPerPax > 0
                                    ? ` — HRD Corp pays RM${Math.round(share).toLocaleString()} / 💰 Deficit RM${companyDeficit.toLocaleString()} to be funded from employer's own budget`
                                    : '')
                    });
                };

                const hostGroupPax = hostPax + branchPaxTotal;
                const hostLabel = branchPaxTotal > 0
                    ? `Host Company + Branches (${hostPax} + ${branchPaxTotal} pax)`
                    : 'Host Company';
                addPubRow(hostLabel, hostGroupPax);
                subsidiaries.forEach(s => addPubRow(s.label || 'Subsidiary', parseInt(s.pax) || 0));

                const _def1 = deficitPerPax > 0 ? Math.round(deficitPerPax * totalPax) : 0;
                push({
                    label:     'B) Course Fee',
                    eligible:  true,
                    amount:    Math.round(totalCourseFee),
                    note:      hasActual
                        ? `Actual RM${actualCourseFeePerPax.toLocaleString()}/pax — ACM ceiling RM${sysTotalPerPax.toLocaleString()}/pax` +
                          (deficitPerPax > 0
                              ? ` — ceiling applied (RM${deficitPerPax.toLocaleString()}/pax exceeds ACM) — HRD Corp pays RM${Math.round(totalCourseFee).toLocaleString()} / 💰 Deficit RM${_def1.toLocaleString()} to be funded from employer's own budget`
                              : ` — within ACM ceiling — HRD Corp pays RM${Math.round(totalCourseFee).toLocaleString()}`)
                        : `Public rate — shared by ${numCompanies} companies (RM${sysRate}/pax/day)`,
                    documents: courseFeeDoc,
                    perCompany
                });
            } else {
                // HCC/SBL, no subsidiaries → in-house group rate
                const rate      = isHalfDay ? RATES.inhouse.half_day : RATES.inhouse.full_day;
                const ceiling   = Math.round(prorateGroup(rate, totalPax) * days);
                const hasActual = actualCourseFeePerPax > 0;
                const totalActual = hasActual ? Math.round(actualCourseFeePerPax * totalPax) : ceiling;
                const claimAmount = Math.min(totalActual, ceiling);
                const deficit     = hasActual ? Math.max(0, totalActual - ceiling) : 0;
                push({
                    label:     'B) Course Fee',
                    eligible:  true,
                    amount:    claimAmount,
                    note:      hasActual
                        ? `Actual RM${actualCourseFeePerPax.toLocaleString()}/pax × ${totalPax} pax = RM${totalActual.toLocaleString()} — ACM ceiling RM${ceiling.toLocaleString()}` +
                          (deficit > 0
                              ? ` — ceiling applied — HRD Corp pays RM${claimAmount.toLocaleString()} / 💰 Deficit RM${deficit.toLocaleString()} to be funded from employer's own budget`
                              : ` — within ceiling — HRD Corp pays RM${claimAmount.toLocaleString()}`)
                        : `In-house group rate — RM${rate.toLocaleString()}/group/day × ${days} day(s)` +
                          (totalPax < RATES.inhouse.prorate_threshold ? ' (prorated — less than 5 pax)' : ''),
                    documents: courseFeeDoc,
                    perCompany: []
                });
            }
        } else {
            // As charged (focus area / industry specific / certification) → per pax
            const perCompany = [];
            let totalCourseFee = 0;
            const hasActual = actualCourseFeePerPax > 0;

            const addEstRow = (label, pax) => {
                if (pax <= 0) return;
                const perPaxAmt = hasActual ? actualCourseFeePerPax : RATES.as_charged_estimate * days;
                const share = perPaxAmt * pax;
                totalCourseFee += share;
                perCompany.push({
                    label, pax, amount: Math.round(share),
                    note: hasActual
                        ? `Actual RM${actualCourseFeePerPax.toLocaleString()}/pax × ${pax} pax`
                        : `RM${RATES.as_charged_estimate}/pax/day × ${pax} pax × ${days} day(s) (est.)`
                });
            };

            addEstRow('Host Company', hostPax);
            branches.forEach(b => addEstRow(b.label || 'Branch', parseInt(b.pax) || 0));
            subsidiaries.forEach(s => addEstRow(s.label || 'Subsidiary', parseInt(s.pax) || 0));

            push({
                label:     'B) Course Fee',
                eligible:  true,
                amount:    Math.round(totalCourseFee),
                note:      hasActual
                    ? `${_categoryLabel(courseCategory)} — actual RM${actualCourseFeePerPax.toLocaleString()}/pax × ${totalPax} pax`
                    : `${_categoryLabel(courseCategory)} — estimated at RM${RATES.as_charged_estimate}/pax/day (actual invoice as charged)`,
                documents: courseFeeDoc,
                perCompany,
                isEstimate: !hasActual
            });
        }
    }

    // PUBLIC TRAINING / ROT-PUBLIC / LOCAL SEMINAR-CONFERENCE
    if (isPublicFee) {
        if (isGeneralCourse) {
            // BUG #2 FIX: Cap eligible pax at 9 per employer. No in-house rate switch.
            const maxPax      = isLocalSeminar ? totalPax : RATES.public_training.max_pax_per_employer;
            const eligiblePax = Math.min(totalPax, maxPax);
            const excessPax   = totalPax - eligiblePax;

            const sysRate        = isHalfDay ? RATES.public_training.half_day : RATES.public_training.full_day;
            const sysTotalPerPax = sysRate * days;
            const hasActual      = actualCourseFeePerPax > 0;
            const claimPerPax    = hasActual ? Math.min(actualCourseFeePerPax, sysTotalPerPax) : sysTotalPerPax;
            const deficitPerPax  = hasActual ? Math.max(0, actualCourseFeePerPax - sysTotalPerPax) : 0;
            const amount         = Math.round(claimPerPax * eligiblePax);
            const _def2          = deficitPerPax > 0 ? Math.round(deficitPerPax * eligiblePax) : 0;

            push({
                label:     'B) Course Fee',
                eligible:  true,
                amount,
                note:      hasActual
                    ? `Actual RM${actualCourseFeePerPax.toLocaleString()}/pax — ACM ceiling RM${sysTotalPerPax.toLocaleString()}/pax` +
                      (deficitPerPax > 0
                          ? ` — ceiling applied — HRD Corp pays RM${amount.toLocaleString()} / 💰 Deficit RM${_def2.toLocaleString()} to be funded from employer's own budget`
                          : ` — within ACM ceiling — HRD Corp pays RM${amount.toLocaleString()}`)
                    : `ACM rate: RM${sysRate}/pax/day × ${eligiblePax} pax × ${days} day(s)`,
                documents: courseFeeDoc
            });

            if (excessPax > 0) {
                warnings.push(
                    `⚠️ Pax cap applied: Only ${eligiblePax} of ${totalPax} pax are eligible for financial assistance ` +
                    `(maximum ${RATES.public_training.max_pax_per_employer} pax per employer for public/ROT training). ` +
                    `The remaining ${excessPax} pax must be self-funded by the employer.`
                );
            }
        } else {
            push({
                label:     'B) Course Fee',
                eligible:  true,
                amount:    Math.round(RATES.as_charged_estimate * totalPax * days),
                note:      `${_categoryLabel(courseCategory)} — estimated at RM${RATES.as_charged_estimate}/pax/day`,
                documents: courseFeeDoc,
                isEstimate: true
            });
        }
    }

    // E-LEARNING / MOBILE E-LEARNING
    if (isElearning) {
        const totalHours = Math.max(1, Math.round(elearningHours));
        let ratePerPax   = 0;
        const noteBlocks = [];
        let remaining    = totalHours;

        const firstBlock = Math.min(remaining, 7);
        ratePerPax += RATES.elearning.hour_table[firstBlock];
        noteBlocks.push(`${firstBlock}hr = RM${RATES.elearning.hour_table[firstBlock]}`);
        remaining -= firstBlock;

        while (remaining > 0) {
            if (remaining <= 4) {
                ratePerPax += RATES.elearning.hour_table[4];
                noteBlocks.push(`+${remaining}hr [half-day block] = RM${RATES.elearning.hour_table[4]}`);
                remaining = 0;
            } else {
                const block = Math.min(remaining, 7);
                ratePerPax += RATES.elearning.hour_table[7];
                noteBlocks.push(`+${block}hr [full-day block] = RM${RATES.elearning.hour_table[7]}`);
                remaining -= block;
            }
        }

        push({
            label:     'B) Course Fee (E-Learning)',
            eligible:  true,
            amount:    Math.round(ratePerPax * totalPax),
            note:      `${noteBlocks.join(' | ')} — RM${ratePerPax}/pax × ${totalPax} pax`,
            documents: courseFeeDoc
        });
    }

    // OVERSEAS TRAINING — DEFICIT 5 FIX: apply max 9 pax cap
    if (isOverseas) {
        const maxOvsPax      = RATES.public_training.max_pax_per_employer;
        const eligibleOvsPax = Math.min(totalPax, maxOvsPax);
        const excessOvsPax   = totalPax - eligibleOvsPax;

        const hasActual   = actualCourseFeePerPax > 0;
        const basePpax    = hasActual ? actualCourseFeePerPax : RATES.as_charged_estimate * days;
        const totalActual = basePpax * eligibleOvsPax;
        const claimable   = Math.round(totalActual * RATES.overseas.assistance_rate);
        const deficit     = totalActual - claimable;

        push({
            label:     'B) Course Fee (Overseas)',
            eligible:  true,
            amount:    claimable,
            note:      hasActual
                ? `Actual RM${actualCourseFeePerPax.toLocaleString()}/pax × ${eligibleOvsPax} pax = RM${totalActual.toLocaleString()} — 50% assistance = RM${claimable.toLocaleString()} / 💰 Co-payment RM${deficit.toLocaleString()} (50% not covered) to be funded from employer's own budget`
                : `As charged (est. RM${(RATES.as_charged_estimate * days).toLocaleString()}/pax) × ${eligibleOvsPax} pax — 50% assistance = RM${claimable.toLocaleString()} / employer co-pays remaining 50%`,
            documents: courseFeeDoc,
            isEstimate: !hasActual
        });

        if (excessOvsPax > 0) {
            warnings.push(
                `⚠️ Overseas training pax cap: Only ${eligibleOvsPax} of ${totalPax} pax are eligible for financial assistance ` +
                `(maximum ${maxOvsPax} pax per employer). The remaining ${excessOvsPax} pax must be self-funded by the employer.`
            );
        }
    }

    // DEFICIT 12 FIX: Overseas Seminar & Conference — 50% assistance on course fee
    if (isOverseasSeminar) {
        const hasActual   = actualCourseFeePerPax > 0;
        const basePpax    = hasActual ? actualCourseFeePerPax : RATES.as_charged_estimate * days;
        const totalActual = basePpax * totalPax;
        const claimable   = Math.round(totalActual * RATES.seminar.overseas_assistance);
        const deficit     = totalActual - claimable;

        push({
            label:     'Seminar / Conference Fee (Overseas)',
            eligible:  true,
            amount:    claimable,
            note:      hasActual
                ? `Actual RM${actualCourseFeePerPax.toLocaleString()}/pax × ${totalPax} pax = RM${totalActual.toLocaleString()} — 50% assistance = RM${claimable.toLocaleString()} / 💰 Co-payment RM${deficit.toLocaleString()} to be funded from employer's own budget`
                : `As charged (est. RM${(RATES.as_charged_estimate * days).toLocaleString()}/pax) × ${totalPax} pax — 50% assistance = RM${claimable.toLocaleString()} / employer co-pays remaining 50%`,
            documents: courseFeeDoc,
            isEstimate: !hasActual
        });
    }

    // ─────────────────────────────────────────────────────────
    // C) TRAVEL ALLOWANCE  +  D) MEAL ALLOWANCE
    //
    // DEFICIT 6 FIX: Removed separate ROT-inhouse meal block; integrated into unified block below.
    //                Trainer meal bonus suppressed for ROT (ACM Table 7: "host trainees only").
    // DEFICIT 7 FIX: Removed `!isROT` guard — ROT travel IS claimable (venue-dependent).
    // DEFICIT 11 FIX: +1 extra travel day for staff ≥100km (full-day training only).
    // ─────────────────────────────────────────────────────────
    if (!isElearning && !isAnyOverseas && !isDevelopment) {

        if (isHotel || isPublic || isROTPublic || isLocalSeminar) {
            // All participants travel to venue; no meal (hotel/venue covers meals)
            // Includes: ROT at external venue, public, ROT-public, local seminar
            let travelTotal = 0;
            const breakdown = [];

            const addTravel = (label, pax, kmDist) => {
                if (pax <= 0) return;
                const rate       = travelRate(kmDist);
                const travelDays = travelDaysFor(kmDist);
                const amt        = rate * pax * travelDays;
                travelTotal += amt;
                breakdown.push({
                    label, pax, amount: Math.round(amt),
                    note: `RM${rate}/pax/day × ${pax} pax × ${travelDays} day(s) (${kmLabel(kmDist)})` +
                          (travelDays > days ? ' [+1 extra travel day for ≥100km]' : '')
                });
            };

            addTravel('Host Company', hostPax, host.kmDistance);
            branches.forEach(b => addTravel(b.label || 'Branch', parseInt(b.pax) || 0, b.kmDistance));
            // Subsidiaries excluded — each subsidiary applies separately (see note below)

            if (travelTotal > 0) {
                push({
                    label:     'C) Travel Allowance',
                    eligible:  true,
                    amount:    Math.round(travelTotal),
                    note:      'All participants travel to external venue',
                    documents: CLAIM_DOCS.none,
                    perCompany: breakdown
                });
            }

        } else if (isInhouse && !isHotel) {
            // Own premise (includes ROT own premise):
            // — host company staff → meal allowance
            // — branches / subsidiaries → travel allowance
            let mealTotal   = 0;
            let travelTotal = 0;
            const mealBreakdown   = [];
            const travelBreakdown = [];

            // BUG #3 FIX: Internal trainer at employer's own premise gets +1 meal pax.
            // DEFICIT 6 FIX: Trainer meal bonus suppressed for ROT (trainer is remote).
            const trainerMealBonus = (trainerType === 'internal' && !internalTrainerFromBranch && !isROT) ? 1 : 0;
            const mealPaxHost = hostPax + trainerMealBonus;

            if (mealPaxHost > 0) {
                const amt = mealRate * mealPaxHost * days;
                mealTotal += amt;
                mealBreakdown.push({
                    label:  'Host Company' + (trainerMealBonus ? ' + Internal Trainer' : ''),
                    pax:    mealPaxHost,
                    amount: Math.round(amt),
                    note:   `RM${mealRate}/pax/day × ${mealPaxHost} pax` +
                            (trainerMealBonus ? ` (${hostPax} staff + 1 trainer)` : '') +
                            ` × ${days} day(s)${isHalfDay ? ' (half-day)' : ''}`
                });
            }

            branches.forEach(b => {
                const bPax = parseInt(b.pax) || 0;
                if (bPax <= 0) return;
                const rate       = travelRate(b.kmDistance);
                const travelDays = travelDaysFor(b.kmDistance);
                const amt        = rate * bPax * travelDays;
                travelTotal += amt;
                travelBreakdown.push({
                    label: b.label || 'Branch', pax: bPax, amount: Math.round(amt),
                    note: `RM${rate}/pax/day × ${bPax} pax × ${travelDays} day(s) (${kmLabel(b.kmDistance)})` +
                          (travelDays > days ? ' [+1 extra travel day for ≥100km]' : '')
                });
            });

            // Subsidiaries excluded from travel — each subsidiary applies separately (see note below)

            if (mealTotal > 0) {
                push({
                    label:     'D) Meal Allowance',
                    eligible:  true,
                    amount:    Math.round(mealTotal),
                    note:      `RM${mealRate}/pax/day — host company staff at employer premises${isHalfDay ? ' (half-day rate)' : ''}`,
                    documents: CLAIM_DOCS.none,
                    perCompany: mealBreakdown
                });
            }

            if (travelTotal > 0) {
                push({
                    label:     'C) Travel Allowance',
                    eligible:  true,
                    amount:    Math.round(travelTotal),
                    note:      'Branch / subsidiary staff travelling to training venue',
                    documents: CLAIM_DOCS.none,
                    perCompany: travelBreakdown
                });
            }
        }
    }

    // ─────────────────────────────────────────────────────────
    // E) OVERSEAS TRAINER DAILY ALLOWANCE
    // ─────────────────────────────────────────────────────────
    if (isInhouse && trainerType === 'overseas') {
        push({
            label:     'E) Overseas Trainer Daily Allowance',
            eligible:  true,
            amount:    Math.round(RATES.allowances.overseas_trainer * numberOfTrainers * days),
            note:      `RM${RATES.allowances.overseas_trainer}/trainer/day × ${numberOfTrainers} trainer(s) × ${days} day(s)`,
            documents: CLAIM_DOCS.none
        });
    }

    // ─────────────────────────────────────────────────────────
    // G) AIR TICKET
    // ─────────────────────────────────────────────────────────
    let airTicketEntitled = 0;
    const airTicketGroups = [];

    branches.forEach(b => {
        const bPax = parseInt(b.pax) || 0;
        if (bPax > 0) { airTicketEntitled += bPax; airTicketGroups.push(`${b.label || 'Branch'}: ${bPax} pax`); }
    });
    // Subsidiaries excluded from air ticket — each subsidiary applies separately (see note below)

    if ((isHotel || isAnyOverseas || isPublic || isSeminar) && hostPax > 0) {
        airTicketEntitled += hostPax;
        airTicketGroups.push(`Host Company: ${hostPax} pax`);
    }

    // Trainer air ticket — in-house training only
    if (isInhouse) {
        // External trainer: air ticket only when there are branch/sub trainees (long-distance context)
        // OR venue is external hotel (everyone travels). At own premise with no branches, the
        // external trainer is assumed local — no air ticket entitlement.
        const hasBranchesOrSubs = branchPaxTotal > 0 || subPaxTotal > 0;
        if (trainerType === 'external' && (isHotel || hasBranchesOrSubs)) {
            airTicketEntitled += 1; airTicketGroups.push('External trainer: 1');
        } else if (trainerType === 'overseas') {
            // Overseas trainer always has air ticket — they flew in from overseas
            airTicketEntitled += 1; airTicketGroups.push('Overseas trainer: 1');
        } else if (trainerType === 'internal' && internalTrainerFromBranch) {
            airTicketEntitled += 1; airTicketGroups.push('Internal trainer (from branch): 1');
        }
    }

    // Air ticket NOT claimable for e-learning or ROT (trainer delivers online)
    if (airTicketEntitled > 0 && !isElearning && !isROT) {
        push({
            label:         'G) Air Ticket',
            eligible:      true,
            amount:        null,
            entitledCount: airTicketEntitled,
            note:          `${airTicketEntitled} person(s) entitled — actual airfare cost` +
                           (isAnyOverseas ? ' × 50% assistance' : '') +
                           ` (${airTicketGroups.join(', ')})`,
            documents:     CLAIM_DOCS.air_ticket
        });
    }

    // ─────────────────────────────────────────────────────────
    // H) CHARTERED TRANSPORTATION
    // DEFICIT 8 FIX: ROT at external hotel CAN claim chartered transport — removed `!isROT`
    // ─────────────────────────────────────────────────────────
    if (!isElearning && isHotel) {
        push({ label: 'H) Chartered Transportation', eligible: true, amount: null, note: 'As per quotation', documents: CLAIM_DOCS.transport });
    }

    // ─────────────────────────────────────────────────────────
    // I) CONSUMABLE TRAINING MATERIALS
    // DEFICIT: Removed `!isROT` — ROT consumables ARE claimable per ACM Table 7
    // ─────────────────────────────────────────────────────────
    if (!isElearning && !isPublic && !isROTPublic && !isSeminar && !isOverseas && !isDevelopment) {
        const consumableNote = scheme === 'slb'
            ? `RM${RATES.allowances.consumable}/group — SLB: only the organising employer may claim consumable materials`
            : `RM${RATES.allowances.consumable}/group (no receipt needed up to this amount)`;

        push({
            label:     'I) Consumable Training Materials',
            eligible:  true,
            amount:    RATES.allowances.consumable,
            note:      consumableNote,
            documents: 'No receipt needed up to RM100. If total > RM100, itemised invoice required.'
        });

        // GAP #5 FIX: Warn SLB employers that only the organiser may claim
        if (scheme === 'slb') {
            warnings.push(
                `⚠️ SLB — Consumable Materials: Only the organising employer may claim consumable/printed materials. ` +
                `Other participating employers are not entitled to claim this item.`
            );
        }
    }

    // ─────────────────────────────────────────────────────────
    // LTM — LICENSED TRAINING MATERIALS (in-house only)
    // DEFICIT 10 FIX: New cost item; requires HRD Corp pre-approval
    // ─────────────────────────────────────────────────────────
    if (isInhouse && hasLTM) {
        push({
            label:     'LTM) Licensed Training Materials',
            eligible:  true,
            amount:    ltmActualCost > 0 ? ltmActualCost : null,
            note:      ltmActualCost > 0
                ? `Actual cost RM${ltmActualCost.toLocaleString()} — requires HRD Corp Special Approval Letter`
                : `As charged — requires HRD Corp Special Approval Letter prior to grant submission`,
            documents: 'HRD Corp Special Approval Letter + official invoice'
        });
        warnings.push(
            `📋 Licensed Training Materials (LTM): Pre-approval from HRD Corp is required. ` +
            `Submit the Special Approval Letter together with your grant application. ` +
            `LTM is only eligible for in-house training programmes.`
        );
    }

    // ─────────────────────────────────────────────────────────
    // OVERSEAS DAILY ALLOWANCE (Overseas Training + Overseas Seminar)
    // ─────────────────────────────────────────────────────────
    if (isAnyOverseas) {
        const clampedExtra  = Math.min(RATES.overseas.extra_days_max, Math.max(0, parseInt(extraDays) || 0));
        const totalDays     = days + clampedExtra;
        // Overseas training: pax capped at 9. Overseas seminar: no pax cap.
        const daEligiblePax = isOverseas
            ? Math.min(totalPax, RATES.public_training.max_pax_per_employer)
            : totalPax;
        const claimable     = Math.round(RATES.overseas.daily_allowance * daEligiblePax * totalDays * RATES.overseas.assistance_rate);
        push({
            label:     'Overseas Daily Allowance',
            eligible:  true,
            amount:    claimable,
            note:      `RM${RATES.overseas.daily_allowance}/pax/day × ${daEligiblePax} pax × ${totalDays} day(s) ` +
                       `(${days} training + ${clampedExtra} travel day${clampedExtra !== 1 ? 's' : ''}) — 50% assistance = RM${claimable.toLocaleString()}`,
            documents: CLAIM_DOCS.none
        });
    }

    // ─────────────────────────────────────────────────────────
    // DEVELOPMENT PROGRAMME (HCC / SBL only)
    // ─────────────────────────────────────────────────────────
    if (isDevelopment) {
        const isOverseasDev = devLocation === 'overseas';
        const isMasterPhD   = devLevel === 'masters' || devLevel === 'phd';
        const isSKM         = devLevel === 'skm';
        const months        = Math.max(1, parseInt(devMonths) || 3);
        const devDays       = months * 30;

        if (months < 3) {
            warnings.push(
                `⚠️ Minimum course duration for Development Programmes is 3 months ` +
                `(${3 * 30} training days). Current input: ${months} month(s) = ${devDays} days — ` +
                `does not meet the ACM eligibility threshold.`
            );
        }

        const feeAssistPct = (!isOverseasDev || isMasterPhD || devPrivateInstitution) ? 100 : 50;
        const feeAssistNote = !isOverseasDev         ? '100% (local)'
            : isMasterPhD                            ? '100% (overseas Masters/PhD)'
            : devPrivateInstitution                  ? '100% (overseas — private higher education institution)'
            :                                          '50% (overseas)';

        const hasActualDev   = actualCourseFeePerPax > 0;
        const baseFeePerPax  = hasActualDev ? actualCourseFeePerPax : RATES.dev_estimate;
        const actualFeeTotal = baseFeePerPax * totalPax;
        const devClaimable   = Math.round(actualFeeTotal * feeAssistPct / 100);
        const devDeficit     = actualFeeTotal - devClaimable;

        push({
            label:     'B) Course Fee',
            eligible:  true,
            amount:    devClaimable,
            note:      `${_devLevelLabel(devLevel)} — ` +
                       (hasActualDev
                           ? `actual RM${actualCourseFeePerPax.toLocaleString()}/pax`
                           : `est. RM${RATES.dev_estimate.toLocaleString()}/pax`) +
                       ` × ${totalPax} pax × ${feeAssistNote}` +
                       (isOverseasDev ? ' (convert fees to RM at time of claim)' : '') +
                       ` — includes registration & examination fees` +
                       (hasActualDev && devDeficit > 0
                           ? ` / 💰 Co-payment RM${Math.round(devDeficit).toLocaleString()} (${100 - feeAssistPct}% not covered by HRD Corp) to be funded from employer's own budget`
                           : ''),
            documents: courseFeeDoc,
            isEstimate: !hasActualDev
        });

        // DEFICIT 9 FIX: Travel allowance is NOT applicable for development programme (ACM Table 8)
        // Removed incorrectly added travel block that was previously here

        push({
            label:     'I) Consumable Training Materials',
            eligible:  true,
            amount:    RATES.allowances.consumable,
            note:      `RM${RATES.allowances.consumable}/group (no receipt needed up to this amount)`,
            documents: 'No receipt needed up to RM100. If total > RM100, itemised invoice required.'
        });

        if (devFullTime) {
            const studyRate = isOverseasDev
                ? RATES.development.study_overseas
                : RATES.development.study_local;
            const studyPct  = (isOverseasDev && isMasterPhD) ? 50 : 100;
            const studyAmt  = Math.round(studyRate * months * totalPax * studyPct / 100);
            push({
                label:     'Study Allowance',
                eligible:  true,
                amount:    studyAmt,
                note:      `RM${studyRate.toLocaleString()}/month × ${months} month(s) × ${totalPax} pax` +
                           (studyPct < 100 ? ` × ${studyPct}% assistance` : ''),
                documents: CLAIM_DOCS.none
            });
        }

        if (devFullTime && isMasterPhD) {
            const thesisRate = devLevel === 'phd'
                ? RATES.development.thesis_phd
                : RATES.development.thesis_masters;
            push({
                label:     'Thesis Allowance',
                eligible:  true,
                amount:    thesisRate * totalPax,
                note:      `RM${thesisRate}/pax × ${totalPax} pax`,
                documents: CLAIM_DOCS.none
            });
        }

        if (isOverseasDev) {
            push({
                label:     'G) Air Ticket',
                eligible:  true,
                amount:    null,
                note:      `As per quotation — 50% financial assistance on airfare`,
                documents: CLAIM_DOCS.air_ticket
            });
        } else if (isHotel && host.kmDistance === 'over_100') {
            push({
                label:     'G) Air Ticket',
                eligible:  true,
                amount:    null,
                note:      `${totalPax} trainee(s) — ≥100km to institution, air ticket may be claimable (actual cost)`,
                documents: CLAIM_DOCS.air_ticket
            });
        }

        if (isSKM) {
            warnings.push(
                `📌 Sijil Kemahiran Malaysia (SKM) has 5 levels: SKM Level 1, SKM Level 2, SKM Level 3, ` +
                `SKM Level 4, and SKM Level 5. Courses are offered by technical and vocational institutions ` +
                `accredited by the Department of Skills Development (Jabatan Pembangunan Kemahiran — JPK), ` +
                `Ministry of Human Resources.`
            );
        }

        if (scheme === 'hcc') {
            warnings.push(
                `📋 HCC — Development Programme Notes:\n` +
                `• All modules must be registered with HRD Corp\n` +
                `• Can be claimed on a modular, semester, or whole duration basis\n` +
                `• Course fees MUST be entirely borne by the employer — employees must not pay any portion where HRD Corp assistance is available`
            );
        }
        if (scheme === 'sbl') {
            warnings.push(
                `📋 SBL — Development Programme Notes:\n` +
                `• Course must be locally or overseas accredited\n` +
                `• Cross-check MQA accreditation at: https://www2.mqa.gov.my/mqr/\n` +
                `• Can be claimed on a modular, semester, or whole duration basis\n` +
                `• Course fees MUST be entirely borne by the employer — employees must not pay any portion where HRD Corp assistance is available`
            );
        }

        warnings.push(
            `ℹ️ Development Programme — Key Rules:\n` +
            `• Minimum 3 months (1 month = 30 training days, minimum = 90 days total)\n` +
            `• Can be claimed on modular, semester, or whole duration basis\n` +
            `• Course fees claimable as per quotation — includes registration & examination fees\n` +
            `• Course fees MUST be entirely borne by the employer. Employees must not pay any portion of fees where HRD Corp assistance is available\n` +
            `• Study allowance (RM${(isOverseasDev ? RATES.development.study_overseas : RATES.development.study_local).toLocaleString()}/month) is for full-time students only — prorated daily if programme starts/ends mid-month\n` +
            `• Overseas Masters/PhD: 100% course fees, 50% study allowance & airfare\n` +
            `• Overseas courses at private higher education institutions: 100% course fees\n` +
            `• Trainer is always external (institution staff)`
        );
    }

    // ─────────────────────────────────────────────────────────
    // CONTEXTUAL WARNINGS
    // ─────────────────────────────────────────────────────────
    if (isInhouse && usePublicRate && isGeneralCourse) {
        const rate = isHalfDay ? RATES.public_training.half_day : RATES.public_training.full_day;
        warnings.push(`ℹ️ ${numSubsidiaries} subsidiary/subsidiaries involved — public rate (RM${rate}/pax/day) applied. Cost shared between Host+Branches and each subsidiary based on pax.`);
    }

    // Subsidiaries — other allowable costs note
    if (numSubsidiaries > 0) {
        warnings.push(
            `📋 Subsidiaries — Other Allowable Costs: Travel allowance, meal allowance, and air ticket are calculated ` +
            `above for the Host Company and its Branches only. Each subsidiary is eligible for these allowances ` +
            `on the same terms but must submit their own separate HRD Corp grant application to claim them.`
        );
    }
    if (scheme === 'slb' && isInhouse && isGeneralCourse) {
        const rate = isHalfDay ? RATES.inhouse.half_day : RATES.inhouse.full_day;
        warnings.push(
            `ℹ️ SLB — Cost Sharing: In-house group rate (RM${rate.toLocaleString()}/day) is divided equally across ` +
            `all ${totalPax} participants = RM${Math.round(rate / (totalPax || 1)).toLocaleString()}/pax/day. ` +
            `Each employer pays only for their own participants.`
        );
    }
    if (isAnyOverseas) {
        warnings.push('ℹ️ Overseas training/seminar: 50% financial assistance rate applies on course fee, daily allowance, and air ticket.');
    }

    // DEFICIT 16 FIX: ROT warning now correctly states travel IS claimable (venue-dependent)
    if (isROT) {
        warnings.push(
            'ℹ️ ROT (Remote Online Training): Air ticket is NOT claimable. ' +
            'Travel allowance IS claimable — own premise: branch/subsidiary trainees only; external venue: all trainees. ' +
            'Chartered transport IS claimable at external venues.'
        );
    }
    warnings.push('ℹ️ Attendance must be ≥75% of total training hours. Allowances are prorated by attendance.');
    if (airTicketEntitled > 0 && !isROT) {
        warnings.push('ℹ️ Air ticket (actual cost) must be supported by ticket stub / e-Ticket and travel agent invoice.');
    }
    if (items.some(i => i.isEstimate)) {
        warnings.push('⚠️ Items marked "est." use RM10,000/pax as proxy for "as charged" categories. Actual invoice determines final claimable amount.');
    }

    // ─────────────────────────────────────────────────────────
    // SUPPORTING DOCUMENTS — FULLY TAILORED
    // Source: ACM Guide September 2025
    //   — Type of Programmes section: per-scheme grant submission docs
    //   — Allowable Cost Matrix section: per-cost-item "Supporting Document(s)" column
    //
    // Tailored by: scheme × training type × trainer type × venue × items in result
    // ─────────────────────────────────────────────────────────
    const isAsCharged = ['focus_area', 'industry_specific', 'certification'].includes(courseCategory);

    // Detect which cost items are actually in the result — drives per-item doc requirements
    const hasCourseFeeItem  = items.some(i =>
        i.label.startsWith('B) Course Fee') ||
        i.label.startsWith('Seminar / Conference Fee')
    );
    const hasAirTicketItem  = items.some(i => i.label.startsWith('G) Air Ticket') || i.label === 'Air Ticket');
    const hasCharteredItem  = items.some(i => i.label.startsWith('H) Chartered'));
    const hasConsumableItem = items.some(i => i.label.startsWith('I) Consumable'));

    const grantDocs = [];

    // ── 1. Course content with schedule ──────────────────────
    grantDocs.push({
        text: isDevelopment
            ? 'Complete course syllabus (if claiming by semester, attach syllabus for ALL semesters)'
            : 'Course content with training schedule, including date and time'
    });

    // ── 2. Trainer profile ───────────────────────────────────
    // Skipped for Development (institution confirmation letter covers this — added below)
    if (!isDevelopment) {
        grantDocs.push({ text: scheme === 'hcc' ? 'Accredited trainer profile' : 'Trainer profile' });
    }

    // ── 3. Invoice / quotation for course fees ───────────────
    // Only when a course fee item is actually in the result.
    // Internal trainer → Trainer Allowance instead; no "course fee invoice" applies.
    if (hasCourseFeeItem || isDevelopment) {
        if (scheme === 'slb') {
            grantDocs.push({ text: 'Invoice or quotation for course fees — ONE invoice per training course only' });
        } else {
            grantDocs.push({ text: 'Invoice or quotation for course fees' });
        }
    }

    // ── 4. Development programme: confirmation letter (+ MQA for SBL) ──
    if (isDevelopment) {
        grantDocs.push({ text: 'Confirmation letter from college / university' });
        if (scheme === 'sbl') {
            grantDocs.push({ text: 'MQA Certificate for the course (programme must be MQA accredited — verify at https://www2.mqa.gov.my/mqr/)' });
        }
    }

    // ── 5. Subsidiary confirmation letter (HCC / SBL only) ───
    // Required when subsidiaries are present — host company must confirm the subsidiary
    // relationship and their participation. SLB already covers this via the Joint Training Letter.
    if (numSubsidiaries > 0 && (scheme === 'hcc' || scheme === 'sbl')) {
        grantDocs.push({
            text: 'Letter from the Host Company confirming subsidiary participation in the training',
            subItems: [
                'Name and HRD Corp Employer Code of each subsidiary (if registered)',
                'Confirmation that the subsidiary is a related company under the same group',
                'Course title, training date, and number of participants from each subsidiary',
                'Signed by an authorised representative of the Host Company',
            ]
        });
    }

    // ── 6. SBL: vendor / service agreement ───────────────────
    // Only if trainer is NOT internal (no external vendor for internal trainer programmes)
    if (scheme === 'sbl' && trainerType !== 'internal' && !isDevelopment) {
        grantDocs.push({ text: 'Service or sales agreement between vendor and employer, or receipt / invoice of item purchase (if vendor conducts the training)' });
    }

    // ── 6. SLB: Joint Training Letter ────────────────────────
    if (scheme === 'slb') {
        grantDocs.push({
            text: 'Joint Training Letter from the organising employer, must include:',
            subItems: [
                "i.  Organiser and participants from each employer — include each participating employer's name and HRD Corp Employer Code (if registered)",
                'ii.  Name of organiser',
                'iii. Course title and training date',
                'iv.  Training venue',
                'v.   Number of pax from each employer',
                'vi.  Cost breakdown',
                'vii. Signature by the organising employer',
            ]
        });
    }

    // ── 7. ROT: System Generated Attendance Report ────────────
    if (isROT) {
        grantDocs.push({
            text: 'System Generated Attendance Report (mandatory for Remote Online Training)',
            subItems: [
                'Training title (optional)',
                'Training date (mandatory)',
                "Trainee's name",
                'Precise timestamps: clock-in and clock-out times, or total duration attended',
                'Signed and declared by Training Provider and Employer — with company stamp, name, position and date',
            ]
        });
    }

    // ── 8. Chartered transport invoice ───────────────────────
    // Applicable when venue is external hotel (non-elearning) — chartered transport is eligible
    if (isHotel && !isElearning && !isAnyOverseas) {
        grantDocs.push({ text: 'Invoice or quotation for chartered transportation (if any)' });
    }

    // ── 9. HRD Corp Special Approval Letter ──────────────────
    // Only for in-house training types where LTM (Licensed Training Materials) is applicable.
    // Not applicable for elearning, overseas, seminar/conference, public, development.
    if (isInhouse) {
        grantDocs.push({
            text: hasLTM
                ? 'HRD Corp Special Approval Letter (REQUIRED — Licensed Training Materials selected)'
                : 'HRD Corp Special Approval Letter (if any)',
            subItems: [
                'i.  Licensed physical and/or digital training material',
                'ii. Any other variations requiring prior approval',
            ]
        });
    }

    // ── 10. Acknowledgement Letter ───────────────────────────
    // For Focus Area / Industry Specific / Certification courses (not applicable to development)
    if (isAsCharged && !isDevelopment) {
        grantDocs.push({ text: 'Acknowledgement Letter for Industry Specific or Focus Area courses (case-by-case basis)' });
    }

    // ── Per-cost-item supporting documents ───────────────────
    // Source: ACM Matrix "Supporting Document(s)" column.
    // These are appended when the relevant cost item is actually in the result.

    // Air Ticket → Ticket stub / e-Ticket + travel agent invoice
    if (hasAirTicketItem) {
        grantDocs.push({ text: 'Air Ticket: Ticket stub / e-Ticket evidence or receipt, and invoice from the travel agent' });
    }

    // Chartered Transport → Receipt from transport provider
    if (hasCharteredItem) {
        grantDocs.push({ text: 'Chartered Transport: Receipt from the transport provider' });
    }

    // Consumable Training Materials → itemised invoice if total > RM100
    if (hasConsumableItem) {
        grantDocs.push({ text: 'Consumable Training Materials: No receipt needed if total ≤ RM100. If total exceeds RM100, attach itemised quotation or invoice with price per item' });
    }

    // Licensed Training Materials (LTM) → specific documents from principal supplier
    if (hasLTM && isInhouse) {
        grantDocs.push({
            text: 'Licensed Training Materials (LTM) — required documents:',
            subItems: [
                'Official letter to HRD Corp authorising use of licensed training materials',
                'Invoice(s) from principal supplier showing ACTUAL purchase price (not resale price)',
                'Soft copy of licensed training materials',
            ]
        });
    }

    return {
        items,
        airTicketEntitled,
        totalClaimable: Math.round(totalClaimable),
        warnings,
        supportingDocs: { grantSubmission: grantDocs }
    };
}

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────
function _categoryLabel(cat) {
    return {
        focus_area:            'Focus Area Course',
        industry_specific:     'Industry Specific Course',
        certification:         'Professional Certification Course',
        general_non_technical: 'General (Non-Technical) Course',
        general_technical:     'General (Technical) Course',
    }[cat] || cat;
}

function _devLevelLabel(level) {
    return {
        phd:     'Doctoral / PhD',
        masters: "Master's Programme",
        degree:  'Degree Programme',
        diploma: 'Diploma Programme',
        skm:     'Sijil Kemahiran Malaysia (SKM)'
    }[level] || level;
}
