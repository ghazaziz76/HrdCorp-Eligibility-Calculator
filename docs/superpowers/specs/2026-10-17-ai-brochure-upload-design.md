# AI brochure upload: design

Date: 2026-10-17. Project: Training Grant Estimator (TGE), repo `HRDCalculator`, branch off `main` (which already has the TGE entitlement work: `server/routes/ai.js`, `server/ai/extractor.js` stub, `server/lib/usage.js`, `src/utils/tgeAccess.js`, `src/components/OutOfUploadsMessage.js`).

## 1. Intent and why

A user planning an HCC / SBL / SLB training should not have to type the basics off a training brochure. They upload the brochure; AI reads it and fills in a few calculator boxes; they check them and fill the rest. The upload is the paid perk that sells the yearly newsletter (50 uploads/month) and makes the TGE worth paying for. Access, limits, per-user overrides, the failed-read cap and the $20/month spend cap already exist on the server. This project adds the AI reading itself and the upload box in the calculator.

## 2. What the owner decided

- **Fields the AI fills (only these six; the user fills everything else):**

  | Calculator box (state in `HRDCorpCostCalculator.js`) | Rule |
  |---|---|
  | Training Programme Name (`trainingProgrammeName`) | Course title as printed (e.g. "Associate HR Professional Certificate (AHRP)") |
  | Type of Training (`trainingType`) | One of the existing option values (inhouse, rot_inhouse, coaching_mentoring, rot_public, public, seminar_conference, elearning, mobile_elearning, overseas, overseas_seminar, development). A public course on Zoom/online = `rot_public` |
  | Training Venue (`venue`) | `employer_premises` or `external_hotel` only when the brochure says so and the type is face-to-face; otherwise untouched |
  | Number of Training Days (`days`) | Count of training days (e.g. "19-23, 26-27 Oct" = 7) |
  | Daily Duration (`duration`) | `full_day` when the day is 7+ training hours (e.g. 9am-5pm), `half_day` when under 7 |
  | Actual Course Fee (`actualCourseFee`) | Per-pax fee in RM, **without SST** (e.g. "RM129.00 excl SST" = 129; if SST is included, take it out at the stated rate, else leave the printed number) |

- **Everyone can click Upload.** If the user has no uploads (not paying, $0 yearly, unverified Play, monthly 3 used up, etc.) the system tells them to **upgrade**, with the link to the yearly newsletter.
- Fee is **without SST**.

## 3. How the user sees it (web, HCC/SBL/SLB only)

At the top of the HCC/SBL/SLB form, above Training Programme Name: a box "📄 Upload brochure to fill in the form", with "N of M uploads left this month" under it (from the existing `AiAllowance`/`fetchAccess`).

1. User picks one file: PDF, Word (.docx), or image (JPG/PNG/WEBP), max 10 MB.
2. "Reading your brochure…" spinner.
3. The six boxes fill in; each gets a small "from brochure" tag; a note: "Please check these values. Fill in the rest (pax, trainers…) yourself." All boxes stay editable.
4. Fields the AI could not find are left as they were (never guessed).
5. If nothing usable is found: "We couldn't read the details from this file" and nothing changes. **It does not use up an upload** (it counts toward the existing 10 unreadable-files-per-day cap).
6. No access / out of uploads: the existing `OutOfUploadsMessage`, with the wording below.

## 4. Upgrade messages (change `aiBlockedMessage` in `src/utils/tgeAccess.js`)

- `not_paying` (newsletter code without uploads, incl. $0 yearly) and `play_unverified`: title "Upgrade for AI uploads", body "AI brochure uploads come with the yearly Business & People Management Newsletter: 50 uploads a month.", links: newsletter + admin email.
- `limit_reached`: keep the current text, and add "Upgrade to the yearly newsletter for 50 uploads a month." for web (keep app wording as is).
- `admin_off`, `locked`: keep the current "not available for this code" + admin email.
- `spend_paused`, `failed_cap`: unchanged.

## 5. Server (fills the existing contract in `server/ai/extractor.js`)

