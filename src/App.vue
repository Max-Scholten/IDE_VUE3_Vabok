<script setup>
import { ref, onMounted, computed } from "vue";
import { useRouter, useRoute } from "vue-router";
import { routes as projectRoutesRaw } from "./router/index.js";
import { ref as vueRef } from "vue";
import FileExplorer from "./components/FileExplorer.vue";
import CodeEditor from "./components/CodeEditor.vue";
import PreviewPanel from "./components/PreviewPanel.vue";
import JSZip from "jszip";

const router = useRouter();
const route = useRoute();

// Get all project routes from exported routes (root-level only, no duplicates)
const projectRoutes = computed(() => {
  // Only root-level routes (e.g., /PlayGround)
  const rootRoutes = projectRoutesRaw.filter(
    (r) => r.path && /^\/[A-Za-z0-9_-]+$/.test(r.path) && r.meta
  );
  // Remove duplicates by name
  const seen = new Set();
  return rootRoutes.filter((r) => {
    if (seen.has(r.meta.name)) return false;
    seen.add(r.meta.name);
    return true;
  });
});

onMounted(() => {
  const last = localStorage.getItem("lastSelectedProject");
  if (last) {
    selectedProject.value = last;
    const selectedRoute = projectRoutes.value.find((r) => r.path === last);
    if (selectedRoute && selectedRoute.meta && selectedRoute.meta.name) {
      loadProjectFiles(selectedRoute.meta.name);
    }
  }
  // ...existing code for autosave/reload...
});
// Fetch the public manifest of projects
onMounted(async () => {
  try {
    const res = await fetch("/projects/manifest.json");
    if (res.ok) {
      manifest.value = await res.json();
      // Restore last selected folder/project if present
      const lastFolder = localStorage.getItem("lastSelectedFolder");
      const lastProject = localStorage.getItem("lastSelectedProject");
      if (lastFolder) selectedFolder.value = lastFolder;
      if (lastProject) selectedProject.value = lastProject;
    }
  } catch (e) {
    // ignore manifest errors; fallback to route-based listing if available
    console.warn("Failed to load manifest", e);
  }
});
// --- in <script setup> ---
// We'll load a public manifest from `public/projects/manifest.json` instead of relying
// solely on import-time routes. This lets the app fetch runtime JSON files from
// the `public` folder (served statically).
const manifest = ref([]);

const mainFolders = computed(() => {
  const set = new Set();
  (manifest.value || []).forEach((m) => set.add(m.folder));
  return Array.from(set);
});

const projectsByFolder = computed(() => {
  const map = {};
  (manifest.value || []).forEach((m) => {
    if (!map[m.folder]) map[m.folder] = [];
    map[m.folder].push({
      path: `/projects/json/${m.file}`,
      meta: { folder: m.folder, name: m.name, file: m.file },
    });
  });
  return map;
});

const selectedFolder = ref("");
const selectedProject = ref("");

// When folder changes, reset project
function onFolderSelect() {
  localStorage.setItem("lastSelectedFolder", selectedFolder.value);
  selectedProject.value = "";
}

async function onProjectSelect() {
  if (!selectedProject.value || !selectedFolder.value) return;
  localStorage.setItem("lastSelectedProject", selectedProject.value);
  // selectedProject.value is the path to the json file in /projects/json
  const selected = (projectsByFolder.value[selectedFolder.value] || []).find(
    (p) => p.path === selectedProject.value
  );
  if (selected && selected.meta) {
    await loadProjectFiles(
      selected.meta.folder,
      selected.meta.name,
      selected.meta.file
    );
  }
}

// Remove autosave: Only update in memory
const updateFileContent = (filename, content) => {
  if (files.value[filename]) {
    files.value[filename].content = content;
  }
};

// Preview ref and separated Save / Play actions
const previewPanelRef = vueRef(null);

// Save as zip function
const saveZip = async () => {
  const zip = new JSZip();
  // Only include html, css, js files (and instructions) — skip locked files
  Object.entries(files.value).forEach(([filename, file]) => {
    if (file.locked) return; // skip locked files
    if (filename === "instructions") {
      // add instructions as a plain text file
      zip.file("instructions.txt", file.content);
      return;
    }
    if (["html", "css", "javascript"].includes(file.type)) {
      zip.file(filename, file.content);
    }
  });
  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  // Use project name for zip file, fallback to 'project.zip' if not available
  let projectName = "project";
  if (selectedProject.value) {
    // Try to get the route for the selected project
    let route = null;
    if (selectedFolder.value && projectsByFolder.value[selectedFolder.value]) {
      route = projectsByFolder.value[selectedFolder.value].find(
        (r) => r.path === selectedProject.value
      );
    }
    if (route && route.meta && route.meta.name) {
      projectName = route.meta.name;
    }
  }
  a.download = `${projectName}.zip`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
};

// Play: refresh the preview only (does not auto-save)
const play = () => {
  if (previewPanelRef.value && previewPanelRef.value.refreshPreview) {
    previewPanelRef.value.refreshPreview();
  }
};

const selectFile = (filename) => {
  activeFile.value = filename;
};

// Only one onMounted
onMounted(() => {
  // Load files from localStorage if available
  const savedFiles = localStorage.getItem("webide-files");
  if (savedFiles) {
    const parsedFiles = JSON.parse(savedFiles);
    Object.keys(parsedFiles).forEach((filename) => {
      if (files.value[filename] && !files.value[filename].locked) {
        files.value[filename].content = parsedFiles[filename].content;
      }
    });
  }
});

const files = ref({});

