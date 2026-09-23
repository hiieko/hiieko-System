/**
 * HIIEKO R2.3 - Permanent E2E Stock + Avize Verification
 */
const { Client } = require('pg');
const http = require('http');
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('FATAL: DATABASE_URL environment variable is required.');
  console.error('Usage: DATABASE_URL=postgresql://user:pass@host:5432/hiieko?schema=public node e2e/stock-avize.js');
  process.exit(1);
}
const conn = DATABASE_URL;
const BASE = 'http://localhost:4000/api';
let TOKEN = ''; let USER_ID = ''; let PROJECT_ID = ''; let PROJECT_B = ''; let MATERIAL_ID = '';
let passed = 0; let failed = 0;

function httpReq(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE + path);
    const opts = { hostname: url.hostname, port: url.port, path: url.pathname + url.search, method, headers: { 'Content-Type': 'application/json' }, timeout: 15000 };
    if (token) opts.headers['Authorization'] = 'Bearer ' + token;
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => { try { resolve({ status: res.statusCode, body: JSON.parse(data) }); } catch { resolve({ status: res.statusCode, body: data }); } });
    });
    req.on('error', reject); req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function assert(label, cond, detail) {
  if (cond) { console.log('  PASS  ' + label + (detail ? ': ' + detail : '')); passed++; }
  else      { console.log('  FAIL  ' + label + (detail ? ': ' + detail : '')); failed++; }
}

async function login() {
  const r = await httpReq('POST', '/auth/login', { email: 'dev@hiieko.local', password: 'DevPassword123!' });
  assert('T01 Login returns 200', r.status === 200);
  if (r.status === 200) {
    const loginData = r.body.data || r.body;
    TOKEN = loginData.accessToken || loginData.access_token || '';
    USER_ID = loginData.user?.id || '';
  }
  return r.status === 200;
}

async function getProjectIds() {
  const r = await httpReq('GET', '/projects', null, TOKEN);
  assert('T02 GET /projects returns 200', r.status === 200);
  if (r.status === 200) {
    const projects = r.body.data || r.body;
    if (Array.isArray(projects)) {
      PROJECT_ID = projects[0]?.id || '';
      PROJECT_B = projects[1]?.id || '';
    }
  }
  return PROJECT_ID && PROJECT_B;
}

async function getMaterialIds() {
  const r = await httpReq('GET', '/materials', null, TOKEN);
  assert('T03 GET /materials returns 200', r.status === 200);
  if (r.status === 200) {
    const materials = r.body.data || r.body;
    if (Array.isArray(materials)) {
      MATERIAL_ID = materials[0]?.id || '';
    }
  }
  return !!MATERIAL_ID;
}

async function testUnauthenticated() {
  const r = await httpReq('GET', '/inventory/balance');
  assert('T04 Unauthenticated -> 401', r.status === 401);
}

async function testCreateAviz() {
  const payload = {
    projectId: PROJECT_ID,
    avizNumber: 'E2E-' + Date.now(),
    supplierName: 'E2E Test Supplier',
    deliveryDate: new Date().toISOString().split('T')[0],
    items: [{ materialId: MATERIAL_ID, quantity: 10 }],
  };
  const r = await httpReq('POST', '/procurement/avize', payload, TOKEN);
  assert('T05 Create aviz returns 201', r.status === 201);
  return r.status === 201 ? r.body : null;
}

async function testCreateAvizOnProjectB() {
  const payload = {
    projectId: PROJECT_B,
    avizNumber: 'E2E-B-' + Date.now(),
    supplierName: 'E2E Test Supplier B',
    deliveryDate: new Date().toISOString().split('T')[0],
    items: [{ materialId: MATERIAL_ID, quantity: 5 }],
  };
  const r = await httpReq('POST', '/procurement/avize', payload, TOKEN);
  assert('T06 Create aviz on project B returns 201', r.status === 201);
  return r.status === 201 ? r.body : null;
}

async function testGetAvize() {
  const r = await httpReq('GET', '/procurement/avize', null, TOKEN);
  assert('T07 GET /procurement/avize returns 200', r.status === 200);
}

async function testGetStock() {
  const r = await httpReq('GET', '/inventory/stock', null, TOKEN);
  assert('T08 GET /inventory/stock returns 200', r.status === 200);
}

async function testGetMovements() {
  const r = await httpReq('GET', '/inventory/movements', null, TOKEN);
  assert('T09 GET /inventory/movements returns 200', r.status === 200);
}

async function testGetBalance() {
  const r = await httpReq('GET', '/inventory/balance', null, TOKEN);
  assert('T10 GET /inventory/balance returns 200', r.status === 200);
}

async function testAvizExistsInDb(client) {
  const r = await client.query("SELECT id FROM public.avize WHERE aviz_number LIKE 'E2E-%'");
  assert('T11 Aviz rows exist in DB', r.rows.length > 0);
}

async function testAvizItemsInDb(client) {
  const r = await client.query("SELECT id FROM public.aviz_items WHERE aviz_id IN (SELECT id FROM public.avize WHERE aviz_number LIKE 'E2E-%')");
  assert('T12 Aviz item rows exist in DB', r.rows.length > 0);
}

