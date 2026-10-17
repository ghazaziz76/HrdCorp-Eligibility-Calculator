# AI Brochure Upload Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A user uploads a training brochure in the HCC/SBL/SLB calculator; Claude Haiku reads it and fills six boxes; users without uploads are told to upgrade.

**Architecture:** Server: replace the stub in `server/ai/extractor.js` with a real Anthropic Messages API call (built-in `fetch`, injectable for tests), validate the six fields, keep the existing route/limits untouched except dropping `.doc`. Client: a `BrochureUpload` component above Training Programme Name posts the file to the existing `/api/employer/ai-brochure`, applies the fields through the calculator's setters, and shows `OutOfUploadsMessage` when blocked.

**Tech Stack:** Node 20 / Express 5 / multer / `node:test`; React (CRA, Jest with `react-dom/client` + `act`, no @testing-library); new dependency `mammoth` (docx -> text).

**Spec:** `docs/superpowers/specs/2026-10-17-ai-brochure-upload-design.md` (read it; section 7 lists the developer calls this plan follows).

## Global Constraints

- Model `claude-haiku-5-5`; header `anthropic-version: 2023-06-01`; key from env `ANTHROPIC_API_KEY`; no key -> throw `{ code: 'not_configured' }`.
- Exactly six output keys: `trainingProgrammeName`, `trainingType`, `venue`, `days`, `duration`, `actualCourseFee`.
- Allowed `trainingType`: inhouse, rot_inhouse, coaching_mentoring, rot_public, public, seminar_conference, elearning, mobile_elearning, overseas, overseas_seminar, development. Allowed `venue`: employer_premises, external_hotel. Allowed `duration`: full_day, half_day.
- Fee is per pax, in RM, **without SST**.
- Files: .pdf, .docx, .jpg/.jpeg, .png, .webp; max 10 MB; never written to disk or logged; `.doc` rejected.
- Tests never call the real API (inject a fake fetch). Never commit `deploy.py`, `server/data/*.json`, or owner files; stage explicit paths only. Restore `server/data/monitor.json` if a local run touches it.
- App (`platform === 'app'`) wording must not mention the newsletter, subscribing, prices or URLs (Play policy); the upgrade wording is web only.

## Review Focus

