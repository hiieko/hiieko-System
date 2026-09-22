/**
 * Local Data Service for HIIEKO Mobile
 * 
 * Manages local SQLite storage for projects, materials, and other entities.
 * Provides offline access to cached data.
 */

import { getDatabase } from './database';

// ============================================================================
// PROJECTS
// ============================================================================

export interface Project {
  id: string;
  name: string;
  code: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  geofence_radius_meters?: number;
  is_active: boolean;
  synced_at?: string;
}

export async function saveProjects(projects: Project[]): Promise<void> {
  const db = await getDatabase();
  
  for (const project of projects) {
    await db.runAsync(
      `INSERT OR REPLACE INTO projects (id, name, code, address, latitude, longitude, geofence_radius_meters, is_active, synced_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        project.id,
        project.name,
        project.code,
        project.address || null,
        project.latitude || null,
        project.longitude || null,
        project.geofence_radius_meters || null,
        project.is_active ? 1 : 0,
        new Date().toISOString(),
      ]
    );
  }
  
  console.log(`✅ Saved ${projects.length} projects to local database`);
}

export async function getProjects(): Promise<Project[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<any>(
    'SELECT * FROM projects WHERE is_active = 1 ORDER BY name ASC'
  );
  
  return rows.map((row: any) => ({
    id: row.id,
    name: row.name,
    code: row.code,
    address: row.address,
    latitude: row.latitude,
    longitude: row.longitude,
    geofence_radius_meters: row.geofence_radius_meters,
    is_active: row.is_active === 1,
    synced_at: row.synced_at,
  }));
}

export async function getProject(id: string): Promise<Project | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<any>(
    'SELECT * FROM projects WHERE id = ?',
    [id]
  );
  
  if (!row) return null;
  
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    address: row.address,
    latitude: row.latitude,
    longitude: row.longitude,
    geofence_radius_meters: row.geofence_radius_meters,
    is_active: row.is_active === 1,
    synced_at: row.synced_at,
  };
}

// ============================================================================
// MATERIALS
// ============================================================================

export interface Material {
  id: string;
  code: string;
  name: string;
  unit: string;
  is_active: boolean;
  synced_at?: string;
}

export async function saveMaterials(materials: Material[]): Promise<void> {
  const db = await getDatabase();
  
  for (const material of materials) {
    await db.runAsync(
      `INSERT OR REPLACE INTO materials (id, code, name, unit, is_active, synced_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        material.id,
        material.code,
        material.name,
        material.unit,
        material.is_active ? 1 : 0,
        new Date().toISOString(),
      ]
    );
  }
  
  console.log(`✅ Saved ${materials.length} materials to local database`);
}

export async function getMaterials(): Promise<Material[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<any>(
    'SELECT * FROM materials WHERE is_active = 1 ORDER BY name ASC'
  );
  
  return rows.map((row: any) => ({
    id: row.id,
    code: row.code,
    name: row.name,
    unit: row.unit,
    is_active: row.is_active === 1,
    synced_at: row.synced_at,
  }));
}


// ============================================================================
// ATTENDANCE
// ============================================================================

export interface Attendance {
  id: string;
  user_id: string;
  project_id: string;
  check_in_time: string;
  check_in_latitude?: number;
  check_in_longitude?: number;
  check_out_time?: string;
  check_out_latitude?: number;
  check_out_longitude?: number;
  notes?: string;
  status: string;
  synced: boolean;
  synced_at?: string;
}

export async function saveAttendance(attendance: Attendance): Promise<void> {
  const db = await getDatabase();
  
  await db.runAsync(
    `INSERT OR REPLACE INTO attendance 
     (id, user_id, project_id, check_in_time, check_in_latitude, check_in_longitude, 
      check_out_time, check_out_latitude, check_out_longitude, notes, status, synced, synced_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      attendance.id,
      attendance.user_id,
      attendance.project_id,
      attendance.check_in_time,
      attendance.check_in_latitude || null,
      attendance.check_in_longitude || null,
      attendance.check_out_time || null,
      attendance.check_out_latitude || null,
      attendance.check_out_longitude || null,
      attendance.notes || null,
      attendance.status,
      attendance.synced ? 1 : 0,
      attendance.synced_at || null,
    ]
  );
}

export async function getActiveAttendance(userId: string): Promise<Attendance | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<any>(
    `SELECT * FROM attendance 
     WHERE user_id = ? AND status = 'active' AND check_out_time IS NULL 
     ORDER BY check_in_time DESC LIMIT 1`,
    [userId]
  );
  
  if (!row) return null;
  
  return {
    id: row.id,
    user_id: row.user_id,
    project_id: row.project_id,
    check_in_time: row.check_in_time,
    check_in_latitude: row.check_in_latitude,
    check_in_longitude: row.check_in_longitude,
    check_out_time: row.check_out_time,
    check_out_latitude: row.check_out_latitude,
    check_out_longitude: row.check_out_longitude,
    notes: row.notes,
    status: row.status,
    synced: row.synced === 1,
    synced_at: row.synced_at,
  };
}

export async function getAttendanceHistory(userId: string, limit = 30): Promise<Attendance[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<any>(
    `SELECT * FROM attendance WHERE user_id = ? ORDER BY check_in_time DESC LIMIT ?`,
    [userId, limit]
  );
  
  return rows.map((row: any) => ({
    id: row.id,
    user_id: row.user_id,
    project_id: row.project_id,
    check_in_time: row.check_in_time,
    check_in_latitude: row.check_in_latitude,
    check_in_longitude: row.check_in_longitude,
    check_out_time: row.check_out_time,
    check_out_latitude: row.check_out_latitude,
    check_out_longitude: row.check_out_longitude,
    notes: row.notes,
    status: row.status,
    synced: row.synced === 1,
    synced_at: row.synced_at,
  }));
}
