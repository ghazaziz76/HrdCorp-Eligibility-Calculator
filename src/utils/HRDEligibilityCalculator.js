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
 *   subsidiaries[] — Separate companies (travel allowance, triggers public rate if any present)
 *
 * Max pax: 25 per session (1 trainer) / 50 per session (2 trainers)
 */

// ─────────────────────────────────────────────────────────────
// ACM RATES
// ─────────────────────────────────────────────────────────────
const RATES = {
    inhouse: {
        full_day:  10500,   // RM/day/group
        half_day:   6000,   // RM/half-day/group
        min_pax:       5    // prorate if below this
    },
    public_training: {
        full_day:   1750,   // RM/day/pax
        half_day:   1000    // RM/half-day/pax
    },
    elearning: {
        hour_table: { 1:125, 2:250, 3:375, 4:500, 5:625, 6:750, 7:875 }
    },
    overseas: {
        daily_allowance:      1500,   // RM/day/pax
        extra_days_allowed:      2,
        financial_assistance:  0.50   // 50% of course fee + air ticket
    },
    allowances: {
        internal_trainer_full:  1400,  // RM/day/group
        internal_trainer_half:   800,  // RM/half-day/group
        travel_under_100:        250,  // RM/day/pax  (<100km)
        travel_over_100:         500,  // RM/day/pax  (≥100km)
        meal:                    100,  // RM/day/pax
        overseas_trainer:        500,  // RM/day/pax
        consumable_materials:    100   // RM/group (no receipt up to this)
    },
    as_charged_estimate:      10000,  // RM/pax — Focus Area, Industry Specific, Certification
    dev_estimate:             20000,  // RM/pax — All Development Programmes (as charged estimate)
    trainer_ratio_pax:           25,  // Reference ratio for AURA audit risk flag (not a statutory cap)
    development: {
        study_allowance_local:   900,   // RM/month/pax (full-time, local)
        study_allowance_overseas:5000,  // RM/month/pax (full-time, overseas)
        thesis_masters:          600,   // RM/pax (full-time)
        thesis_phd:             1000    // RM/pax (full-time)
    }
};

// ─────────────────────────────────────────────────────────────
// SUPPORTING DOCUMENTS
// ─────────────────────────────────────────────────────────────
const DOCS = {
    course_fee_hcc: 'Invoice issued to HRD Corp (HCC Scheme) or Receipt (Other Schemes)',
    no_document:    'No supporting document needed',
    air_ticket:     'Ticket stub / e-Ticket evidence / receipt and invoice from travel agent',
    transport:      'Receipt from transport provider'
};

// ─────────────────────────────────────────────────────────────
// MAIN EXPORT
// ─────────────────────────────────────────────────────────────

/**
 * Calculate HRD Corp ACM eligibility.
 *
 * @param {object} inputs
 *   scheme                    {string}  'hcc'|'sbl'|'slb'
 *   trainingType              {string}  'inhouse'|'rot_inhouse'|'rot_public'|'public'|'elearning'|'overseas'|'development'
 *   trainerType               {string}  'internal'|'external'|'overseas'
 *   numberOfTrainers          {number}  1 or 2  (determines max pax: 25 or 50)
 *   venue                     {string}  'employer_premises'|'external_hotel'
 *   courseCategory            {string}  'general'|'focus_area'|'industry_specific'|'certification'
 *   duration                  {string}  'full_day'|'half_day'
 *   days                      {number}
 *   elearningHours            {number}  1–7
 *   internalTrainerFromBranch {boolean}
 *
 *   host          {object}  { pax, kmDistance }
 *     pax         {number}  host company staff attending
 *     kmDistance  {string}  'under_100'|'over_100'  (only used when venue = hotel)
 *
 *   branches      {Array}   branches of the SAME company — do NOT trigger public rate
 *     { label, pax, kmDistance }
 *
 *   subsidiaries  {Array}   SEPARATE companies — trigger public rate if any present
 *     { label, pax, kmDistance }
 *
 * @returns {object}  { items, airTicketEntitled, totalClaimable, warnings }
 */