1. A brochure where the AI returns extra keys, strings for numbers ("RM 1,500.00", "3 days") or wrong enum casing ("Public"). Expected: numbers parsed when unambiguous, enums matched case-insensitively, anything else null; extra keys dropped. (Task 1 test `validates and coerces model output`.)
2. The model wraps JSON in prose or ```json fences. Expected: the JSON is still parsed. (Task 1 test `parses fenced JSON`.)
3. Anthropic answers 429/5xx/timeout. Expected: a read failure (route 422, upload not counted), with `err.usage` absent. (Task 1 test `api error throws read failure`.)
4. User uploads while a previous result is shown, or the AI changes Type so the Venue box disappears. Expected: old result cleared, Venue only set for in-house types/development. (Task 2 test `applies fields through setters and clears result`.)
5. User with no code in localStorage (cleared storage). Expected: the box shows "Please enter your activation code again" and does not call the server. (Task 2 test `no stored code`.)

---

### Task 1: Server extractor

**Files:**
- Modify: `server/ai/extractor.js` (replace stub), `server/routes/ai.js` (remove `application/msword` from `ALLOWED_MIME`), `server/lib/brochureStats.js` (`pickAnonymous` keys), `package.json` (add `mammoth` to dependencies)
- Test: create `server/test/extractor.test.js`; update `server/test/ai.test.js` (stats test uses the new keys; add a `.doc` -> 400 test)

**Interfaces:**
- Produces: `extractBrochure({ buffer, mimeType, originalName }, deps?) -> Promise<{ fields, usage }>` where `deps = { fetch, apiKey, timeoutMs }` default to `globalThis.fetch`, `process.env.ANTHROPIC_API_KEY`, `60000`. `fields` has exactly the six keys (value or null) plus, only when relevant, `feeMayIncludeSst: true`. Also export `validateFields(raw) -> fields` and `parseModelJson(text) -> object` for tests.
- Route contract unchanged: success `{ success: true, data: { fields, ai } }`; 403/429 `{ reason, ai }`; 422 `read_failed`; 503 `not_configured`; 413; 400.

- [ ] **Step 1: Write the failing tests** in `server/test/extractor.test.js` (`node:test`, `assert`), with a `fakeFetch(responseBody, status=200)` that records the request:
  - `no api key -> not_configured`: `extractBrochure({...}, { apiKey: '' })` rejects with `code === 'not_configured'`.
  - `pdf sent as document block`: request JSON has `model === 'claude-haiku-5-5'`, header `x-api-key` and `anthropic-version: 2023-06-01`, and a content block `{ type: 'document', source: { type: 'base64', media_type: 'application/pdf' } }`.
  - `image sent as image block`: `image/jpeg` -> block `type: 'image'`, `media_type: 'image/jpeg'`.
  - `docx sent as text`: a real minimal .docx built in the test with `mammoth`-readable content (or a fixture under `server/test/fixtures/brochure.docx` containing "Lean Management 2 days RM1500") -> a `text` block containing "Lean Management"; text capped at 50,000 chars.
  - `returns the six fields and usage`: model reply text `{"trainingProgrammeName":"Associate HR Professional Certificate (AHRP)","trainingType":"rot_public","venue":null,"days":7,"duration":"full_day","actualCourseFee":129}` with `usage {input_tokens: 1200, output_tokens: 80}` -> `fields` deep-equals those six values and `usage` is passed through.
  - `validates and coerces model output`: `validateFields({ trainingProgrammeName: '  X  ', trainingType: 'Public', venue: 'hotel', days: '3 days', duration: 'Full Day', actualCourseFee: 'RM 1,500.00', extra: 1 })` -> `{ trainingProgrammeName: 'X', trainingType: 'public', venue: null, days: 3, duration: 'full_day', actualCourseFee: 1500 }` (no `extra`); `days: 0` -> null; `actualCourseFee: -5` -> null; a 201-char name -> null.
  - `sst backed out when rate stated`: raw `{ ..., actualCourseFee: 108, sst_included: true, sst_rate: 8 }` -> `actualCourseFee: 100`; `{ actualCourseFee: 129, sst_included: true, sst_rate: null }` -> `actualCourseFee: 129, feeMayIncludeSst: true`.
  - `parses fenced JSON`: `parseModelJson('Here you go:\n```json\n{"days":2}\n```')` -> `{ days: 2 }`.
  - `all null -> read failure with usage`: reply with all six null rejects; error has `usage` and no `code === 'not_configured'`.
  - `api error throws read failure`: status 529 and a fetch that rejects (timeout) both reject without `code === 'not_configured'`.
  In `server/test/ai.test.js`: change the stats test's fake fields to the new keys (`trainingProgrammeName: 'Lean Mgmt', trainingType: 'inhouse', days: 2, duration: 'full_day', actualCourseFee: 1500`, plus `email`/`trainer` junk) and assert stats `training_title === 'Lean Mgmt'`, `delivery === 'inhouse'`, `duration === '2 x full_day'`, `course_fee === 1500`, keys still exactly `course_fee, delivery, duration, month, training_title`. Add `doc file -> 400 Unsupported file type, nothing counted`.

- [ ] **Step 2: Run** `npm run test:server` -> the new tests FAIL (stub throws not_configured; stats keys differ).

- [ ] **Step 3: Implement.** `npm install mammoth --save` (check it lands in `dependencies`). In `extractor.js`: build the Messages request (`max_tokens: 400`, a system prompt stating the spec section 2 rules and section 7 calls 3, 5, 6, 7 in plain words, the allowed values, and "reply with JSON only, keys ..., use null when not stated, plus sst_included / sst_rate for the fee"); POST `https://api.anthropic.com/v1/messages` with `AbortController` timeout; non-2xx or abort -> throw `Error('read failed')`; take the first `text` block, `parseModelJson`, `validateFields`; all six null -> throw with `err.usage = data.usage`. SST back-out: `round2(fee / (1 + rate/100))`. `brochureStats.pickAnonymous`: `training_title <- trainingProgrammeName`, `delivery <- trainingType`, `duration <- days && duration ? \`${days} x ${duration}\` : null`, `course_fee <- actualCourseFee` (undefined -> null). Remove `'application/msword'` from `ALLOWED_MIME`.

- [ ] **Step 4: Run** `npm run test:server` -> all pass (previous 112 + new). `git checkout -- server/data/monitor.json` if touched.

- [ ] **Step 5: Commit** `git add server/ai/extractor.js server/routes/ai.js server/lib/brochureStats.js server/test/extractor.test.js server/test/ai.test.js package.json package-lock.json` (+ fixture if added); message `feat(ai): Claude Haiku brochure extractor (six fields, SST, docx)`.

### Task 2: Upload box in the calculator + upgrade wording

**Files:**
- Modify: `src/utils/tgeAccess.js` (`aiBlockedMessage`, add `uploadBrochure`), `src/components/HRDCorpCostCalculator.js` (render `BrochureUpload` above Training Programme Name; `applyBrochure`)
- Create: `src/components/BrochureUpload.js`
- Test: `src/utils/tgeAccess.test.js`, `src/components/OutOfUploadsMessage.test.js` (if wording assertions change), create `src/components/BrochureUpload.test.js`

**Interfaces:**
- Consumes: Task 1 route reply shapes.
- Produces: `uploadBrochure(file, code) -> Promise<{ ok: true, fields, ai } | { ok: false, status, reason?, ai?, message }>` (multipart field `file`, header `x-tge-code`, URL `${window.location.origin}/api/employer/ai-brochure`; network error -> `{ ok:false, status:0 }`). `<BrochureUpload onFields={(fields) => void} platform="web" />` reads the code from `localStorage.hrd_activation_code`.

