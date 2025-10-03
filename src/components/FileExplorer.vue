<script setup>
import { defineProps, defineEmits } from "vue";
import { FileText, BookText } from "lucide-vue-next";

const props = defineProps({
  files: Object,
  activeFile: String,
});

const emit = defineEmits(["select-file"]);

const selectFile = (filename) => {
  emit("select-file", filename);
};

// Icon color is based only on file type, not active state
const getFileIconColor = (file) => {
  if (file.type === "css") return "#40a9ff"; // blue for css
  if (file.type === "javascript") return "#ffd600"; // yellow for js
  if (file.type === "text") return "#7bd389"; // green for instructions/text
  return "#ffa940"; // default orange
};

// Return the lucide component to use for a file (special icon for instructions)
const getIconComponent = (file, filename) => {
  // If this is the virtual instructions file (type 'text' or named 'instructions'), use BookText
  if (file && (file.type === "text" || filename === "instructions"))
    return BookText;
  return FileText;
};
</script>

<template>
  <div class="file-explorer">
    <div class="explorer-header">
      <span>Files</span>
    </div>

    <div class="file-list">
      <div
        v-for="(file, filename) in files"
        :key="filename"
        :class="['file-item', { active: filename === activeFile }]"
        @click="selectFile(filename)"
      >
        <component
          :is="getIconComponent(file, filename)"
          class="file-icon"
          :color="getFileIconColor(file)"
          :size="20"
        />
        <span class="file-name">{{ filename }}</span>
        <span v-if="file.locked" class="lock-indicator">🔒</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.file-explorer {
  background: #252526;
  border-right: 1px solid #3e3e42;
  display: flex;
  flex-direction: column;
}

.explorer-header {
  height: 35px;
  padding: 0 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #2d2d30;
  border-bottom: 1px solid #3e3e42;
  font-size: 13px;
  font-weight: 600;
  color: #cccccc;
  text-transform: uppercase;
}

.add-file-btn {
  background: none;
  border: none;
  color: #cccccc;
  cursor: pointer;
  font-size: 16px;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 3px;
}

.add-file-btn:hover {
  background: #3e3e42;
}

.file-list {
  flex: 1;
  max-height: calc(38 * 1.5em);
  overflow-y: auto;
}

.file-item {
  padding: 8px 16px;
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-size: 13px;
  border-bottom: 1px solid transparent;
}

.file-item:hover {
  background: #2a2d2e;
}

.file-item.active {
  background: #094771;
  color: #ffffff;
}

.file-icon {
  font-size: 14px;
}

.file-name {
  flex: 1;
}

.lock-indicator {
  font-size: 10px;
  opacity: 0.7;
}
</style>
