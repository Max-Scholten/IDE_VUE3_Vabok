import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

(async () => {
  try {
    const db = await open({ filename: 'IDE_Vabok.sqlite', driver: sqlite3.Database });
    const tables = await db.all("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
    console.log('Tables:', tables.map(t => t.name));

    const projects = await db.all('SELECT * FROM projects');
    console.log('Projects rows:', projects);

    await db.close();
  } catch (err) {
    console.error('Check failed:', err);
    process.exit(1);
  }
})();
