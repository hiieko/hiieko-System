/**
 * Domain calculation utilities for Solar Site Management System
 */

/**
 * Calculates the great-circle distance between two GPS points in meters using the Haversine formula.
 */
export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth's radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

/**
 * Verifies if a worker's coordinates are within the site geofence boundary.
 */
export function isWithinSiteGeofence(
  workerLat: number,
  workerLng: number,
  siteLat: number,
  siteLng: number,
  allowedRadiusMeters: number = 300
): { isWithin: boolean; distanceMeters: number } {
  const distanceMeters = calculateHaversineDistance(workerLat, workerLng, siteLat, siteLng);
  return {
    isWithin: distanceMeters <= allowedRadiusMeters,
    distanceMeters,
  };
}

export interface AttendanceCalculationResult {
  totalMinutesWorked: number;
  normalHoursWorked: number;
  overtimeMinutes: number;
  overtimeHoursDisplay: string;
  restMinutesApplied: number;
  isLate: boolean;
  isEarlyLeave: boolean;
}

/**
 * Computes attendance hours and overtime based on standard shift configuration (default: 09:00 - 18:00 with 1h rest).
 */
export function calculateAttendanceWorkTime(
  checkInIso: string,
  checkOutIso: string | null | undefined,
  config: {
    standardStartHour?: number; // default 9
    standardStartMinute?: number; // default 0
    standardEndHour?: number; // default 18
    standardEndMinute?: number; // default 0
    standardRestMinutes?: number; // default 60
    gracePeriodMinutes?: number; // default 15
  } = {}
): AttendanceCalculationResult {
  const {
    standardStartHour = 9,
    standardStartMinute = 0,
    standardEndHour = 18,
    standardEndMinute = 0,
    standardRestMinutes = 60,
    gracePeriodMinutes = 15,
  } = config;

  const checkIn = new Date(checkInIso);
  if (!checkOutIso) {
    return {
      totalMinutesWorked: 0,
      normalHoursWorked: 0,
      overtimeMinutes: 0,
      overtimeHoursDisplay: '0h',
      restMinutesApplied: 0,
      isLate: false,
      isEarlyLeave: false,
    };
  }

  const checkOut = new Date(checkOutIso);
  const diffMs = Math.max(0, checkOut.getTime() - checkIn.getTime());
  const rawTotalMinutes = Math.floor(diffMs / (1000 * 60));

  // Check late arrival (e.g. after 09:15)
  const scheduledStart = new Date(checkIn);
  scheduledStart.setHours(standardStartHour, standardStartMinute, 0, 0);
  const isLate = checkIn.getTime() > scheduledStart.getTime() + gracePeriodMinutes * 60 * 1000;

  // Check early departure (e.g. before 18:00)
  const scheduledEnd = new Date(checkIn);
  scheduledEnd.setHours(standardEndHour, standardEndMinute, 0, 0);
  const isEarlyLeave = checkOut.getTime() < scheduledEnd.getTime() - gracePeriodMinutes * 60 * 1000;

  // Deduct standard rest if worked for at least 4 hours (240 mins)
  const restMinutesApplied = rawTotalMinutes >= 240 ? standardRestMinutes : 0;
  const netMinutes = Math.max(0, rawTotalMinutes - restMinutesApplied);

  // Standard workday net hours is 8h (480 minutes)
  const standardWorkDayMinutes = (standardEndHour - standardStartHour) * 60 - standardRestMinutes; // 480 mins = 8 hours
  
  let normalMinutes = netMinutes;
  let overtimeMinutes = 0;

  if (netMinutes > standardWorkDayMinutes) {
    normalMinutes = standardWorkDayMinutes;
    overtimeMinutes = netMinutes - standardWorkDayMinutes;
  }

  const normalHoursWorked = Number((normalMinutes / 60).toFixed(2));
  const otHours = Math.floor(overtimeMinutes / 60);
  const otMins = overtimeMinutes % 60;
  const overtimeHoursDisplay = otMins > 0 ? `${otHours}h ${otMins}m` : `${otHours}h`;

  return {
    totalMinutesWorked: netMinutes,
    normalHoursWorked,
    overtimeMinutes,
    overtimeHoursDisplay,
    restMinutesApplied,
    isLate,
    isEarlyLeave,
  };
}

/**
 * Validates whether a stock movement is legally permissible given the current stock balance.
 */
export function validateStockMovement(
  currentStock: number,
  movementQuantity: number, // positive for intake, negative for usage
  allowNegativeStock: boolean = false
): { isValid: boolean; resultingStock: number; errorMessage?: string } {
  const resultingStock = currentStock + movementQuantity;
  if (!allowNegativeStock && resultingStock < 0) {
    return {
      isValid: false,
      resultingStock: currentStock,
      errorMessage: `Stoc insuficient. Stoc curent: ${currentStock}, Cantitate solicitată: ${Math.abs(movementQuantity)}`,
    };
  }
  return {
    isValid: true,
    resultingStock,
  };
}
