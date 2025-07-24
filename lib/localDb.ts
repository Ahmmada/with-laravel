// lib/localDb.ts (النسخة المعدلة)
import * as SQLite from 'expo-sqlite';

let db: SQLite.SQLiteDatabase | null = null;

export const initDb = async () => {
  if (db) return;
  db = await SQLite.openDatabaseAsync('appl.db');
  await db.execAsync('PRAGMA foreign_keys = ON;');

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS levels (
      id INTEGER PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      supabase_id INTEGER UNIQUE,
      is_synced INTEGER DEFAULT 0,
      operation_type TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT,
      deleted_at TEXT
    );
  `);

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS sync_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity TEXT NOT NULL,
      entity_local_id INTEGER,
      entity_supabase_id INTEGER,
      operation TEXT NOT NULL,
      payload TEXT,
      timestamp INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
    );
  `);
};

const getDb = (): SQLite.SQLiteDatabase => {
  if (!db) {
    throw new Error(
      'Database not initialized. Make sure initDb() is called and awaited before any DB operation.'
    );
  }
  return db;
};

export const getLocalLevels = async (): Promise<Level[]> => {
  const db = getDb();
  const result = await db.getAllAsync('SELECT * FROM levels ORDER BY id ASC;');
  return result as Level[];
};

export const insertLocalLevel = async (level: {
  name: string;
  supabase_id?: number;
}): Promise<number> => {
  const db = getDb();

  // ✅ التحقق من تكرار الاسم
  const existing = await db.getFirstAsync('SELECT * FROM levels WHERE name = ?', [level.name]);
  if (existing) {
    throw new Error('اسم المستوى موجود بالفعل');
  }

  const result = await db.runAsync(
    `INSERT INTO levels (name, supabase_id, is_synced, operation_type, created_at) 
     VALUES (?, ?, ?, ?, ?);`,
    [
      level.name,
      level.supabase_id,
      level.supabase_id ? 1 : 0,
      level.supabase_id ? null : 'INSERT',
      new Date().toISOString()
    ]
  );

  const insertId = result.lastInsertRowId as number;

  if (!level.supabase_id) {
    await db.runAsync(
      'INSERT INTO sync_queue (entity, entity_local_id, operation, payload) VALUES (?, ?, ?, ?);',
      ['levels', insertId, 'INSERT', JSON.stringify({ 
        name: level.name,
        created_at: new Date().toISOString()
      })]
    );
  }

  return insertId;
};

export const updateLocalLevel = async (id: number, name: string): Promise<void> => {
  const db = getDb();

  // ✅ التحقق من تكرار الاسم (ما عدا السجل الحالي)
  const existing = await db.getFirstAsync(
    'SELECT * FROM levels WHERE name = ? AND id != ?', 
    [name, id]
  );
  if (existing) {
    throw new Error('اسم المستوى موجود بالفعل');
  }

  await db.runAsync(
    'UPDATE levels SET name = ?, is_synced = 0, operation_type = "UPDATE", updated_at = ? WHERE id = ?;',
    [name, new Date().toISOString(), id]
  );

  await db.runAsync(
    `INSERT OR REPLACE INTO sync_queue
     (entity, entity_local_id, entity_supabase_id, operation, payload)
     VALUES (?, ?, (SELECT supabase_id FROM levels WHERE id = ?), ?, ?);`,
    ['levels', id, id, 'UPDATE', JSON.stringify({ 
      name,
      updated_at: new Date().toISOString()
    })]
  );
};

export const deleteLocalLevel = async (id: number): Promise<void> => {
  const db = getDb();

  const level = await db.getFirstAsync('SELECT supabase_id FROM levels WHERE id = ?;', [id]);
  const supabaseId = level?.supabase_id as number | undefined;

  // ✅ Soft delete مع تسجيل الوقت
  await db.runAsync(
    'UPDATE levels SET deleted_at = ?, is_synced = 0, operation_type = "DELETE" WHERE id = ?;',
    [new Date().toISOString(), id]
  );

  await db.runAsync(
    'INSERT INTO sync_queue (entity, entity_local_id, entity_supabase_id, operation, payload) VALUES (?, ?, ?, ?, ?);',
    ['levels', id, supabaseId ?? null, 'DELETE', JSON.stringify({ 
      deleted_at: new Date().toISOString()
    })]
  );
};

export const getUnsyncedChanges = async (): Promise<any[]> => {
  const db = getDb();
  const result = await db.getAllAsync('SELECT * FROM sync_queue ORDER BY timestamp ASC;');
  return result;
};

export const clearSyncedChange = async (id: number): Promise<void> => {
  const db = getDb();
  await db.runAsync('DELETE FROM sync_queue WHERE id = ?;', [id]);
};

export const updateLocalLevelSupabaseId = async (
  localId: number,
  supabaseId: number
): Promise<void> => {
  const db = getDb();
  await db.runAsync(
    'UPDATE levels SET supabase_id = ?, is_synced = 1 WHERE id = ?;',
    [supabaseId, localId]
  );
};

export type Level = {
  id: number;
  name: string;
  supabase_id?: number;
  is_synced?: number;
  operation_type?: string | null;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string;
};