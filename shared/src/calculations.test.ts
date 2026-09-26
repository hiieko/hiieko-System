import { 
  calculateHaversineDistance, 
  isWithinProjectGeofence, 
  calculateAttendanceWorkTime, 
  validateStockMovement 
} from './calculations';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`FAIL: ${message}`);
  }
  console.log(`✓ PASS: ${message}`);
}

console.log('--- RUNNING DOMAIN & INTEGRITY CHECKS ---');

// 1. Geofence & GPS tests
const craiovaSite = { lat: 44.2981, lng: 23.8122, radius: 350 };
const workerNearby = { lat: 44.2982, lng: 23.8123 }; // ~14m away
const workerFarAway = { lat: 44.3100, lng: 23.8500 }; // ~3.3km away

const testNearby = isWithinProjectGeofence(workerNearby.lat, workerNearby.lng, craiovaSite.lat, craiovaSite.lng, craiovaSite.radius);
assert(testNearby.isWithin === true, `Worker nearby (${testNearby.distanceMeters}m) is within 350m geofence`);

const testFar = isWithinProjectGeofence(workerFarAway.lat, workerFarAway.lng, craiovaSite.lat, craiovaSite.lng, craiovaSite.radius);
assert(testFar.isWithin === false, `Worker far away (${testFar.distanceMeters}m) is correctly marked outside geofence`);

// 2. Attendance & Overtime tests (09:00 - 18:00 with 1h rest = 8h normal)
// Departure at 18:00
const normalDay = calculateAttendanceWorkTime('2026-09-14T09:00:00Z', '2026-09-14T18:00:00Z');
assert(normalDay.normalHoursWorked === 8, `09:00-18:00 yields exactly 8 normal hours worked (got ${normalDay.normalHoursWorked})`);
assert(normalDay.overtimeMinutes === 0, `09:00-18:00 yields 0 overtime minutes`);

// Departure at 19:00 -> 1 hour overtime
const oneHourOt = calculateAttendanceWorkTime('2026-09-14T09:00:00Z', '2026-09-14T19:00:00Z');
assert(oneHourOt.normalHoursWorked === 8, `09:00-19:00 has 8 normal hours`);
assert(oneHourOt.overtimeMinutes === 60, `09:00-19:00 yields exactly 60 minutes (1h) overtime`);
assert(oneHourOt.overtimeHoursDisplay === '1h', `09:00-19:00 displays as 1h overtime`);

// Departure at 20:00 -> 2 hours overtime
const twoHourOt = calculateAttendanceWorkTime('2026-09-14T09:00:00Z', '2026-09-14T20:00:00Z');
assert(twoHourOt.overtimeMinutes === 120, `09:00-20:00 yields exactly 120 minutes (2h) overtime`);

// 3. Stock movement integrity tests
const stockIntake = validateStockMovement(0, 50, false);
assert(stockIntake.isValid === true && stockIntake.resultingStock === 50, 'Delivery +50 items increases stock from 0 to 50');

const stockUsage = validateStockMovement(50, -3, false);
assert(stockUsage.isValid === true && stockUsage.resultingStock === 47, 'Usage of 3 panels reduces stock to 47');

const stockOverdraw = validateStockMovement(2, -5, false);
assert(stockOverdraw.isValid === false, 'Disallow consuming 5 items when only 2 are available (prevents negative stock invariant)');

console.log('--- ALL CALCULATION & INTEGRITY TESTS PASSED ---');
