import { fetchAccess, uploadsLeftText, aiBlockedMessage, clearStoredActivation } from './tgeAccess';

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

    test.each(['not_paying', 'play_unverified', 'admin_off'])('%s text with mailto', (r) => {
        const m = aiBlockedMessage(r, 'app');
        expect(m.body).toBe("AI uploads aren't available for this code.");
        expect(m.links).toEqual([{ label: 'admin@milleniumrx.biz', href: 'mailto:admin@milleniumrx.biz' }]);
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
