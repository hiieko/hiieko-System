/**
 * SQLite Database Service for HIIEKO Mobile
 * 
 * Local persistence layer for offline-first operation.
 * Stores user data, projects, tasks, attendance, reports, and sync queue.
 */

import * as SQLite from 'expo-sqlite';

const DB_NAME = 'hiieko_mobile.db';
const DB_VERSION = 1;

let db: SQLite.SQLiteDatabase | null = null;

/**
 * Initialize and return the SQLite database
 */
export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (db) return db;
  
  db = await SQLite.openDatabaseAsync(DB_NAME);
  await initializeTables(db);
  return db;
}

/**
 * Create all required tables
 */
async function initializeTables(database: SQLite.SQLiteDatabase): Promise<void> {
  // User table
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS user (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      full_name TEXT,
      role TEXT,
      organization_id TEXT,
      token TEXT,
      synced_at TEXT
    );
  `);

  // Projects table
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      code TEXT NOT NULL,
      address TEXT,
      latitude REAL,
      longitude REAL,
      geofence_radius_meters INTEGER,
      is_active INTEGER DEFAULT 1,
      synced_at TEXT
    );
  `);

  // Tasks table
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      project_id TEXT,
      title TEXT NOT NULL,
      description TEXT,
      assigned_to TEXT,
      status TEXT,
      due_date TEXT,
      synced_at TEXT,
      FOREIGN KEY (project_id) REFERENCES projects(id)
    );
  `);

  // Attendance (Time Logs) table
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS attendance (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      project_id TEXT NOT NULL,
      check_in_time TEXT NOT NULL,
      check_in_latitude REAL,
      check_in_longitude REAL,
      check_out_time TEXT,
      check_out_latitude REAL,
      check_out_longitude REAL,
      notes TEXT,
      status TEXT DEFAULT 'active',
      synced INTEGER DEFAULT 0,
      synced_at TEXT,
      FOREIGN KEY (project_id) REFERENCES projects(id)
    );
  `);

  // Daily Reports table
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS daily_reports (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      report_date TEXT NOT NULL,
      weather TEXT,
      workers_present INTEGER,
      work_description TEXT,
      issues TEXT,
      photos TEXT,
      synced INTEGER DEFAULT 0,
      synced_at TEXT,
      FOREIGN KEY (project_id) REFERENCES projects(id)
    );
  `);

  // Material Consumption table
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS material_consumption (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      material_id TEXT NOT NULL,
      material_name TEXT,
      quantity REAL NOT NULL,
      unit TEXT,
      consumed_at TEXT NOT NULL,
      reported_by TEXT,
      synced INTEGER DEFAULT 0,
      synced_at TEXT,
      FOREIGN KEY (project_id) REFERENCES projects(id)
    );
  `);

  // Issues table
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS issues (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      severity TEXT,
      status TEXT DEFAULT 'open',
      reported_by TEXT,
      reported_at TEXT NOT NULL,
      photos TEXT,
      synced INTEGER DEFAULT 0,
      synced_at TEXT,
      FOREIGN KEY (project_id) REFERENCES projects(id)
    );
  `);

  // Pending file uploads table
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS pending_uploads (
      id TEXT PRIMARY KEY,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      file_uri TEXT NOT NULL,
      file_type TEXT,
      uploaded INTEGER DEFAULT 0,
      uploaded_at TEXT,
      created_at TEXT NOT NULL
    );
  `);

  // Sync Queue table
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS sync_queue (
      id TEXT PRIMARY KEY,
      operation_id TEXT UNIQUE NOT NULL,
      entity TEXT NOT NULL,
      operation_type TEXT NOT NULL,
      payload TEXT NOT NULL,
      idempotency_key TEXT UNIQUE NOT NULL,
      created_at TEXT NOT NULL,
      retry_count INTEGER DEFAULT 0,
      status TEXT DEFAULT 'pending',
      error TEXT,
      synced_at TEXT
    );
  `);

  // Materials catalog table
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS materials (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL,
      name TEXT NOT NULL,
      unit TEXT NOT NULL,
      is_active INTEGER DEFAULT 1,
      synced_at TEXT
    );
  `);

  // Create indices for common queries
  await database.execAsync(`
    CREATE INDEX IF NOT EXISTS idx_attendance_user ON attendance(user_id);
    CREATE INDEX IF NOT EXISTS idx_attendance_project ON attendance(project_id);
    CREATE INDEX IF NOT EXISTS idx_attendance_synced ON attendance(synced);
    CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON sync_queue(status);
    CREATE INDEX IF NOT EXISTS idx_sync_queue_created ON sync_queue(created_at);
    CREATE INDEX IF NOT EXISTS idx_daily_reports_synced ON daily_reports(synced);
    CREATE INDEX IF NOT EXISTS idx_issues_synced ON issues(synced);
  `);

  console.log('✅ SQLite database initialized');
}

/**
 * Clear all local data (for logout or reset)
 */
export async function clearDatabase(): Promise<void> {
  const database = await getDatabase();
  
  await database.execAsync(`
    DELETE FROM user;
    DELETE FROM projects;
    DELETE FROM tasks;
    DELETE FROM attendance;
    DELETE FROM daily_reports;
    DELETE FROM material_consumption;
    DELETE FROM issues;
    DELETE FROM pending_uploads;
    DELETE FROM sync_queue;
    DELETE FROM materials;
  `);
  
  console.log('✅ Database cleared');
}

/**
 * Get database statistics
 */
export async function getDatabaseStats(): Promise<{
  projects: number;
  attendance: number;
  dailyReports: number;
  issues: number;
  pendingSync: number;
  pendingUploads: number;
}> {
  const database = await getDatabase();
  
  const projectsCount = await database.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM projects'
  );
  const attendanceCount = await database.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM attendance'
  );
  const reportsCount = await database.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM daily_reports'
  );
  const issuesCount = await database.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM issues'
  );
  const syncQueueCount = await database.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM sync_queue WHERE status = "pending"'
  );
  const uploadsCount = await database.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM pending_uploads WHERE uploaded = 0'
  );

  return {
    projects: projectsCount?.count || 0,
    attendance: attendanceCount?.count || 0,
    dailyReports: reportsCount?.count || 0,
    issues: issuesCount?.count || 0,
    pendingSync: syncQueueCount?.count || 0,
    pendingUploads: uploadsCount?.count || 0,
  };
}

