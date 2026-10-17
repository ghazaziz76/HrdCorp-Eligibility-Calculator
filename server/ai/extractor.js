// AI brochure extraction (Claude Haiku over the Anthropic Messages API).
//
//   extractBrochure({ buffer: Buffer, mimeType: string, originalName: string }, deps?)
//     : Promise<{ fields: object, usage?: { input_tokens: number, output_tokens: number } }>
//
// - deps = { fetch, apiKey, timeoutMs } (defaults: global fetch, env ANTHROPIC_API_KEY, 60 s).
// - No key: throws code 'not_configured' (the route answers 503 and counts nothing).
// - Image over 4.5 MB: throws code 'image_too_large' before any API call (route: 413, counts nothing).
// - The real file type is read from the first bytes and wins over the browser's mimetype.
// - Any other failure throws a plain read failure; `err.usage` is set when tokens were spent.
// - The file is never written to disk or logged; it only goes into the request body.
// - fields: exactly trainingProgrammeName, trainingType, venue, days, duration, actualCourseFee
//   (value or null), plus feeMayIncludeSst: true only when an SST-inclusive fee has no stated rate.

const API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-haiku-5-5';
const API_VERSION = '2023-06-01';
const MAX_TOKENS = 2000;
const DOCX_TEXT_CAP = 50000;
// The API rejects images over 5 MB; stay well under it.
const IMAGE_MAX_BYTES = 4.5 * 1024 * 1024;

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const IMAGE_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);

const TRAINING_TYPES = new Set([
    'inhouse', 'rot_inhouse', 'coaching_mentoring', 'rot_public', 'public', 'seminar_conference',
    'elearning', 'mobile_elearning', 'overseas', 'overseas_seminar', 'development',
]);
const VENUES = new Set(['employer_premises', 'external_hotel']);
const DURATIONS = new Set(['full_day', 'half_day']);
// The Venue box only exists for these types.
const VENUE_TYPES = new Set(['inhouse', 'rot_inhouse', 'rot_public', 'coaching_mentoring', 'development']);

const SYSTEM_PROMPT = `You read Malaysian training brochures and pull out details for an HRD Corp training grant calculator.

Reply with JSON only (no other text), with exactly these keys:
{"trainingProgrammeName": string|null, "trainingType": string|null, "venue": string|null, "days": integer|null, "duration": string|null, "actualCourseFee": number|null, "sst_included": boolean, "sst_rate": number|null}

Use null for anything the brochure does not state. Never guess.

- trainingProgrammeName: the course title exactly as printed, e.g. "Associate HR Professional Certificate (AHRP)".
- trainingType: one of inhouse, rot_inhouse, coaching_mentoring, rot_public, public, seminar_conference, elearning, mobile_elearning, overseas, overseas_seminar, development. A public course held on Zoom or online is rot_public.
- venue: employer_premises or external_hotel, only when the brochure states the venue and trainingType is inhouse, rot_inhouse, rot_public, coaching_mentoring or development. For online training (rot_inhouse, rot_public), external_hotel only when the brochure names a physical venue where trainees gather; joining online from anywhere = null. Otherwise null.
- days: the number of training days. A printed "N days" wins over counting dates; otherwise count the listed dates (e.g. "19-23, 26-27 Oct" = 7).
- duration: full_day when a training day has 7 or more training hours (e.g. 9am-5pm), half_day when under 7. Training hours = session span minus a stated lunch break; if no break is stated, use the span. If no hours are stated, null.
- actualCourseFee: the standard per-person (per pax) fee in RM as a plain number, e.g. "RM129.00 excl SST" = 129. Use the standard fee, not early-bird, member or group prices, unless that is the only price. Give the printed amount.
- sst_included: true only if that printed fee includes SST. sst_rate: the SST percentage stated on the brochure (e.g. 8), or null if not stated.`;

function notConfigured() {
    return Object.assign(new Error('AI extraction not configured'), { code: 'not_configured' });
}

function imageTooLarge() {
    return Object.assign(new Error('Image too large (max 4.5 MB)'), { code: 'image_too_large' });
}

function readFailed(usage) {
    const err = new Error('read failed');
    if (usage) err.usage = usage;
    return err;
}

const round2 = (n) => Math.round(n * 100) / 100;
const normaliseEnum = (v) => (typeof v === 'string' ? v.trim().toLowerCase().replace(/[\s-]+/g, '_') : null);
const pickEnum = (v, allowed) => {
    const n = normaliseEnum(v);
    return n && allowed.has(n) ? n : null;
};

function toNumber(v) {
    if (typeof v === 'number') return Number.isFinite(v) ? v : null;
    if (typeof v !== 'string') return null;
    const s = v.replace(/rm/gi, '').replace(/[,\s]/g, '');
    if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
    return Number(s);
}

function toDays(v) {
    let n = null;
    if (typeof v === 'number') n = v;
    else if (typeof v === 'string') {
        const m = v.trim().match(/^(\d+(?:\.\d+)?)/);
        if (m) n = Number(m[1]);
    }
    return Number.isInteger(n) && n > 0 ? n : null;
}

function toName(v) {
    if (typeof v !== 'string') return null;
    const s = v.replace(/\s+/g, ' ').trim();
    return s && s.length <= 200 ? s : null;
}