- [ ] **Step 1: Write the failing tests.**
  `tgeAccess.test.js`:
  - `web not_paying / play_unverified upgrade text`: title `'Upgrade for AI uploads'`, body `'AI brochure uploads come with the yearly Business & People Management Newsletter: 50 uploads a month.'`, links `[newsletter, admin]` (same objects as the limit_reached test).
  - `web limit_reached adds upgrade line`: body contains `"You've used all your AI uploads for this month"` and `'Upgrade to the yearly newsletter for 50 uploads a month.'`.
  - Keep: the app limit_reached forbidden-words test; change the `test.each` to `admin_off`, `locked` (web and app) and `not_paying`, `play_unverified` on **app** only, all with `"AI uploads aren't available for this code."` + mailto.
  - `uploadBrochure posts multipart with code header` (mock `global.fetch`; assert URL, `headers['x-tge-code']`, body is `FormData` with `file`); `maps 403 to { ok:false, status:403, reason }`; `network error -> status 0`.
  `BrochureUpload.test.js` (mock `global.fetch`, set `localStorage.hrd_activation_code`):
  - `success calls onFields with the six fields` and shows `'Please check these values. Fill in the rest (pax, trainers…) yourself.'`.
  - `feeMayIncludeSst shows 'Fee may include SST, please check'`.
  - `403 not_paying renders the upgrade message` (text `'Upgrade for AI uploads'`, newsletter link) and does not call `onFields`.
  - `422 shows "We couldn't read the details from this file. It didn't use up an upload."`; `413 -> 'File too large (max 10 MB)'`; `503 -> "Brochure reading isn't available right now. Please fill in the form yourself."`.
  - `rejects .doc without calling fetch` -> `'Please save it as PDF or .docx'`.
  - `no stored code` -> `'Please enter your activation code again'`, fetch not called.
  - `file input accepts` attribute equals `.pdf,.docx,.jpg,.jpeg,.png,.webp`.
  Calculator wiring test (in `BrochureUpload.test.js` or a new `src/components/HRDCorpCostCalculator.brochure.test.js`, whichever renders with the existing providers more simply): `applies fields through setters and clears result`: render the calculator, pick scheme HCC, simulate a successful upload returning `trainingType: 'inhouse', venue: 'external_hotel', days: 3, duration: 'half_day', actualCourseFee: 1500, trainingProgrammeName: 'Lean'` -> Training Programme Name input value `'Lean'`, Type select `'inhouse'`, Venue select `'external_hotel'`, days input `'3'`, duration `'half_day'`, fee `'1500'`; and with `trainingType: 'rot_public', venue: 'external_hotel'` the venue state is not changed.

- [ ] **Step 2: Run** `CI=true npx react-scripts test --watchAll=false` -> new tests FAIL.

- [ ] **Step 3: Implement.** `BrochureUpload`: a card styled like the Training Programme Name card, title `'📄 Upload brochure to fill in the form'`, the existing `uploadsLeftText` line (via `fetchAccess`, refreshed from the `ai` in each reply), a file input with the accept list, a `'Reading your brochure…'` state, and the messages above. `applyBrochure(fields)` in `HRDCorpCostCalculator.js`: set `trainingType` first via `SETTERS`, then `venue` only if the (new) type is in `['inhouse','rot_inhouse','coaching_mentoring','development']` and venue is non-null, then `days`, `duration`, `actualCourseFee`, and `setTrainingProgrammeName`; skip nulls; `setResult(null)`; `setDirty(true)`. Show a small grey `'from brochure'` tag next to each box that was filled (state: a set of filled keys, cleared when that box is edited by hand). Render `<BrochureUpload onFields={applyBrochure} />` right above the Training Programme Name card, inside `{scheme && (...)}`.

- [ ] **Step 4: Run** Jest -> all pass; `npm run build` -> "Compiled successfully".

- [ ] **Step 5: Commit** explicit paths; message `feat(calculator): brochure upload fills six boxes; upgrade wording for users without uploads`.

### Task 3: Real-brochure check and deploy (owner already approved building and deploying this feature)

- [ ] **Step 1:** Locally, with `ANTHROPIC_API_KEY` set only in the shell (never in a file in the repo), run one real extraction of `training brchure/WhatsApp Image 2026-10-15 at 10.01.14 AM.jpeg` through `extractBrochure` from a scratch script outside the repo. Expected: name contains "Associate HR Professional", `trainingType: 'rot_public'`, `venue: null`, `days: 7`, `duration: 'full_day'`, `actualCourseFee: 129`. Fix the prompt if not, re-run Task 1 tests.
- [ ] **Step 2:** Merge to `main`, push. Back up live on the server (`~/backups/`), upload `server/` code (skip `server/test/`, never `server/data/*.json`), `package.json`, `package-lock.json`, `build/`; on the server `npm install --omit=dev` (disk is ~94% full: check `df -h /` first); add `ANTHROPIC_API_KEY=` to the live `.env`; `pm2 restart hrd-calculator`; check the log shows the env loaded.
- [ ] **Step 3:** In the TGE admin "AI settings", set the cost rates to Claude Haiku 5.5 prices (from the Anthropic pricing page at deploy time).
- [ ] **Step 4:** Playwright on `https://www.milleniumrx.biz/product/calculator/desktop/` with the owner's VIP code: upload the sample brochure, confirm the six boxes fill and the count goes from 5 to 4 left; then reset the owner's count in TGE Users.
