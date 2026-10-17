import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import BrochureUpload from './BrochureUpload';

global.IS_REACT_ACT_ENVIRONMENT = true;

const ai = { enabled: true, limit: 50, used: 3, remaining: 47, resets_on: '2026-11-17', reason: 'ok' };
const SIX = { trainingProgrammeName: 'Lean', trainingType: 'inhouse', venue: 'external_hotel', days: 3, duration: 'half_day', actualCourseFee: 1500 };

let container, root;
beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    localStorage.setItem('hrd_activation_code', 'HRD-AAAA-BBBB-CCCC');
});
afterEach(() => {
    act(() => root.unmount());
    container.remove();
    localStorage.clear();
    delete global.fetch;
});

// Routes the access call and the brochure call to separate replies.
function mockServer(status, body) {
    global.fetch = jest.fn((url) => {
        if (String(url).endsWith('/api/employer/access')) {
            return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ success: true, data: { tge: 'activated', ai } }) });
        }
        return Promise.resolve({ ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) });
    });
}
const brochureCalls = () => global.fetch.mock.calls.filter(c => String(c[0]).endsWith('/api/employer/ai-brochure'));

async function render(onFields = jest.fn(), platform = 'web') {
    await act(async () => { root.render(<BrochureUpload onFields={onFields} platform={platform} />); });
    return onFields;
}

async function pick(name, size = 10) {
    const input = container.querySelector('input[type="file"]');
    const file = new File(['x'.repeat(size)], name);
    Object.defineProperty(input, 'files', { configurable: true, value: [file] });
    await act(async () => { input.dispatchEvent(new Event('change', { bubbles: true })); });
}

test('shows title and uploads-left line', async () => {
    mockServer(200, {});
    await render();
    expect(container.textContent).toContain('📄 Upload brochure to fill in the form');
    expect(container.textContent).toContain('47 of 50 uploads left this month');
});

test('file input accepts', async () => {
    mockServer(200, {});
    await render();
    expect(container.querySelector('input[type="file"]').getAttribute('accept')).toBe('.pdf,.docx,.jpg,.jpeg,.png,.webp');
});

test('success calls onFields with the six fields', async () => {
    mockServer(200, { success: true, data: { fields: SIX, ai: { ...ai, used: 4, remaining: 46 } } });
    const onFields = await render();
    await pick('brochure.pdf');
    expect(onFields).toHaveBeenCalledWith(SIX);
    expect(container.textContent).toContain('Please check these values. Fill in the rest (pax, trainers…) yourself.');
    expect(container.textContent).toContain('46 of 50 uploads left this month');
    expect(container.textContent).not.toContain('Fee may include SST');
});

test("feeMayIncludeSst shows 'Fee may include SST, please check'", async () => {
    mockServer(200, { success: true, data: { fields: { ...SIX, feeMayIncludeSst: true }, ai } });
    const onFields = await render();
    await pick('brochure.png');
    expect(onFields).toHaveBeenCalledWith(SIX);
    expect(container.textContent).toContain('Fee may include SST, please check');
});

test('403 not_paying renders the upgrade message', async () => {
    mockServer(403, { success: false, reason: 'not_paying', ai: { ...ai, enabled: false, limit: 0, remaining: 0, reason: 'not_paying' } });
    const onFields = await render();
    await pick('brochure.pdf');
    expect(onFields).not.toHaveBeenCalled();
    expect(container.textContent).toContain('Upgrade for AI uploads');
    const hrefs = [...container.querySelectorAll('a')].map(a => a.getAttribute('href'));
    expect(hrefs).toContain('https://www.milleniumrx.biz/newsletter.html');
});

test('403 not_paying on app shows no newsletter', async () => {
    mockServer(403, { success: false, reason: 'not_paying', ai });
    await render(jest.fn(), 'app');
    await pick('brochure.pdf');
    expect(container.textContent.toLowerCase()).not.toMatch(/newsletter|subscribe/);
    expect(container.textContent).toContain("AI uploads aren't available for this code.");
});

test('429 limit_reached renders the out-of-uploads message', async () => {
    mockServer(429, { success: false, reason: 'limit_reached', ai: { ...ai, used: 50, remaining: 0 } });
    const onFields = await render();
    await pick('brochure.pdf');
    expect(onFields).not.toHaveBeenCalled();
    expect(container.textContent).toContain("You've used all your AI uploads for this month");
});

test.each([
    [422, { success: false, reason: 'read_failed', ai }, "We couldn't read the details from this file. It didn't use up an upload."],
    [413, { success: false, message: 'too big' }, 'File too large (max 10 MB)'],
    [503, { success: false, reason: 'not_configured', ai }, "Brochure reading isn't available right now. Please fill in the form yourself."],
    [400, { success: false, message: 'Unsupported file type' }, 'Please upload a PDF, Word (.docx) or image file'],
])('%s shows its message', async (status, body, text) => {
    mockServer(status, body);
    const onFields = await render();
    await pick('brochure.pdf');
    expect(onFields).not.toHaveBeenCalled();
    expect(container.textContent).toContain(text);
});

test('rejects .doc without calling fetch', async () => {
    mockServer(200, {});
    const onFields = await render();
    await pick('old.doc');
    expect(brochureCalls()).toHaveLength(0);
    expect(onFields).not.toHaveBeenCalled();
    expect(container.textContent).toContain('Please save it as PDF or .docx');
});

test('rejects a file over 10 MB without calling fetch', async () => {
    mockServer(200, {});
    await render();
    await pick('big.pdf', 10 * 1024 * 1024 + 1);
    expect(brochureCalls()).toHaveLength(0);
    expect(container.textContent).toContain('File too large (max 10 MB)');
});

test('no stored code', async () => {
    localStorage.removeItem('hrd_activation_code');
    mockServer(200, {});
    const onFields = await render();
    await pick('brochure.pdf');
    expect(global.fetch).not.toHaveBeenCalled();
    expect(onFields).not.toHaveBeenCalled();
    expect(container.textContent).toContain('Please enter your activation code again');
});

test("shows 'Reading your brochure…' while waiting", async () => {
    let resolve;
    global.fetch = jest.fn((url) => {
        if (String(url).endsWith('/api/employer/access')) {
            return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ success: true, data: { ai } }) });
        }
        return new Promise(r => { resolve = r; });
    });
    await render();
    await pick('brochure.pdf');
    expect(container.textContent).toContain('Reading your brochure…');
    await act(async () => { resolve({ ok: true, status: 200, json: () => Promise.resolve({ success: true, data: { fields: SIX, ai } }) }); });
    expect(container.textContent).not.toContain('Reading your brochure…');
});

test.each(['photo.jpg', 'photo.JPEG', 'scan.png', 'scan.webp'])('rejects an image over 4.5 MB without calling fetch (%s)', async (name) => {
    mockServer(200, {});
    const onFields = await render();
    await pick(name, 4.5 * 1024 * 1024 + 1);
    expect(brochureCalls()).toHaveLength(0);
    expect(onFields).not.toHaveBeenCalled();
    expect(container.textContent).toContain('Image too large (max 4.5 MB). Please send a smaller photo or a PDF.');
});

test('a PDF over 4.5 MB (under 10 MB) is still sent', async () => {
    mockServer(200, { success: true, data: { fields: SIX, ai } });
    const onFields = await render();
    await pick('brochure.pdf', 4.5 * 1024 * 1024 + 1);
    expect(brochureCalls()).toHaveLength(1);
    expect(onFields).toHaveBeenCalledWith(SIX);
});