export function calculateEligibility(inputs) {
    const {
        scheme                    = 'hcc',   // 'hcc'|'sbl'|'slb'
        trainingType              = 'inhouse',
        trainerType               = 'external',
        numberOfTrainers          = 1,   // kept for overseas trainer allowance calculation only
        venue                     = 'employer_premises',
        courseCategory            = 'general',
        duration                  = 'full_day',
        days                      = 1,
        extraDays                 = 0,
        elearningHours            = 7,
        internalTrainerFromBranch = false,
        host                      = { pax: 10, kmDistance: 'under_100' },
        branches                  = [],
        subsidiaries              = [],
        // Development Programme specific
        devLevel                  = 'degree',  // 'phd'|'masters'|'degree'|'diploma'|'skm'
        skmLevel                  = '3',       // '1'–'5' (only when devLevel === 'skm')
        devLocation               = 'local',   // 'local'|'overseas'
        devPrivateInstitution     = false,     // overseas private higher ed → 100% fee (ACM iii)
        devMonths                 = 3,
        devFullTime               = true,
        // Actual fee input (from employer's brochure/quotation)
        // Applies to: public, overseas, development, in-house-as-public (subsidiaries)
        // Per pax total for the full course/programme (NOT per day)
        actualCourseFeePerPax     = 0
    } = inputs;

    // Supporting document labels depend on scheme
    const courseFeeDoc = scheme === 'hcc'
        ? 'Invoice issued to HRD Corp'
        : 'Official receipt + proof of payment';

    const isHalfDay     = duration === 'half_day';
    const isElearning   = trainingType === 'elearning';
    const isDevelopment = trainingType === 'development';
    const isROTInhouse  = trainingType === 'rot_inhouse';
    const isROTPublic   = trainingType === 'rot_public';
    const isROT         = isROTInhouse || isROTPublic;
    const isOverseas    = trainingType === 'overseas';
    const isPublic      = trainingType === 'public';
    const isPublicFee   = isPublic || isROTPublic;
    const isInhouse     = trainingType === 'inhouse' || isROTInhouse;
    const isHotel       = venue === 'external_hotel' && !isROT;

    const hostPax        = parseInt(host.pax)                             || 0;
    const branchPaxTotal = branches.reduce((s, b) => s + (parseInt(b.pax) || 0), 0);
    const subPaxTotal    = subsidiaries.reduce((s, c) => s + (parseInt(c.pax) || 0), 0);
    const totalPax       = hostPax + branchPaxTotal + subPaxTotal;

    // Branches = same company → do NOT count as extra companies for course fee
    // Subsidiaries = separate companies → each adds 1 to company count
    const numSubsidiaries = subsidiaries.length;
    const numCompanies    = 1 + numSubsidiaries;

    // Public rate applies whenever subsidiaries are involved, regardless of trainer type.
    // Branches are part of the same company → grouped with Host for cost-sharing.
    // Share = (Host pax + Branch pax) for host group, each subsidiary's pax separately.
    const usePublicRate = numSubsidiaries > 0;

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
        pax < RATES.inhouse.min_pax ? (rate / RATES.inhouse.min_pax) * pax : rate;

    const travelRate = (kmDistance) =>
        kmDistance === 'over_100' ? RATES.allowances.travel_over_100 : RATES.allowances.travel_under_100;

    const kmLabel = (kmDistance) => kmDistance === 'over_100' ? '≥100km' : '<100km';

    // ── AURA AUDIT RISK FLAGS ─────────────────────────────────
    // 25 pax per trainer is the HRDCorp reference ratio — not a hard statutory cap.
    // Exceeding it flags medium audit risk; AURA logs it for compliance review.
    if (isInhouse && totalPax > RATES.trainer_ratio_pax) {
        warnings.push(
            `⚠️ Medium audit risk: Group size (${totalPax} pax) exceeds the standard trainer-to-participant ratio of 1:${RATES.trainer_ratio_pax}. ` +
            `Ensure trainer adequacy is documented. HRD Corp may request justification during audit.`
        );
    }

    // Cost cap check — in-house general course fee is capped at group rate regardless of pax count.
    // If proration kicks in (<5 pax), flag for review.
    if (isInhouse && courseCategory === 'general' && totalPax < RATES.inhouse.min_pax) {
        warnings.push(
            `ℹ️ Compliance note: Less than ${RATES.inhouse.min_pax} participants — course fee and trainer allowance are prorated by ACM rules.`
        );
    }

    // Minimum pax validation (ACM Guide, Section A)
    if (!isROT && isInhouse && !isDevelopment && totalPax < 2) {
        warnings.push(
            `⚠️ Minimum 2 participants required for face-to-face in-house training. ` +
            `Current group size (${totalPax} pax) does not meet the ACM eligibility threshold.`
        );
    }
    if (isROT && totalPax < 1) {
        warnings.push(`⚠️ Minimum 1 participant required for ROT (Remote Online Training).`);
    }

    // Focus Area — list eligible sub-sectors in notes
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
                       (totalPax < RATES.inhouse.min_pax ? ' (prorated — less than 5 pax)' : ''),
            documents: DOCS.no_document
        });
    }

    // ─────────────────────────────────────────────────────────
    // B) COURSE FEE
    // ─────────────────────────────────────────────────────────

    // IN-HOUSE / ROT — Course fee only applicable when External or Overseas trainer
    // (Internal trainer → A) allowance instead; A and B are mutually exclusive)
    if (isInhouse && trainerType !== 'internal') {
        if (courseCategory === 'general') {
            if (usePublicRate) {
                // Subsidiaries present → public rate per pax
                const sysRate         = isHalfDay ? RATES.public_training.half_day : RATES.public_training.full_day;
                const sysTotalPerPax  = sysRate * days;  // ACM ceiling per pax for the full training
                const hasActual       = actualCourseFeePerPax > 0;
                const claimPerPax     = hasActual ? Math.min(actualCourseFeePerPax, sysTotalPerPax) : sysTotalPerPax;
                const deficitPerPax   = hasActual ? Math.max(0, actualCourseFeePerPax - sysTotalPerPax) : 0;
                const ratePerDay      = claimPerPax / days;  // effective per-day rate for notes

                const perCompany = [];
                let totalCourseFee = 0;

                const addPubRow = (label, pax) => {
                    if (pax <= 0) return;
                    const share = claimPerPax * pax;
                    totalCourseFee += share;
                    perCompany.push({
                        label,
                        pax,
                        amount: Math.round(share),
                        note:   `RM${Math.round(ratePerDay).toLocaleString()}/pax/day × ${pax} pax × ${days} day(s)` +
                                (deficitPerPax > 0 ? ` [ACM ceiling applied]` : '')
                    });
                };

                // Host + Branches grouped as one cost-sharing entity
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
            } else if (scheme === 'slb') {
                // SLB — group rate ÷ total pax, shared proportionally by employer
                const rate       = isHalfDay ? RATES.inhouse.half_day : RATES.inhouse.full_day;
                const perPaxRate = totalPax > 0 ? rate / totalPax : rate;
                const perCompany = [];
                let   slbTotal   = 0;

                const addSLBRow = (lbl, pax) => {
                    if (pax <= 0) return;
                    const share = Math.round(perPaxRate * pax * days);
                    slbTotal += share;
                    perCompany.push({
                        label:  lbl,
                        pax,
                        amount: share,
                        note:   `RM${rate.toLocaleString()}/day ÷ ${totalPax} pax × ${pax} pax × ${days} day(s)`
                    });
                };
                addSLBRow('Host Company', hostPax);
                branches.forEach(b => addSLBRow(b.label || 'Branch', parseInt(b.pax) || 0));

                push({
                    label:     'B) Course Fee',
                    eligible:  true,
                    amount:    slbTotal,
                    note:      `SLB — Group rate RM${rate.toLocaleString()}/day ÷ ${totalPax} pax = RM${Math.round(perPaxRate).toLocaleString()}/pax/day (shared proportionally per employer)`,
                    documents: courseFeeDoc,
                    perCompany
                });
            } else {
                // No subsidiaries → in-house group rate
                const rate    = isHalfDay ? RATES.inhouse.half_day : RATES.inhouse.full_day;
                const dayRate = prorateGroup(rate, totalPax);
                push({
                    label:     'B) Course Fee',
                    eligible:  true,
                    amount:    Math.round(dayRate * days),
                    note:      `In-house group rate — RM${rate.toLocaleString()}/group/day × ${days} day(s)` +
                               (totalPax < RATES.inhouse.min_pax ? ' (prorated — less than 5 pax)' : ''),
                    documents: courseFeeDoc,
                    perCompany: []
                });
            }
        } else {
            // As charged → RM10,000/pax estimate
            const perCompany = [];
            let totalCourseFee = 0;

            const addEstRow = (label, pax) => {
                const share = RATES.as_charged_estimate * pax * days;
                totalCourseFee += share;
                perCompany.push({ label, pax, amount: Math.round(share), note: `RM${RATES.as_charged_estimate}/pax/day × ${pax} pax × ${days} day(s) (est.)` });
            };

            addEstRow('Host Company', hostPax);
            branches.forEach(b => addEstRow(b.label || 'Branch', parseInt(b.pax) || 0));
            subsidiaries.forEach(s => addEstRow(s.label || 'Subsidiary', parseInt(s.pax) || 0));

            push({
                label:     'B) Course Fee',
                eligible:  true,
                amount:    Math.round(totalCourseFee),
                note:      `${_categoryLabel(courseCategory)} — estimated at RM${RATES.as_charged_estimate}/pax/day (actual invoice as charged)`,
                documents: courseFeeDoc,
                perCompany,
                isEstimate: true
            });
        }
    }

    // PUBLIC TRAINING / ROT-PUBLIC
    if (isPublicFee) {
        if (courseCategory === 'general') {
            if (totalPax > 10) {
                // ≥11 pax attending same public programme → in-house group rate applies
                // Actual fee comparison not applicable here — group rate is the fixed ceiling
                const rate   = isHalfDay ? RATES.inhouse.half_day : RATES.inhouse.full_day;
                const amount = Math.round(rate * days);
                push({
                    label:     'B) Course Fee',
                    eligible:  true,
                    amount,
                    note:      `>10 pax — In-house group rate: RM${rate.toLocaleString()}/group/day × ${days} day(s)`,
                    documents: courseFeeDoc
                });
            } else {
                // <11 pax → public per-pax rate with actual fee comparison
                const sysRate        = isHalfDay ? RATES.public_training.half_day : RATES.public_training.full_day;
                const sysTotalPerPax = sysRate * days;
                const hasActual      = actualCourseFeePerPax > 0;
                const claimPerPax    = hasActual ? Math.min(actualCourseFeePerPax, sysTotalPerPax) : sysTotalPerPax;
                const deficitPerPax  = hasActual ? Math.max(0, actualCourseFeePerPax - sysTotalPerPax) : 0;
                const amount         = Math.round(claimPerPax * totalPax);
                const _def2 = deficitPerPax > 0 ? Math.round(deficitPerPax * totalPax) : 0;
                push({
                    label:     'B) Course Fee',
                    eligible:  true,
                    amount,
                    note:      hasActual
                        ? `Actual RM${actualCourseFeePerPax.toLocaleString()}/pax — ACM ceiling RM${sysTotalPerPax.toLocaleString()}/pax` +
                          (deficitPerPax > 0
                              ? ` — ceiling applied — HRD Corp pays RM${amount.toLocaleString()} / 💰 Deficit RM${_def2.toLocaleString()} to be funded from employer's own budget`
                              : ` — within ACM ceiling — HRD Corp pays RM${amount.toLocaleString()}`)
                        : `ACM rate: RM${sysRate}/pax/day × ${totalPax} pax × ${days} day(s)`,
                    documents: courseFeeDoc
                });
            }
        } else {
            // As charged estimate
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

    // E-LEARNING
    if (isElearning) {
        const totalHours = Math.max(1, Math.round(elearningHours));
        let ratePerPax   = 0;
        const noteBlocks = [];
        let remaining    = totalHours;

        // First block: up to 7 hours — use hour table (RM125/hr, max RM875)
        const firstBlock = Math.min(remaining, 7);
        ratePerPax += RATES.elearning.hour_table[firstBlock];
        noteBlocks.push(`${firstBlock}hr = RM${RATES.elearning.hour_table[firstBlock]}`);
        remaining -= firstBlock;

        // Additional blocks: >4hrs remaining → full-day (7hrs, RM875); ≤4hrs → half-day (4hrs, RM500)
        while (remaining > 0) {
            if (remaining <= 4) {
                ratePerPax += RATES.elearning.hour_table[4];   // RM500
                noteBlocks.push(`+${remaining}hr [half-day block] = RM${RATES.elearning.hour_table[4]}`);
                remaining = 0;
            } else {
                const block = Math.min(remaining, 7);
                ratePerPax += RATES.elearning.hour_table[7];   // RM875
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

    // OVERSEAS
    if (isOverseas) {
        const hasActual   = actualCourseFeePerPax > 0;
        const basePpax    = hasActual ? actualCourseFeePerPax : RATES.as_charged_estimate * days;
        const totalActual = basePpax * totalPax;
        const claimable   = Math.round(totalActual * RATES.overseas.financial_assistance);  // 50%
        const deficit     = totalActual - claimable;  // employer always pays 50%
        push({
            label:     'B) Course Fee (Overseas)',
            eligible:  true,
            amount:    claimable,
            note:      hasActual
                ? `Actual RM${actualCourseFeePerPax.toLocaleString()}/pax × ${totalPax} pax = RM${totalActual.toLocaleString()} — 50% assistance = RM${claimable.toLocaleString()} / 💰 Co-payment RM${deficit.toLocaleString()} (50% not covered) to be funded from employer's own budget`
                : `As charged (est. RM${(RATES.as_charged_estimate * days).toLocaleString()}/pax) × ${totalPax} pax — 50% assistance = RM${claimable.toLocaleString()} / employer co-pays remaining 50%`,
            documents: courseFeeDoc,
            isEstimate: !hasActual
        });
    }

    // ─────────────────────────────────────────────────────────
    // C) TRAVEL ALLOWANCE  +  D) MEAL ALLOWANCE
    //
    // Venue = Employer Premises (own):
    //   Host pax       → D) Meal allowance (RM100/day — at own premise)
    //   Branch pax     → C) Travel allowance by km (travelling to HQ)
    //   Subsidiary pax → C) Travel allowance by km (travelling to HQ)
    //
    // Venue = Hotel / External:
    //   Everyone       → C) Travel allowance by km (all travel to hotel)
    // ─────────────────────────────────────────────────────────
    // ─────────────────────────────────────────────────────────
    // ROT-INHOUSE: Meal Allowance only (remote — no travel)
    // All participants + internal trainer (if any) get meal allowance
    // ─────────────────────────────────────────────────────────
    if (isROTInhouse) {
        const trainerBonus = trainerType === 'internal' ? 1 : 0;
        const mealPax      = totalPax + trainerBonus;
        const mealRate     = isHalfDay ? RATES.allowances.meal / 2 : RATES.allowances.meal;
        push({
            label:     'D) Meal Allowance',
            eligible:  true,
            amount:    Math.round(mealRate * mealPax * days),
            note:      `RM${mealRate}/pax/day × ${mealPax} pax${trainerBonus ? ` (${totalPax} staff + 1 internal trainer)` : ''} × ${days} day(s)${isHalfDay ? ' (half-day rate)' : ''}`,
            documents: DOCS.no_document
        });
    }

    if (!isElearning && !isOverseas && !isROT && !isDevelopment) {

        if (isHotel || isPublic) {
            // Everyone travels to the venue
            let travelTotal = 0;
            const breakdown = [];

            const addTravel = (label, pax, kmDist) => {
                if (pax <= 0) return;
                const rate = travelRate(kmDist);
                const amt  = rate * pax * days;
                travelTotal += amt;
                breakdown.push({ label, pax, amount: Math.round(amt), note: `RM${rate}/pax/day × ${pax} pax × ${days} day(s) (${kmLabel(kmDist)})` });
            };

            addTravel('Host Company', hostPax, host.kmDistance);
            branches.forEach(b    => addTravel(b.label    || 'Branch',     parseInt(b.pax)    || 0, b.kmDistance));
            subsidiaries.forEach(s => addTravel(s.label   || 'Subsidiary', parseInt(s.pax)    || 0, s.kmDistance));

            if (travelTotal > 0) {
                push({
                    label:     'C) Travel Allowance',
                    eligible:  true,
                    amount:    Math.round(travelTotal),
                    note:      'All participants travel to external venue',
                    documents: DOCS.no_document,
                    perCompany: breakdown
                });
            }

        } else if (isInhouse && !isHotel) {
            // Own premise — split by origin
            let mealTotal   = 0;
            let travelTotal = 0;
            const mealBreakdown   = [];
            const travelBreakdown = [];

            // Host pax → Meal (RM50 for half-day, RM100 for full day)
            const mealRate = isHalfDay ? RATES.allowances.meal / 2 : RATES.allowances.meal;
            if (hostPax > 0) {
                const amt = mealRate * hostPax * days;
                mealTotal += amt;
                mealBreakdown.push({ label: 'Host Company', pax: hostPax, amount: Math.round(amt), note: `RM${mealRate}/pax/day × ${hostPax} pax × ${days} day(s)${isHalfDay ? ' (half-day)' : ''}` });
            }

            // Branch pax → Travel by km
            branches.forEach(b => {
                const bPax = parseInt(b.pax) || 0;
                if (bPax <= 0) return;
                const rate = travelRate(b.kmDistance);
                const amt  = rate * bPax * days;
                travelTotal += amt;
                travelBreakdown.push({ label: b.label || 'Branch', pax: bPax, amount: Math.round(amt), note: `RM${rate}/pax/day × ${bPax} pax × ${days} day(s) (${kmLabel(b.kmDistance)})` });
            });

            // Subsidiary pax → Travel by km
            subsidiaries.forEach(s => {
                const sPax = parseInt(s.pax) || 0;
                if (sPax <= 0) return;
                const rate = travelRate(s.kmDistance);
                const amt  = rate * sPax * days;
                travelTotal += amt;
                travelBreakdown.push({ label: s.label || 'Subsidiary', pax: sPax, amount: Math.round(amt), note: `RM${rate}/pax/day × ${sPax} pax × ${days} day(s) (${kmLabel(s.kmDistance)})` });
            });

            if (mealTotal > 0) {
                push({
                    label:     'D) Meal Allowance',
                    eligible:  true,
                    amount:    Math.round(mealTotal),
                    note:      `RM${mealRate}/pax/day — host company staff at employer premises${isHalfDay ? ' (half-day rate)' : ''}`,
                    documents: DOCS.no_document,
                    perCompany: mealBreakdown
                });
            }

            if (travelTotal > 0) {
                push({
                    label:     'C) Travel Allowance',
                    eligible:  true,
                    amount:    Math.round(travelTotal),
                    note:      'Branch / subsidiary staff travelling to training venue',
                    documents: DOCS.no_document,
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
            documents: DOCS.no_document
        });
    }

    // ─────────────────────────────────────────────────────────
    // F) AIR TICKET — count entitled people, no fixed RM amount
    //
    // Entitled:
    //   All branch pax (always travelling)
    //   All subsidiary pax (always travelling)
    //   Host pax — ONLY when venue is hotel (they also travel)
    //   External / overseas trainer: 1
    //   Internal trainer from branch: 1
    // ─────────────────────────────────────────────────────────
    let airTicketEntitled = 0;
    const airTicketGroups = [];

    branches.forEach(b => {
        const bPax = parseInt(b.pax) || 0;
        if (bPax > 0) { airTicketEntitled += bPax; airTicketGroups.push(`${b.label || 'Branch'}: ${bPax} pax`); }
    });

    subsidiaries.forEach(s => {
        const sPax = parseInt(s.pax) || 0;
        if (sPax > 0) { airTicketEntitled += sPax; airTicketGroups.push(`${s.label || 'Subsidiary'}: ${sPax} pax`); }
    });

    if ((isHotel || isOverseas || isPublic) && hostPax > 0) {
        airTicketEntitled += hostPax;
        airTicketGroups.push(`Host Company: ${hostPax} pax`);
    }

    // Trainer air ticket only applicable for in-house training
    // (public/overseas training providers supply their own trainers)
    if (isInhouse) {
        if (trainerType === 'external') {
            airTicketEntitled += 1; airTicketGroups.push('External trainer: 1');
        } else if (trainerType === 'overseas') {
            airTicketEntitled += 1; airTicketGroups.push('Overseas trainer: 1');
        } else if (trainerType === 'internal' && internalTrainerFromBranch) {
            airTicketEntitled += 1; airTicketGroups.push('Internal trainer (from branch): 1');
        }
    }

    if (airTicketEntitled > 0 && !isElearning && !isROT) {
        push({
            label:         'G) Air Ticket',
            eligible:      true,
            amount:        null,
            entitledCount: airTicketEntitled,
            note:          `${airTicketEntitled} person(s) entitled — actual airfare cost (${airTicketGroups.join(', ')})`,
            documents:     DOCS.air_ticket
        });
    }

    // ─────────────────────────────────────────────────────────
    // G) CHARTERED TRANSPORTATION
    // ─────────────────────────────────────────────────────────
    if (!isElearning && !isROT && isHotel) {
        push({ label: 'H) Chartered Transportation', eligible: true, amount: null, note: 'As per quotation', documents: DOCS.transport });
    }

    // ─────────────────────────────────────────────────────────
    // H) CONSUMABLE TRAINING MATERIALS  (not dev — handled inside dev block)
    // ─────────────────────────────────────────────────────────
    if (!isElearning && !isPublic && !isOverseas && !isROT && !isDevelopment) {
        push({
            label:     'I) Consumable Training Materials',
            eligible:  true,
            amount:    RATES.allowances.consumable_materials,
            note:      `RM${RATES.allowances.consumable_materials}/group (no receipt needed up to this amount)`,
            documents: 'No receipt needed up to RM100. If total > RM100, itemised invoice required.'
        });
    }

    // ─────────────────────────────────────────────────────────
    // OVERSEAS DAILY ALLOWANCE
    // ─────────────────────────────────────────────────────────
    if (isOverseas) {
        const clampedExtra = Math.min(RATES.overseas.extra_days_allowed, Math.max(0, parseInt(extraDays) || 0));
        const totalDays    = days + clampedExtra;
        const claimable    = Math.round(RATES.overseas.daily_allowance * totalPax * totalDays * RATES.overseas.financial_assistance);
        push({
            label:     'Overseas Daily Allowance',
            eligible:  true,
            amount:    claimable,
            note:      `RM${RATES.overseas.daily_allowance}/pax/day × ${totalPax} pax × ${totalDays} day(s) (${days} training + ${clampedExtra} travel day${clampedExtra !== 1 ? 's' : ''}) — 50% assistance = RM${claimable.toLocaleString()}`,
            documents: DOCS.no_document
        });
    }

    // ─────────────────────────────────────────────────────────
    // DEVELOPMENT PROGRAMME (HCC / SBL only)
    // Section F — ACM Guide
    // ─────────────────────────────────────────────────────────
    if (isDevelopment) {
        const isOverseasDev = devLocation === 'overseas';
        const isMasterPhD   = devLevel === 'masters' || devLevel === 'phd';
        const isSKM         = devLevel === 'skm';
        const months        = Math.max(1, parseInt(devMonths) || 3);
        const devDays       = months * 30;  // 1 month = 30 training days
        const isExternalVenue = venue === 'external_hotel';  // college / institution campus

        // ── Min duration validation ───────────────────────────
        if (months < 3) {
            warnings.push(
                `⚠️ Minimum course duration for Development Programmes is 3 months ` +
                `(${3 * 30} training days). Current input: ${months} month(s) = ${devDays} days — ` +
                `does not meet the ACM eligibility threshold.`
            );
        }

        // ── B) Course Fee (as charged) ─────────────────────────
        //   i.   Local                          → 100%
        //   ii.  Overseas (general)             → 50%
        //   iii. Overseas Masters/PhD           → 100%  (overrides ii)
        //   iv.  Overseas private higher ed     → 100%  (overrides ii, ACM point iii)
        const feeAssistPct = (!isOverseasDev || isMasterPhD || devPrivateInstitution) ? 100 : 50;
        const feeAssistNote = !isOverseasDev          ? '100% (local)'
            : isMasterPhD                             ? '100% (overseas Masters/PhD)'
            : devPrivateInstitution                   ? '100% (overseas — private higher education institution)'
            :                                           '50% (overseas)';

        const hasActualDev   = actualCourseFeePerPax > 0;
        const baseFeePerPax  = hasActualDev ? actualCourseFeePerPax : RATES.dev_estimate;
        const actualFeeTotal = baseFeePerPax * totalPax;
        const devClaimable   = Math.round(actualFeeTotal * feeAssistPct / 100);
        const devDeficit     = actualFeeTotal - devClaimable;  // portion employer must fund

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

        // ── C) Travel / Transport Allowance (to institution) ──
        //   Only when venue = college / institution (not at employer's own premise)
        if (isExternalVenue && !isOverseasDev) {
            const tvRate = travelRate(host.kmDistance);
            const tvAmt  = Math.round(tvRate * totalPax * devDays);
            push({
                label:     'C) Travel / Transport Allowance',
                eligible:  true,
                amount:    tvAmt,
                note:      `RM${tvRate}/pax/day × ${totalPax} pax × ${devDays} days ` +
                           `(${months} month(s) × 30 days/month) — ${kmLabel(host.kmDistance)} to institution`,
                documents: DOCS.no_document,
                isEstimate: true
            });
        }

        // ── I) Consumable Training Materials ──────────────────
        push({
            label:     'I) Consumable Training Materials',
            eligible:  true,
            amount:    RATES.allowances.consumable_materials,
            note:      `RM${RATES.allowances.consumable_materials}/group (no receipt needed up to this amount)`,
            documents: 'No receipt needed up to RM100. If total > RM100, itemised invoice required.'
        });

        // ── Study Allowance (full-time only) ──────────────────
        if (devFullTime) {
            const studyRate = isOverseasDev
                ? RATES.development.study_allowance_overseas
                : RATES.development.study_allowance_local;
            const studyPct  = (isOverseasDev && isMasterPhD) ? 50 : 100;
            const studyAmt  = Math.round(studyRate * months * totalPax * studyPct / 100);
            push({
                label:     'Study Allowance',
                eligible:  true,
                amount:    studyAmt,
                note:      `RM${studyRate.toLocaleString()}/month × ${months} month(s) × ${totalPax} pax` +
                           (studyPct < 100 ? ` × ${studyPct}% assistance` : ''),
                documents: DOCS.no_document
            });
        }

        // ── Thesis Allowance (Masters / PhD, full-time) ───────
        if (devFullTime && isMasterPhD) {
            const thesisRate = devLevel === 'phd'
                ? RATES.development.thesis_phd
                : RATES.development.thesis_masters;
            push({
                label:     'Thesis Allowance',
                eligible:  true,
                amount:    thesisRate * totalPax,
                note:      `RM${thesisRate}/pax × ${totalPax} pax`,
                documents: DOCS.no_document
            });
        }

        // ── Air Ticket (overseas or long-distance to institution) ─
        if (isOverseasDev) {
            push({
                label:     'G) Air Ticket',
                eligible:  true,
                amount:    null,
                note:      `As per quotation — 50% financial assistance on airfare`,
                documents: DOCS.air_ticket
            });
        } else if (isExternalVenue && host.kmDistance === 'over_100') {
            push({
                label:     'G) Air Ticket',
                eligible:  true,
                amount:    null,
                note:      `${totalPax} trainee(s) — ≥100km to institution, air ticket may be claimable (actual cost)`,
                documents: DOCS.air_ticket
            });
        }

        // ── SKM note ──────────────────────────────────────────
        if (isSKM) {
            warnings.push(
                `📌 Sijil Kemahiran Malaysia (SKM) has 5 levels: SKM Level 1, SKM Level 2, SKM Level 3, ` +
                `SKM Level 4, and SKM Level 5. Courses are offered by technical and vocational institutions ` +
                `accredited by the Department of Skills Development (Jabatan Pembangunan Kemahiran — JPK), ` +
                `Ministry of Human Resources.`
            );
        }

        // ── Scheme-specific notes & document requirements ─────
        if (scheme === 'hcc') {
            warnings.push(
                `📋 HCC — Notes & Required Documents:\n` +
                `• Can be claimed on a modular, semester, or whole duration basis\n` +
                `• All modules must be registered with HRD Corp\n` +
                `• Complete course syllabus (if semester basis, attach syllabus for ALL semesters)\n` +
                `• All related invoices and quotations\n` +
                `• Confirmation letter from college/university`
            );
        }
        if (scheme === 'sbl') {
            warnings.push(
                `📋 SBL — Notes & Required Documents:\n` +
                `• Can be claimed on a modular, semester, or whole duration basis\n` +
                `• Course must be MQA accredited — cross-check at: https://www2.mqa.gov.my/mqr/\n` +
                `• Complete course syllabus (if semester basis, attach syllabus for ALL semesters)\n` +
                `• All related invoices and quotations\n` +
                `• Confirmation letter from college/university\n` +
                `• MQA Certificate for the course`
            );
        }

        warnings.push(
            `ℹ️ Development Programme — Key Rules:\n` +
            `• Minimum 3 months (1 month = 30 training days, minimum = 90 days total)\n` +
            `• Can be claimed on modular, semester, or whole duration basis\n` +
            `• Course fees claimable as per quotation — includes registration & examination fees\n` +
            `• Course fees MUST be entirely borne by the employer. Employees must not pay any portion of fees where HRD Corp assistance is available\n` +
            `• Study allowance (RM${(isOverseasDev ? RATES.development.study_allowance_overseas : RATES.development.study_allowance_local).toLocaleString()}/month) is for full-time students only — prorated daily if programme starts/ends mid-month\n` +
            `• Overseas Masters/PhD: 100% course fees, 50% study allowance & airfare\n` +
            `• Overseas courses at private higher education institutions: 100% course fees\n` +
            `• Trainer is always external (institution staff)`
        );
    }

    // ─────────────────────────────────────────────────────────
    // VALIDATION WARNINGS
    // ─────────────────────────────────────────────────────────
    if (isInhouse && usePublicRate && courseCategory === 'general') {
        const rate = isHalfDay ? RATES.public_training.half_day : RATES.public_training.full_day;
        if (scheme === 'slb') {
            warnings.push(`ℹ️ SLB with ${numSubsidiaries} separate employer(s) — public rate (RM${rate}/pax/day) applied. Each participating employer is billed based on their own headcount.`);
        } else {
            warnings.push(`ℹ️ ${numSubsidiaries} subsidiary/subsidiaries involved — public rate (RM${rate}/pax/day) applied. Cost shared between Host+Branches and each subsidiary based on pax.`);
        }
    }
    if (scheme === 'slb' && !usePublicRate && isInhouse && courseCategory === 'general') {
        const rate = isHalfDay ? RATES.inhouse.half_day : RATES.inhouse.full_day;
        warnings.push(
            `ℹ️ SLB — Cost Sharing: In-house group rate (RM${rate.toLocaleString()}/day) is divided equally across ` +
            `all ${totalPax} participants = RM${Math.round(rate / (totalPax || 1)).toLocaleString()}/pax/day. ` +
            `Each employer pays only for their own participants.`
        );
    }
    if (isOverseas) {
        warnings.push('ℹ️ Overseas training: 50% financial assistance rate applies on course fee and air ticket.');
    }
    if (isROT) {
        warnings.push('ℹ️ ROT (Remote Online Training): Air ticket, travel/daily allowance and chartered transportation are NOT claimable.');
    }
    warnings.push('ℹ️ Attendance must be ≥75% of total training hours. Allowances are prorated by attendance.');
    if (airTicketEntitled > 0 && !isROT) {
        warnings.push('ℹ️ Air ticket (actual cost) must be supported by ticket stub / e-Ticket and travel agent invoice.');
    }
    if (items.some(i => i.isEstimate)) {
        warnings.push('⚠️ Items marked "est." use RM10,000/pax as proxy for "as charged" categories. Actual invoice determines final claimable amount.');
    }

    return {
        items,
        airTicketEntitled,
        totalClaimable: Math.round(totalClaimable),
        warnings
    };
}

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────
function _categoryLabel(cat) {
    return {
        focus_area:        'Focus Area Course',
        industry_specific: 'Industry Specific Course',
        certification:     'Professional Certification Course'
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