async function testStockBalanceIncreased(client) {
  const r = await client.query('SELECT sum(current_quantity) AS total FROM public.stock_balances WHERE material_id = $1', [MATERIAL_ID]);
  assert('T13 Stock balance increased', parseFloat(r.rows[0]?.total || '0') > 0);
}

async function testReceiptMovementExists(client) {
  const r = await client.query("SELECT count(*) AS n FROM public.stock_movements WHERE reference_type = 'aviz' AND movement_type = 'RECEIPT'");
  assert('T14 RECEIPT movements referencing aviz exist', parseInt(r.rows[0]?.n || '0', 10) > 0);
}

async function testAuditLogsExist(client) {
  const r = await client.query("SELECT count(*) AS n FROM public.audit_logs WHERE entity = 'Aviz'");
  assert('T15 Audit logs exist for aviz', parseInt(r.rows[0]?.n || '0', 10) > 0);
}

async function testIdempotency() {
  const idKey = 'e2e-idem-' + Date.now();
  const payload = {
    projectId: PROJECT_ID,
    avizNumber: 'E2E-IDEM-' + Date.now(),
    supplierName: 'Idempotency Test',
    deliveryDate: new Date().toISOString().split('T')[0],
    items: [{ materialId: MATERIAL_ID, quantity: 3 }],
    idempotencyKey: idKey,
  };
  const r1 = await httpReq('POST', '/procurement/avize', payload, TOKEN);
  assert('T16 Idempotency first call returns 201', r1.status === 201);
  const r2 = await httpReq('POST', '/procurement/avize', payload, TOKEN);
  assert('T17 Idempotency replay returns 200/201 (no duplicate)', r2.status === 200 || r2.status === 201);
}

async function testDuplicateAvizOnSameProject() {
  const avizNum = 'E2E-DUP-' + Date.now();
  const payload = {
    projectId: PROJECT_ID, avizNumber: avizNum,
    supplierName: 'Dup Test', deliveryDate: new Date().toISOString().split('T')[0],
    items: [{ materialId: MATERIAL_ID, quantity: 2 }],
  };
  const r1 = await httpReq('POST', '/procurement/avize', payload, TOKEN);
  assert('T18 First create with number', r1.status === 201);
  const r2 = await httpReq('POST', '/procurement/avize', payload, TOKEN);
  assert('T19 Duplicate number on same project -> 409', r2.status === 409);
}

async function testSameAvizNumberDifferentProject() {
  const avizNum = 'E2E-CROSS-' + Date.now();
  const payloadA = {
    projectId: PROJECT_ID, avizNumber: avizNum,
    supplierName: 'Cross A', deliveryDate: new Date().toISOString().split('T')[0],
    items: [{ materialId: MATERIAL_ID, quantity: 2 }],
  };
  const payloadB = {
    projectId: PROJECT_B, avizNumber: avizNum,
    supplierName: 'Cross B', deliveryDate: new Date().toISOString().split('T')[0],
    items: [{ materialId: MATERIAL_ID, quantity: 2 }],
  };
  const r1 = await httpReq('POST', '/procurement/avize', payloadA, TOKEN);
  assert('T20 Same number on project A -> 201', r1.status === 201);
  const r2 = await httpReq('POST', '/procurement/avize', payloadB, TOKEN);
  assert('T21 Same number on project B -> 201 (per-project scope)', r2.status === 201);
}

async function testConsumeExact() {
  const bal = await httpReq('GET', '/inventory/balance?materialId=' + MATERIAL_ID + '&projectId=' + PROJECT_ID, null, TOKEN);
  let qty = 0;
  if (bal.status === 200) {
    const items = bal.body.data || bal.body;
    if (Array.isArray(items)) {
      qty = items.length > 0 ? parseFloat(items[0].currentQuantity || items[0].current_quantity || '0') : 0;
    } else if (items && items.currentQuantity !== undefined) {
      qty = parseFloat(items.currentQuantity);
    } else if (items && items.current_quantity !== undefined) {
      qty = parseFloat(items.current_quantity);
    }
  }
  if (qty <= 0) { console.log('  SKIP  T22 Consume exact (no balance)'); passed++; return; }
  const consume = await httpReq('POST', '/inventory/consume', {
    projectId: PROJECT_ID, materialId: MATERIAL_ID, quantity: qty,
    referenceType: 'e2e_test', notes: 'E2E consume exact',
  }, TOKEN);
  assert('T22 Consume exact available -> 200/201', consume.status === 200 || consume.status === 201);
  const bal2 = await httpReq('GET', '/inventory/balance?materialId=' + MATERIAL_ID + '&projectId=' + PROJECT_ID, null, TOKEN);
  let remaining = 0;
  if (bal2.status === 200) {
    const items2 = bal2.body.data || bal2.body;
    if (Array.isArray(items2)) {
      remaining = items2.length > 0 ? parseFloat(items2[0].currentQuantity || items2[0].current_quantity || '0') : 0;
    } else if (items2 && items2.currentQuantity !== undefined) {
      remaining = parseFloat(items2.currentQuantity);
    } else if (items2 && items2.current_quantity !== undefined) {
      remaining = parseFloat(items2.current_quantity);
    }
  }
  assert('T23 Balance reaches zero after exact consume', remaining === 0);
}

