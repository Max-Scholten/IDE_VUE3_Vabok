import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import fs from 'fs';
import path from 'path';

const DB_NAME = 'IDE_Vabok.sqlite';
const dbPath = path.resolve(process.cwd(), DB_NAME);

async function main() {
  // if file exists, notify and exit
  if (fs.existsSync(dbPath)) {
    console.log(`${DB_NAME} already exists at ${dbPath}`);
    return;
  }

  // open database
  const db = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });

  try {
    // create some example tables
    await db.exec(`
      PRAGMA foreign_keys = ON;
      CREATE TABLE projects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE files (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER NOT NULL,
        path TEXT NOT NULL,
        content TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
      );
    `);

    console.log(`Created ${DB_NAME} with tables: projects, files`);
  } catch (err) {
    console.error('Error creating database:', err);
  } finally {
    await db.close();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
