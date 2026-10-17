import { fetchAccess, uploadsLeftText, aiBlockedMessage, clearStoredActivation, uploadBrochure } from './tgeAccess';

const ai = { enabled: true, limit: 50, used: 3, remaining: 47, resets_on: '2026-11-17', reason: 'ok' };

describe('uploadsLeftText', () => {
    test('formats remaining of limit', () => {
        expect(uploadsLeftText(ai)).toBe('47 of 50 uploads left this month');
    });
});

describe('aiBlockedMessage', () => {
    test('web limit_reached includes newsletter link and admin email', () => {
        const m = aiBlockedMessage('limit_reached', 'web');
        expect(m.body).toContain("You've used all your AI uploads for this month");
        expect(m.body).toContain('come back next month');
        expect(m.links).toEqual([
            { label: 'Subscribe to the Business & People Management Newsletter', href: 'https://www.milleniumrx.biz/newsletter.html' },
            { label: 'admin@milleniumrx.biz', href: 'mailto:admin@milleniumrx.biz' },
        ]);
    });

    test("app limit_reached contains no 'newsletter', 'subscribe', 'milleniumrx.biz/', '$' or price", () => {
        const m = aiBlockedMessage('limit_reached', 'app');
        expect(m.links).toEqual([{ label: 'admin@milleniumrx.biz', href: 'mailto:admin@milleniumrx.biz' }]);
        const s = JSON.stringify(m).toLowerCase();
        ['newsletter', 'subscribe', 'milleniumrx.biz/', '$', 'price', 'rm ', 'http'].forEach(w => {
            expect(s).not.toContain(w);
        });
    });

    test('spend_paused text', () => {
        const m = aiBlockedMessage('spend_paused', 'web');
        expect(m.body).toBe('AI uploads are paused for everyone until next month. Everything else in the estimator works as normal.');
    });

    test('failed_cap text', () => {
        expect(aiBlockedMessage('failed_cap', 'web').body).toBe('Too many unreadable files today — try again tomorrow.');
    });

    test.each([
        ['admin_off', 'web'], ['admin_off', 'app'],
        ['locked', 'web'], ['locked', 'app'],
        ['not_paying', 'app'], ['play_unverified', 'app'],
    ])('%s on %s: not available text with mailto', (r, platform) => {
        const m = aiBlockedMessage(r, platform);
        expect(m.body).toBe("AI uploads aren't available for this code.");
        expect(m.links).toEqual([{ label: 'admin@milleniumrx.biz', href: 'mailto:admin@milleniumrx.biz' }]);
    });

    test.each(['not_paying', 'play_unverified'])('web %s upgrade text', (r) => {
        const m = aiBlockedMessage(r, 'web');
        expect(m.title).toBe('Upgrade for AI uploads');
        expect(m.body).toBe('AI brochure uploads come with the yearly Business & People Management Newsletter: 50 uploads a month.');
        expect(m.links).toEqual([
            { label: 'Subscribe to the Business & People Management Newsletter', href: 'https://www.milleniumrx.biz/newsletter.html' },
            { label: 'admin@milleniumrx.biz', href: 'mailto:admin@milleniumrx.biz' },
        ]);
    });

    test('web limit_reached adds upgrade line', () => {
        const m = aiBlockedMessage('limit_reached', 'web');
        expect(m.body).toContain("You've used all your AI uploads for this month");
        expect(m.body).toContain('Upgrade to the yearly newsletter for 50 uploads a month.');
    });
});

describe('uploadBrochure', () => {
    afterEach(() => { delete global.fetch; });

    const reply = (status, body) => {
        global.fetch = jest.fn(() => Promise.resolve({ ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) }));
    };

    test('posts multipart with code header', async () => {
        const fields = { trainingProgrammeName: 'Lean', trainingType: 'inhouse', venue: null, days: 2, duration: 'full_day', actualCourseFee: 900 };
        reply(200, { success: true, data: { fields, ai } });
        const file = new File(['x'], 'b.pdf', { type: 'application/pdf' });
        const r = await uploadBrochure(file, 'HRD-AAAA-BBBB-CCCC');
        const [url, opts] = global.fetch.mock.calls[0];
        expect(url).toBe(`${window.location.origin}/api/employer/ai-brochure`);
        expect(opts.method).toBe('POST');
        expect(opts.headers['x-tge-code']).toBe('HRD-AAAA-BBBB-CCCC');
        expect(opts.body).toBeInstanceOf(FormData);
        expect(opts.body.get('file')).toBeInstanceOf(File);
        expect(r).toEqual({ ok: true, fields, ai });
    });

    test('maps 403 to { ok:false, status:403, reason }', async () => {
        reply(403, { success: false, reason: 'not_paying', ai });
        const r = await uploadBrochure(new File(['x'], 'b.pdf'), 'C');
        expect(r).toMatchObject({ ok: false, status: 403, reason: 'not_paying', ai });
    });

    test('network error -> status 0', async () => {
        global.fetch = jest.fn(() => Promise.reject(new Error('down')));
        const r = await uploadBrochure(new File(['x'], 'b.pdf'), 'C');
        expect(r).toMatchObject({ ok: false, status: 0 });
    });
});

describe('fetchAccess', () => {
    afterEach(() => { delete global.fetch; });

    test('returns data on success and posts the code', async () => {
        global.fetch = jest.fn(() => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ success: true, data: { tge: 'activated', ai } }) }));
        const r = await fetchAccess('HRD-AAAA-BBBB-CCCC');
        expect(r.tge).toBe('activated');
        expect(global.fetch.mock.calls[0][0]).toMatch(/\/api\/employer\/access$/);
        expect(JSON.parse(global.fetch.mock.calls[0][1].body)).toEqual({ code: 'HRD-AAAA-BBBB-CCCC' });
    });

    test('returns null on network error', async () => {
        global.fetch = jest.fn(() => Promise.reject(new Error('down')));
        expect(await fetchAccess('HRD-AAAA-BBBB-CCCC')).toBeNull();
    });

    test('returns null on unknown code (404)', async () => {
        global.fetch = jest.fn(() => Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({ success: false }) }));
        expect(await fetchAccess('HRD-AAAA-BBBB-CCCC')).toBeNull();
    });
});

test('clearStoredActivation removes code and token', () => {
    localStorage.setItem('hrd_activation_code', 'x');
    localStorage.setItem('hrd_activation_token', 'y');
    clearStoredActivation();
    expect(localStorage.getItem('hrd_activation_code')).toBeNull();
    expect(localStorage.getItem('hrd_activation_token')).toBeNull();
});
