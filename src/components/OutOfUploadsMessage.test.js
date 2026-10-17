import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import OutOfUploadsMessage from './OutOfUploadsMessage';
import AiAllowance from './AiAllowance';

global.IS_REACT_ACT_ENVIRONMENT = true;

let container, root;
beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});
afterEach(() => {
    act(() => root.unmount());
    container.remove();
    localStorage.clear();
});

test('web limit_reached renders newsletter and admin links', () => {
    act(() => root.render(<OutOfUploadsMessage reason="limit_reached" platform="web" />));
    const hrefs = [...container.querySelectorAll('a')].map(a => a.getAttribute('href'));
    expect(hrefs).toEqual(['https://www.milleniumrx.biz/newsletter.html', 'mailto:admin@milleniumrx.biz']);
    expect(container.textContent).toContain('come back next month');
});

test('app limit_reached renders only the mailto link and no newsletter text', () => {
    act(() => root.render(<OutOfUploadsMessage reason="limit_reached" platform="app" />));
    const hrefs = [...container.querySelectorAll('a')].map(a => a.getAttribute('href'));
    expect(hrefs).toEqual(['mailto:admin@milleniumrx.biz']);
    expect(container.textContent.toLowerCase()).not.toMatch(/newsletter|subscribe/);
});

describe('AiAllowance', () => {
    afterEach(() => { delete global.fetch; });

    const mock = (ai) => {
        global.fetch = jest.fn(() => Promise.resolve({
            ok: true, status: 200,
            json: () => Promise.resolve({ success: true, data: { tge: 'activated', ai } }),
        }));
    };

    test('shows uploads left and a different-code link', async () => {
        mock({ enabled: true, limit: 50, used: 3, remaining: 47, resets_on: '2026-11-17', reason: 'ok' });
        await act(async () => { root.render(<AiAllowance code="HRD-AAAA-BBBB-CCCC" />); });
        expect(container.textContent).toContain('47 of 50 uploads left this month');
        expect(container.textContent).toContain('Have a different code?');
    });

    test('shows no allowance text when limit is 0 but keeps the different-code link', async () => {
        mock({ enabled: false, limit: 0, used: 0, remaining: 0, resets_on: '2026-11-17', reason: 'not_paying' });
        await act(async () => { root.render(<AiAllowance code="HRD-AAAA-BBBB-CCCC" />); });
        expect(container.textContent).not.toContain('uploads left');
        expect(container.textContent).toContain('Have a different code?');
    });

    test('clicking the link clears stored code and token and reopens the gate', async () => {
        mock({ enabled: true, limit: 10, used: 0, remaining: 10, resets_on: '2026-11-17', reason: 'ok' });
        localStorage.setItem('hrd_activation_code', 'x');
        localStorage.setItem('hrd_activation_token', 'y');
        const onReopen = jest.fn();
        await act(async () => { root.render(<AiAllowance code="HRD-AAAA-BBBB-CCCC" onReopenGate={onReopen} />); });
        const btn = [...container.querySelectorAll('button')].find(b => b.textContent === 'Have a different code?');
        act(() => { btn.click(); });
        expect(localStorage.getItem('hrd_activation_code')).toBeNull();
        expect(localStorage.getItem('hrd_activation_token')).toBeNull();
        expect(onReopen).toHaveBeenCalled();
    });
});
