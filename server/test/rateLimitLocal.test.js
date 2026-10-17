const test = require('node:test');
const assert = require('node:assert');
const { createLimiter, clientKey } = require('../lib/rateLimit');

test('a local proxy address is not used as a rate-limit key', () => {
    assert.strictEqual(clientKey({ ip: '127.0.0.1' }), null);
    assert.strictEqual(clientKey({ ip: '::1' }), null);
    assert.strictEqual(clientKey({ ip: '::ffff:127.0.0.1' }), null);
    assert.strictEqual(clientKey({ ip: '' , socket: {} }), null);
    assert.strictEqual(clientKey({ ip: '203.0.113.5' }), '203.0.113.5');
});

test('requests with no known client address are never limited', () => {
    const l = createLimiter({ name: 't', max: 1 });
    assert.strictEqual(l.hit(null), true);
    assert.strictEqual(l.hit(null), true);
    assert.strictEqual(l.blocked(null), false);
    assert.strictEqual(l.hit('203.0.113.5'), true);
    assert.strictEqual(l.hit('203.0.113.5'), false);
});