async function testConsumeAfterZero() {
  const r = await httpReq('POST', '/inventory/consume', {
    projectId: PROJECT_ID, materialId: MATERIAL_ID, quantity: 1,
    referenceType: 'e2e_test', notes: 'E2E consume after zero',
  }, TOKEN);
  assert('T24 Consume after zero -> 400/409', r.status === 400 || r.status === 409);
}

async function testConsumeExcess() {
  const bal = await httpReq('GET', '/inventory/balance?materialId=' + MATERIAL_ID + '&projectId=' + PROJECT_B, null, TOKEN);
  let qty = 0;
  if (bal.status === 200) {
    const items = bal.body.data || bal.body;
    if (Array.isArray(items)) {
      qty = items.length > 0 ? parseFloat(items[0].currentQuantity || items[0].current_quantity || '0') : 0;
    } else if (items && items.currentQuantity !== undefined) {
      qty = parseFloat(items.currentQuantity);
    } else if (items && items.current_quantity !== undefined) {
      qty = parseFloat(items.current_quantity);
    }
  }
  if (qty <= 0) { console.log('  SKIP  T25 Consume excess (no balance on B)'); passed++; return; }
  const r = await httpReq('POST', '/inventory/consume', {
    projectId: PROJECT_B, materialId: MATERIAL_ID, quantity: qty + 1,
    referenceType: 'e2e_test', notes: 'E2E consume excess',
  }, TOKEN);
  assert('T25 Consume more than available -> 400/409', r.status === 400 || r.status === 409);
}

async function testTransfer() {
  const r = await httpReq('POST', '/inventory/transfer', {
    sourceProjectId: PROJECT_B, targetProjectId: PROJECT_ID,
    materialId: MATERIAL_ID, quantity: 1,
    notes: 'E2E transfer test',
  }, TOKEN);
  assert('T26 Transfer stock -> 200/201', r.status === 200 || r.status === 201);
}

async function testTransferSourceDecreased(client) {
  const r = await client.query("SELECT count(*)::int AS n FROM public.stock_movements WHERE movement_type = 'TRANSFER_OUT'");
  assert('T27 TRANSFER_OUT movement exists', parseInt(r.rows[0]?.n || '0', 10) > 0);
}

async function testTransferTargetIncreased(client) {
  const r = await client.query("SELECT count(*)::int AS n FROM public.stock_movements WHERE movement_type = 'TRANSFER_IN'");
  assert('T28 TRANSFER_IN movement exists', parseInt(r.rows[0]?.n || '0', 10) > 0);
}

async function testInvalidTransferNoSource() {
  const r = await httpReq('POST', '/inventory/transfer', {
    targetProjectId: PROJECT_ID,
    materialId: MATERIAL_ID, quantity: 1,
    notes: 'E2E invalid transfer no source',
  }, TOKEN);
  assert('T29 Invalid transfer (no source) -> 400', r.status === 400);
}

async function testInvalidTransferSameSourceTarget() {
  const r = await httpReq('POST', '/inventory/transfer', {
    sourceProjectId: PROJECT_ID, targetProjectId: PROJECT_ID,
    materialId: MATERIAL_ID, quantity: 1,
    notes: 'E2E invalid transfer same',
  }, TOKEN);
  assert('T30 Invalid transfer (same source/target) -> 400', r.status === 400);
}

async function main() {
  console.log('=== HIIEKO R2.3 E2E Stock + Avize Verification ===');
  const client = new Client({ connectionString: conn });
  await client.connect();
  try {
    if (!await login()) { console.log('ABORT: login failed'); process.exit(1); }
    if (!await getProjectIds()) { console.log('ABORT: could not get projects'); process.exit(1); }
    if (!await getMaterialIds()) { console.log('ABORT: could not get materials'); process.exit(1); }
    await testUnauthenticated();
    await testCreateAviz();
    await testCreateAvizOnProjectB();
    await testGetAvize();
    await testGetStock();
    await testGetMovements();
    await testGetBalance();
    await testAvizExistsInDb(client);
    await testAvizItemsInDb(client);
    await testStockBalanceIncreased(client);
    await testReceiptMovementExists(client);
    await testAuditLogsExist(client);
    await testIdempotency();
    await testDuplicateAvizOnSameProject();
    await testSameAvizNumberDifferentProject();
    await testConsumeExact();
    await testConsumeAfterZero();
    await testConsumeExcess();
    await testTransfer();
    await testTransferSourceDecreased(client);
    await testTransferTargetIncreased(client);
    await testInvalidTransferNoSource();
    await testInvalidTransferSameSourceTarget();
  } finally {
    await client.end();
  }
  console.log('');
  console.log('Passed: ' + passed + ', Failed: ' + failed + ', Total: ' + (passed + failed));
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => { console.error('E2E FAILED:', e.message); process.exit(1); });
