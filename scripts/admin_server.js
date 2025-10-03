import express from 'express';
import fs from 'fs/promises';
import path from 'path';

const app = express();
const port = process.env.PORT || 5174;

app.use(express.json({ limit: '1mb' }));
app.use('/admin', express.static(path.join(process.cwd(), 'public', 'admin')));

const PROJECTS_DIR = path.join(process.cwd(), 'public', 'projects');
const JSON_DIR = path.join(PROJECTS_DIR, 'json');
const MANIFEST = path.join(PROJECTS_DIR, 'manifest.json');

app.post('/admin/api/create-project', async (req, res) => {
  try {
    const { folder, name, file, content } = req.body;
    if (!file || !content) return res.status(400).json({ error: 'file and content are required' });

    // ensure directories
    await fs.mkdir(JSON_DIR, { recursive: true });

    // write json file
    const targetPath = path.join(JSON_DIR, file);
    await fs.writeFile(targetPath, content, 'utf8');

    // update manifest
    let manifest = [];
    try {
      const raw = await fs.readFile(MANIFEST, 'utf8');
      manifest = JSON.parse(raw);
    } catch (e) {
      manifest = [];
    }

    // add entry if not exists
    const exists = manifest.find(m => m.file === file);
    if (!exists) {
      manifest.push({ folder: folder || 'sandbox', name: name || file.replace(/\.json$/,'') , file });
      await fs.writeFile(MANIFEST, JSON.stringify(manifest, null, 2), 'utf8');
    }

    res.json({ message: `Created ${file}` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(port, () => {
  console.log(`Admin server listening at http://localhost:${port}/admin/dashboard.html`);
});

// Compatibility endpoints for the client from your other app
app.get('/api/folders', async (req, res) => {
  try {
    // read manifest and return unique folder names
    let manifest = [];
    try {
      const raw = await fs.readFile(MANIFEST, 'utf8');
      manifest = JSON.parse(raw);
    } catch (e) {
      manifest = [];
    }
    const folders = Array.from(new Set(manifest.map(m => m.folder).filter(Boolean)));
    res.json({ folders });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/save', async (req, res) => {
  try {
    const { folder, project, fileName, payload } = req.body;
    if (!fileName || !payload) return res.status(400).json({ error: 'fileName and payload are required' });

    await fs.mkdir(JSON_DIR, { recursive: true });
    const targetPath = path.join(JSON_DIR, fileName);
    await fs.writeFile(targetPath, JSON.stringify(payload, null, 2), 'utf8');

    // update manifest if needed
    let manifest = [];
    try {
      const raw = await fs.readFile(MANIFEST, 'utf8');
      manifest = JSON.parse(raw);
    } catch (e) {
      manifest = [];
    }
    const exists = manifest.find(m => m.file === fileName);
    if (!exists) {
      manifest.push({ folder: folder || 'sandbox', name: project || fileName.replace(/\.json$/,'') , file: fileName });
      await fs.writeFile(MANIFEST, JSON.stringify(manifest, null, 2), 'utf8');
    }

    res.json({ path: path.relative(process.cwd(), targetPath) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// list projects (merge manifest and actual json files)
app.get('/api/projects', async (req, res) => {
  try {
    let manifest = [];
    try { manifest = JSON.parse(await fs.readFile(MANIFEST, 'utf8')); } catch(e){ manifest = []; }

    // list json files
    let files = [];
    try {
      const dirents = await fs.readdir(JSON_DIR, { withFileTypes: true });
      files = dirents.filter(d=>d.isFile()).map(d=>d.name);
    } catch(e) { files = []; }

    // combine: ensure each manifest entry has a file; if a file exists but not in manifest, add a minimal entry
    const projects = manifest.slice();
    files.forEach(f => {
      if (!projects.find(p => p.file === f)) {
        projects.push({ folder: 'sandbox', name: f.replace(/\.json$/,''), file: f });
      }
    });

    res.json({ projects });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// delete a project file and remove manifest entry
app.post('/api/delete', async (req, res) => {
  try {
    const { file } = req.body;
    if (!file) return res.status(400).json({ error: 'file is required' });

    const targetPath = path.join(JSON_DIR, file);
    // remove file if exists
    try { await fs.unlink(targetPath); } catch(e) { /* ignore */ }

    // update manifest
    try {
      let manifest = JSON.parse(await fs.readFile(MANIFEST, 'utf8'));
      manifest = manifest.filter(m => m.file !== file);
      await fs.writeFile(MANIFEST, JSON.stringify(manifest, null, 2), 'utf8');
    } catch(e) {
      // if manifest missing or parse error, ignore
    }

    res.json({ message: `Deleted ${file}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
