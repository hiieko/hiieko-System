/**
 * Canonical units for the Solar domain.
 *
 *  Geometry   : millimetres (mm)  — never metres, never mixed
 *  Mass       : kilograms (kg)
 *  Force      : newtons (N) / kilonewtons (kN)
 *  Pressure   : kilopascals (kPa)
 *  Angles     : degrees (deg) in the persisted/shared domain model
 *               -> converted to radians ONLY at the Three.js rendering boundary
 *  Electrical : volts (V), amperes (A), watts (W), kilowatt-hours (kWh, later)
 */
export const DEG_TO_RAD = Math.PI / 180;
export const RAD_TO_DEG = 180 / Math.PI;

export const degToRad = (degrees: number): number => degrees * DEG_TO_RAD;
export const radToDeg = (radians: number): number => radians * RAD_TO_DEG;