// Keep only the six keys, coerce to the allowed shapes, back SST out of the fee.
function validateFields(raw) {
    const r = raw && typeof raw === 'object' ? raw : {};
    const trainingType = pickEnum(r.trainingType, TRAINING_TYPES);
    const venue = VENUE_TYPES.has(trainingType) ? pickEnum(r.venue, VENUES) : null;
    let fee = toNumber(r.actualCourseFee);
    if (fee !== null && fee < 0) fee = null;

    let feeMayIncludeSst = false;
    if (fee !== null && r.sst_included === true) {
        const rate = toNumber(typeof r.sst_rate === 'string' ? r.sst_rate.replace('%', '') : r.sst_rate);
        if (rate !== null && rate > 0 && rate <= 30) fee = round2(fee / (1 + rate / 100));
        else feeMayIncludeSst = true;
    }

    const fields = {
        trainingProgrammeName: toName(r.trainingProgrammeName),
        trainingType,
        venue,
        days: toDays(r.days),
        duration: pickEnum(r.duration, DURATIONS),
        actualCourseFee: fee === null ? null : round2(fee),
    };
    if (feeMayIncludeSst) fields.feeMayIncludeSst = true;
    return fields;
}

// The model should reply with bare JSON; tolerate a code fence or surrounding prose.
function parseModelJson(text) {
    const s = String(text || '').trim();
    const candidates = [s];
    const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fence) candidates.push(fence[1].trim());
    const a = s.indexOf('{');
    const b = s.lastIndexOf('}');
    if (a !== -1 && b > a) candidates.push(s.slice(a, b + 1));
    for (const c of candidates) {
        try {
            const v = JSON.parse(c);
            if (v && typeof v === 'object' && !Array.isArray(v)) return v;
        } catch { /* try the next candidate */ }
    }
    throw new Error('no JSON object in model reply');
}

// The real type from the first bytes, or null when the signature is unknown.
function sniffType(buffer) {
    const b = buffer || Buffer.alloc(0);
    const at = (i, bytes) => bytes.every((x, k) => b[i + k] === x);
    if (b.length >= 4 && b.toString('latin1', 0, 4) === '%PDF') return 'application/pdf';
    if (at(0, [0xff, 0xd8, 0xff])) return 'image/jpeg';
    if (at(0, [0x89, 0x50, 0x4e, 0x47])) return 'image/png';
    if (b.length >= 12 && b.toString('latin1', 0, 4) === 'RIFF' && b.toString('latin1', 8, 12) === 'WEBP') return 'image/webp';
    if (at(0, [0x50, 0x4b])) return DOCX_MIME;
    return null;
}

async function fileBlock({ buffer, mimeType }) {
    const sniffed = sniffType(buffer);
    // Unknown signature for a claimed image or PDF: don't send it.
    if (!sniffed && (mimeType === 'application/pdf' || IMAGE_MIME.has(mimeType))) throw readFailed();
    const type = sniffed || mimeType;
    if (type === 'application/pdf') {
        return { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: buffer.toString('base64') } };
    }
    if (IMAGE_MIME.has(type)) {
        if (buffer.length > IMAGE_MAX_BYTES) throw imageTooLarge();
        return { type: 'image', source: { type: 'base64', media_type: type, data: buffer.toString('base64') } };
    }
    if (type === DOCX_MIME) {
        const mammoth = require('mammoth');
        const { value } = await mammoth.extractRawText({ buffer });
        const text = String(value || '').trim().slice(0, DOCX_TEXT_CAP);
        if (!text) throw readFailed();
        return { type: 'text', text: `Brochure text:\n\n${text}` };
    }
    throw readFailed();
}

async function extractBrochure({ buffer, mimeType }, deps = {}) {
    const fetchFn = deps.fetch || globalThis.fetch;
    const apiKey = deps.apiKey !== undefined ? deps.apiKey : process.env.ANTHROPIC_API_KEY;
    const timeoutMs = deps.timeoutMs || 60000;
    if (!apiKey) throw notConfigured();

    let block;
    try {
        block = await fileBlock({ buffer, mimeType });
    } catch (err) {
        if (err && err.code === 'image_too_large') throw err;
        throw readFailed();
    }

    const body = JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        thinking: { type: 'disabled' },
        system: SYSTEM_PROMPT,
        messages: [{
            role: 'user',
            content: [block, { type: 'text', text: 'Read this training brochure and reply with the JSON only.' }],
        }],
    });

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let data;
    try {
        const res = await fetchFn(API_URL, {
            method: 'POST',
            headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': API_VERSION },
            body,
            signal: controller.signal,
        });
        if (!res.ok) throw readFailed();
        data = await res.json();
    } catch {
        throw readFailed();
    } finally {
        clearTimeout(timer);
    }

    const usage = data && data.usage;
    // A cut-off reply is never trusted, even if it happens to parse.
    if (data && data.stop_reason === 'max_tokens') throw readFailed(usage);
    const textBlock = Array.isArray(data && data.content) ? data.content.find((c) => c && c.type === 'text') : null;
    let fields;
    try {
        fields = validateFields(parseModelJson(textBlock && textBlock.text));
    } catch {
        throw readFailed(usage);
    }
    const anyFound = ['trainingProgrammeName', 'trainingType', 'venue', 'days', 'duration', 'actualCourseFee']
        .some((k) => fields[k] !== null);
    if (!anyFound) throw readFailed(usage);
    return { fields, usage };
}

module.exports = { extractBrochure, validateFields, parseModelJson };
