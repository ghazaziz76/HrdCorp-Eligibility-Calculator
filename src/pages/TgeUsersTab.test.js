import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import TgeUsersTab from './TgeUsersTab';

global.IS_REACT_ACT_ENVIRONMENT = true;

const OVER50 = 'More than 50 AI users — review the $20 monthly AI limit';
const adminHeader = { 'x-admin-password': 'pw' };

const row = (over = {}) => ({
    code: 'HRD-AAAA-BBBB-CCCC', source: 'yearly', email: 'a@b.c', name: 'Ann',
    newsletter_status: 'paid', tge: 'activated',
    ai: { enabled: true, limit: 50, used: 3, remaining: 47, resets_on: '2026-11-17', reason: 'ok' },
    last_used_at: null, total: 7, cost_month_usd: 0.12,
    admin: { ai_enabled: null, monthly_limit: null, revoked: false },
    play_verified: false, refunded_at: null, registered_at: null, ...over,
});

const listBody = (over = {}) => ({
    users: [row()],
    totals: { spend_month_usd: 1.5, limit_usd: 20, spend_pct: 7.5, ai_users: 1, over50: false },
    settings: { monthly_spend_limit_usd: 20, cost: { input_per_mtok: 3, output_per_mtok: 15, fallback_per_call_usd: 0.05 } },
    warnings: [], ...over,
});

let container, root, calls, showMsg;

let failPosts = false;

function mockFetch(body) {
    calls = [];
    global.fetch = jest.fn((url, opts = {}) => {
        calls.push({ url, opts });
        if (failPosts && opts.method === 'POST') {
            return Promise.resolve({ ok: false, status: 400, json: () => Promise.resolve({ error: 'x' }) });
        }
        let data = [];
        if (url.startsWith('/api/admin/tge-users') && !opts.method) data = body;
        else if (url.startsWith('/api/admin/tge-log')) data = [];
        else data = {};
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(data) });
    });
}

async function render(body = listBody()) {
    mockFetch(body);
    showMsg = jest.fn();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
        root.render(<TgeUsersTab adminHeader={adminHeader} showMsg={showMsg} />);
    });
    await act(async () => {});
}

afterEach(() => {
    failPosts = false;
    act(() => root.unmount());
    container.remove();
});

test('renders a row per user with "3 / 50"', async () => {
    await render(listBody({ users: [row(), row({ code: 'HRD-1111-2222-3333', email: 'x@y.z', ai: { enabled: true, limit: 10, used: 1, remaining: 9, resets_on: '2026-11-01', reason: 'ok' } })] }));
    expect(container.querySelectorAll('tbody tr').length).toBe(2);
    expect(container.textContent).toContain('3 / 50');
    expect(container.textContent).toContain('1 / 10');
});

test('shows over-50 warning text', async () => {
    await render(listBody({ warnings: [OVER50] }));
    expect(container.textContent).toContain(OVER50);
});

test('changing AI select to Off POSTs {ai_enabled:false}', async () => {
    await render();
    const sel = container.querySelector('select');
    await act(async () => {
        sel.value = 'off';
        sel.dispatchEvent(new Event('change', { bubbles: true }));
    });
    const post = calls.find((c) => c.opts.method === 'POST');
    expect(post.url).toBe('/api/admin/tge-users/HRD-AAAA-BBBB-CCCC');
    expect(JSON.parse(post.opts.body)).toEqual({ ai_enabled: false });
    expect(post.opts.headers['x-admin-password']).toBe('pw');
    expect(post.opts.headers['Content-Type']).toBe('application/json');
});

test('Revoke asks confirm and POSTs {revoked:true}', async () => {
    await render();
    window.confirm = jest.fn(() => true);
    const btn = [...container.querySelectorAll('button')].find((b) => b.textContent === 'Revoke');
    await act(async () => { btn.click(); });
    expect(window.confirm).toHaveBeenCalled();
    const post = calls.find((c) => c.opts.method === 'POST');
    expect(JSON.parse(post.opts.body)).toEqual({ revoked: true });
});

const posts = () => calls.filter((c) => c.opts.method === 'POST');
const setValue = (el, v) => {
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
};

test('Verify button renders only on Play rows', async () => {
    await render(listBody({ users: [row(), row({ code: 'HRD-PLAY-0000-0001', source: 'play', email: null, name: null })] }));
    const verifies = [...container.querySelectorAll('button')].filter((b) => b.textContent === 'Verify');
    expect(verifies.length).toBe(1);
    expect(verifies[0].closest('tr').textContent).toContain('Play Store');
});

test('clearing the per-row limit and blurring POSTs {monthly_limit:null}', async () => {
    await render(listBody({ users: [row({ admin: { ai_enabled: null, monthly_limit: 20, revoked: false } })] }));
    const input = container.querySelector('tbody input');
    expect(input.value).toBe('20');
    await act(async () => {
        setValue(input, '');
        input.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    });
    expect(posts().length).toBe(1);
    expect(JSON.parse(posts()[0].opts.body)).toEqual({ monthly_limit: null });
});

test('AI select Auto POSTs {ai_enabled:null} and On POSTs {ai_enabled:true}', async () => {
    await render(listBody({ users: [row({ admin: { ai_enabled: false, monthly_limit: null, revoked: false } })] }));
    const sel = () => container.querySelector('select');
    expect(sel().value).toBe('off');
    await act(async () => { sel().value = 'auto'; sel().dispatchEvent(new Event('change', { bubbles: true })); });
    await act(async () => { sel().value = 'on'; sel().dispatchEvent(new Event('change', { bubbles: true })); });
    expect(posts().map((p) => JSON.parse(p.opts.body))).toEqual([{ ai_enabled: null }, { ai_enabled: true }]);
});

test('a failing request reports the error via showMsg', async () => {
    await render();
    failPosts = true;
    await act(async () => { container.querySelector('select').value = 'off'; container.querySelector('select').dispatchEvent(new Event('change', { bubbles: true })); });
    expect(showMsg).toHaveBeenCalledWith('x', true);
});

test('a blank cost field does not POST and calls showMsg', async () => {
    await render();
    const inputs = [...container.querySelectorAll('input[type=number]')].filter((i) => !i.closest('tbody'));
    await act(async () => { setValue(inputs[1], '  '); });
    const save = [...container.querySelectorAll('button')].find((b) => b.textContent === 'Save settings');
    await act(async () => { save.click(); });
    expect(posts().length).toBe(0);
    expect(showMsg).toHaveBeenCalledWith(expect.stringMatching(/blank/i), true);
});

test('Last used renders in Malaysia time (UTC+8)', async () => {
    await render(listBody({ users: [row({ last_used_at: '2026-10-16T20:30:00.000Z' })] }));
    const tr = container.querySelector('tbody tr');
    expect(tr.textContent).toContain('2026-10-17 04:30');
});