async function loadProjectFiles(folder, projectName) {
  if (!folder || !projectName) return;
  try {
    // If file was provided directly (from manifest entry), prefer that
    const manifestEntry = (manifest.value || []).find(
      (m) => m.folder === folder && m.name === projectName
    );
    const jsonFile = manifestEntry
      ? `/projects/json/${manifestEntry.file}`
      : `/projects/json/${folder}-${projectName}.json`;
    const res = await fetch(jsonFile);
    const data = await res.json();
    files.value = {};

    // If the JSON contains an instructions field, add it as a virtual file first
    if (data.instructions) {
      files.value["instructions"] = {
        content: data.instructions,
        type: "text",
        locked: false,
      };
    }

    // Add real project files (index.html, style.css, script.js, ...)
    for (const [filename, content] of Object.entries(data.files)) {
      let type = "html";
      if (filename.endsWith(".css")) type = "css";
      if (filename.endsWith(".js")) type = "javascript";
      // Exclude .json files from file explorer
      if (!filename.endsWith(".json")) {
        files.value[filename] = { content, type, locked: false };
      }
    }

    // Prefer opening instructions first when present, otherwise index.html
    if (files.value["instructions"]) {
      activeFile.value = "instructions";
    } else if (files.value["index.html"]) {
      activeFile.value = "index.html";
    } else {
      activeFile.value = Object.keys(files.value)[0] || "index.html";
    }
  } catch (e) {
    files.value = {
      "index.html": {
        content: `<h1 style="color:red">Failed to load files for ${projectName}.</h1>`,
        type: "html",
        locked: false,
      },
    };
    activeFile.value = "index.html";
  }
}

const activeFile = ref("index.html");
</script>

<template>
  <div class="ide-container">
    <div
      style="
        padding: 10px;
        background: #252526;
        border-bottom: 1px solid #3e3e42;
      "
    ></div>

    <header class="ide-header">
      <div class="header-left">
        <span class="ide-logo">SUMMA ICT IDE 💻</span>
        <label for="folder-select">Selecteer Cursus:</label>
        <select
          id="folder-select"
          v-model="selectedFolder"
          @change="onFolderSelect"
        >
          <option value="" disabled>Selecteer een Cursus</option>
          <option v-for="folder in mainFolders" :key="folder" :value="folder">
            {{ folder }}
          </option>
        </select>
        <label for="project-select" style="margin-left: 16px"
          >Selecteer Opdracht:</label
        >
        <select
          id="project-select"
          v-model="selectedProject"
          @change="onProjectSelect"
          :disabled="!selectedFolder"
        >
          <option value="" disabled>Selecteer een Opdracht</option>
          <option
            v-for="proj in projectsByFolder[selectedFolder] || []"
            :key="proj.path"
            :value="proj.path"
          >
            {{ proj.meta.name }}
          </option>
        </select>
      </div>
      <div class="header-right">
        <button class="play-btn" @click="play" title="Refresh Preview">
          ▶️ Play
        </button>
        <button class="save-btn" @click="saveZip" title="Download as ZIP">
          💾 Download ZIP
        </button>
      </div>
    </header>

    <div class="ide-content">
      <FileExplorer
        :files="files"
        :activeFile="activeFile"
        @select-file="selectFile"
      />

      <div class="editor-section">
        <div class="editor-tabs">
          <div class="tab active">
            {{ activeFile }}
            <span v-if="files[activeFile]?.locked" class="lock-icon">🔒</span>
          </div>
        </div>
        <CodeEditor
          :key="activeFile"
          :content="files[activeFile]?.content || ''"
          :language="files[activeFile]?.type || 'html'"
          @update:content="(content) => updateFileContent(activeFile, content)"
        />
      </div>
      <PreviewPanel :files="files" ref="previewPanelRef" />
    </div>
  </div>
</template>

<style scoped>
.play-btn {
  background: #007acc;
  color: #fff;
  border: none;
  border-radius: 4px;
  padding: 4px 12px;
  margin-left: 12px;
  font-size: 14px;
  cursor: pointer;
  transition: background 0.2s;
}

.play-btn:hover {
  background: #005fa3;
}

.ide-container {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: #1e1e1e;
  color: #cccccc;
}

.ide-header {
  height: 35px;
  background: #2d2d30;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  border-bottom: 1px solid #3e3e42;
}

.ide-logo {
  font-weight: 600;
  color: #007acc;
}

.header-right {
  display: flex;
  gap: 20px;
}

.header-status {
  font-size: 12px;
  color: #cccccc;
}

.ide-content {
  flex: 1;
  display: grid;
  grid-template-columns: 250px 1fr 1fr;
  overflow: hidden;
}

.editor-section {
  display: flex;
  flex-direction: column;
  border-right: 1px solid #3e3e42;
}

.editor-tabs {
  height: 35px;
  background: #252526;
  display: flex;
  align-items: center;
  border-bottom: 1px solid #3e3e42;
}

.tab {
  padding: 0 16px;
  height: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  background: #1e1e1e;
  border-right: 1px solid #3e3e42;
  font-size: 13px;
  cursor: pointer;
}

.tab.active {
  background: #1e1e1e;
  color: #ffffff;
}

.lock-icon {
  font-size: 12px;
  opacity: 0.7;
}

.save-btn {
  background: #00b894;
  color: #fff;
  border: none;
  border-radius: 4px;
  padding: 4px 12px;
  margin-left: 12px;
  font-size: 14px;
  cursor: pointer;
  transition: background 0.2s;
}

.save-btn:hover {
  background: #008463;
}
</style>
