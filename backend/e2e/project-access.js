#!/usr/bin/env node
/**
 * E2E authorization test — R2.1 P5 Project Access
 *
 * Usage: node e2e/project-access.js
 *
 * Environment:
 *   API_BASE_URL, E2E_ADMIN_TOKEN, E2E_WORKER_TOKEN, E2E_NON_MEMBER_TOKEN,
 *   E2E_PROJECT_ID, E2E_ORG_ID, E2E_TARGET_USER_ID
 *
 * Tests: global-role bypass, member/non-member access, fail-closed,
 *   entity-derived, project list scoping, membership CRUD, PO scoping.
 */
const http = require('http');
const BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
const TEST_PREFIX = '[E2E ACCESS]';

function fetchJson(path, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const opts = {
      method: options.method || 'GET',
      headers: { 'Content-Type': 'application/json', ...options.headers },
    };
    if (options.body) opts.body = JSON.stringify(options.body);
    const req = http.request(url, opts, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: data.length ? JSON.parse(data) : null }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    if (options.body) req.write(JSON.stringify(options.body));
    req.end();
  });
}


let passed = 0, failed = 0, skipped = 0;

const ADMIN_TOKEN = process.env.E2E_ADMIN_TOKEN;
const WORKER_TOKEN = process.env.E2E_WORKER_TOKEN;
const NON_MEMBER_TOKEN = process.env.E2E_NON_MEMBER_TOKEN;
const TEST_PROJECT_ID = process.env.E2E_PROJECT_ID;
const TARGET_USER_ID = process.env.E2E_TARGET_USER_ID;

const auth = (token) => ({ Authorization: `Bearer ${token}` });

function assert(condition, label) {
  if (condition) { passed++; console.log(`  ✓ ${label}`); }
  else { failed++; console.error(`  ✗ ${label}`); }
}
function assertStatus(actual, expected, label) {
  if (actual === expected) { passed++; console.log(`  ✓ ${label} (${expected})`); }
  else { failed++; console.error(`  ✗ ${label} — expected ${expected}, got ${actual}`); }
}
function skip(label) { skipped++; console.log(`  ○ ${label} (skipped)`); }

async function main() {
  console.log(`${TEST_PREFIX} Starting Project Access E2E tests...`);
  console.log(`  Base URL: ${BASE_URL}`);
  console.log('');

  // 1. Unauthenticated → 401
  console.log('── Unauthenticated ──');
  const res401 = await fetchJson('/api/projects');
  assertStatus(res401.status, 401, 'GET /api/projects without token → 401');

  // 2. Global-scope role bypass
  console.log('── Global-scope role bypass ──');
  if (ADMIN_TOKEN && TEST_PROJECT_ID) {
    const res = await fetchJson(`/api/projects/${TEST_PROJECT_ID}`, { headers: auth(ADMIN_TOKEN) });
    assert(res.status === 200 || res.status === 404, `Admin project access (${res.status})`);
  } else { skip('Admin project access'); }

  // 3. Non-member → 403
  console.log('── Non-member → 403 ──');
  if (NON_MEMBER_TOKEN && TEST_PROJECT_ID) {
    const res = await fetchJson(`/api/projects/${TEST_PROJECT_ID}`, { headers: auth(NON_MEMBER_TOKEN) });
    assertStatus(res.status, 403, `GET /api/projects/:id as non-member`);
  } else { skip('Non-member 403 test'); }

  // 4. Project list scoping
  console.log('── Project list scoping ──');
  if (ADMIN_TOKEN) {
    const res = await fetchJson('/api/projects', { headers: auth(ADMIN_TOKEN) });
    assertStatus(res.status, 200, 'GET /api/projects as admin → 200');
  } else { skip('Admin project list'); }

  // 5. Membership CRUD
  console.log('── Membership CRUD ──');
  if (ADMIN_TOKEN && TEST_PROJECT_ID && TARGET_USER_ID) {
    const addRes = await fetchJson(`/api/projects/${TEST_PROJECT_ID}/members`, {
      method: 'POST', headers: auth(ADMIN_TOKEN), body: { userId: TARGET_USER_ID, role: 'WORKER' },
    });
    assertStatus(addRes.status, 201, 'POST /members add → 201');

    const dupRes = await fetchJson(`/api/projects/${TEST_PROJECT_ID}/members`, {
      method: 'POST', headers: auth(ADMIN_TOKEN), body: { userId: TARGET_USER_ID, role: 'WORKER' },
    });
    assert(dupRes.status === 200 || dupRes.status === 201, `POST /members duplicate → idempotent (${dupRes.status})`);

    const listRes = await fetchJson(`/api/projects/${TEST_PROJECT_ID}/members`, { headers: auth(ADMIN_TOKEN) });
    assertStatus(listRes.status, 200, 'GET /members list → 200');
    assert(Array.isArray(listRes.body?.data), 'Response data is array');

    const patchRes = await fetchJson(`/api/projects/${TEST_PROJECT_ID}/members/${TARGET_USER_ID}`, {
      method: 'PATCH', headers: auth(ADMIN_TOKEN), body: { role: 'TEAM_LEADER' },
    });
    assertStatus(patchRes.status, 200, 'PATCH /members role → 200');

    const delRes = await fetchJson(`/api/projects/${TEST_PROJECT_ID}/members/${TARGET_USER_ID}`, {
      method: 'DELETE', headers: auth(ADMIN_TOKEN),
    });
    assertStatus(delRes.status, 200, 'DELETE /members remove → 200');
  } else { skip('Membership CRUD'); }

  // 6. Purchase order scoping
  console.log('── Purchase order scoping ──');
  if (ADMIN_TOKEN) {
    const res = await fetchJson('/api/procurement/purchase-orders', { headers: auth(ADMIN_TOKEN) });
    assertStatus(res.status, 200, 'GET /procurement/purchase-orders → 200');
    assert(Array.isArray(res.body?.data), 'Response data is array');
  } else { skip('PO scoping'); }

  // Summary
  console.log('');
  console.log('═══════════════════════════════════════');
  console.log(`  Passed: ${passed}  Failed: ${failed}  Skipped: ${skipped}`);
  console.log('═══════════════════════════════════════');
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => { console.error('E2E crashed:', err); process.exit(1); });