- `extractBrochure({ buffer, mimeType, originalName })` returns `{ fields, usage }` or throws (with `err.usage` when tokens were spent). The route, limits, costing and spend meter are already done; do not change their behaviour.
- AI: Anthropic Messages API over HTTPS with Node's built-in `fetch` (no SDK dependency needed), model `claude-haiku-5-5`, key from env `ANTHROPIC_API_KEY` (already supplied by the owner; it goes only into the server `.env`). Missing key = throw `code: 'not_configured'` (route answers 503, counts nothing).
- PDF -> `document` block (base64); images -> `image` block (base64); .docx -> extract text first (small pure-JS library such as `mammoth`, added as a dependency) and send as text. Old `.doc` -> answer "Please save it as PDF or .docx" without calling the AI (and without counting).
- Ask for strict JSON with exactly the six keys, each value or null; validate on the server: `trainingType`/`venue`/`duration` must be one of the allowed values else null; `days` positive integer else null; `actualCourseFee` non-negative number else null; `trainingProgrammeName` trimmed string <= 200 chars else null. All six null = throw (read failed).
- The file is never written to disk or logged; the existing route already drops the buffer.
- Cost settings: set the TGE Users cost rates to Haiku 5.5 prices at deploy (admin "AI settings").

## 6. Goals, non-goals, anti-goals

- Goals: the six fields filled correctly from typical Malaysian training brochures (PDF, WhatsApp photo, Word); clear upgrade path for users without access.
- Non-goals: other schemes (purchase-based, development programmes), the mobile app (M1 later), multi-brochure uploads, storing brochures, filling pax/trainers/allowances.
- Anti-goals: silently overwriting a box with a guess; charging an upload for an unreadable file; any brochure content kept on the server.

## 7. Calls made by the developer (not the owner; owner can overrule)

1. **Old `.doc`**: remove `application/msword` from `ALLOWED_MIME` in `server/routes/ai.js`, so it gets the existing 400 "Unsupported file type" before anything is counted. The client's file picker accepts only .pdf, .docx, .jpg, .jpeg, .png, .webp and shows "Please save it as PDF or .docx" for anything else, without calling the server.
2. **Stats keys**: update `pickAnonymous` in `server/lib/brochureStats.js` to read the new keys: `training_title` <- `trainingProgrammeName`, `delivery` <- `trainingType`, `duration` <- `"<days> x <duration>"` (or null), `course_fee` <- `actualCourseFee`. Same four anonymous fields as the approved entitlement design (month + 4 fields, no code or email). The brochure itself is never kept.
3. **Venue**: the Venue box only exists for in-house types (`inhouse`, `rot_inhouse`, `coaching_mentoring`) and `development`. Set `venue` only when the AI's type is one of those and the brochure states the venue. Otherwise leave it untouched (never reset).
4. **Setting fields**: apply the result through the calculator's existing setters / `fieldSetters` map (as saved plans already do), type first, then the rest, then clear the old result (`setResult(null)`) the way the inputs do.
5. **Duration**: "7+ hours" means the training hours in a day (session span minus a stated lunch break; if no break is stated, use the span). If no hours are stated, `duration` = null.
6. **Days**: a printed "N days" wins over counting dates. Otherwise count the listed dates.
7. **Fee**: the standard per-pax fee (not early-bird, member or group prices, unless that's the only one). If only an SST-inclusive price is printed and the rate is stated, the server backs it out (AI returns the printed amount plus `sst_included` and `sst_rate`). If the rate isn't stated, keep the printed number and the UI note says "Fee may include SST, please check".
8. **Code**: the client sends `x-tge-code` from `localStorage.hrd_activation_code` (the calculator is behind the activation gate, so it's always there) and multipart field `file`.
9. **Client messages**: 403/429 = `OutOfUploadsMessage` (section 4); 422 = "We couldn't read the details from this file. It didn't use up an upload."; 413 = "File too large (max 10 MB)"; 400 = "Please upload a PDF, Word (.docx) or image file"; 503/other = "Brochure reading isn't available right now. Please fill in the form yourself."
10. **API call**: `anthropic-version: 2023-06-01`, 60 s timeout (timeout = read failed), docx text capped at 50,000 characters.

## 8. Left to the builder

Exact component split and styling (match the existing calculator look), prompt wording, the "from brochure" tag style, test fixtures (use the sample brochure image in `training brchure/` and synthetic PDFs; never call the real API in tests: inject a fake fetch).
