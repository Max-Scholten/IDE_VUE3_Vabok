<script setup>
import { ref, computed, defineExpose, watch } from "vue";

const props = defineProps({
  files: Object,
});

const previewFiles = ref(JSON.parse(JSON.stringify(props.files)));

// Watch for project switch (reference change)
watch(
  () => props.files,
  (newFiles) => {
    previewFiles.value = JSON.parse(JSON.stringify(newFiles));
    previewKey.value++;
  }
);
const previewKey = ref(0);

const getCombinedHTML = (files) => {
  const html = files["index.html"]?.content || "";
  const css = files["style.css"]?.content || "";
  let js = files["script.js"]?.content || "";

  // Convert simple top-level function declarations so they're attached to window.
  // This helps inline handlers like onclick="test()" find the function when
  // the script lands in the iframe's srcdoc context.
  // e.g. `function test(arg) {}` -> `window.test = function test(arg) {}`
  try {
    js = js.replace(
      /(^|\n)\s*function\s+([A-Za-z_$][\w$]*)\s*\(/g,
      (m, p1, name) => {
        return `${p1}window.${name} = function ${name}(`;
      }
    );
  } catch (e) {
    // If something goes wrong, fall back to original js
  }

  return html
    .replace(/<link[^>]*href="style\.css"[^>]*>/gi, `<style>${css}</style>`)
    .replace(
      /<script[^>]*src="script\.js"[^>]*><\/script>/gi,
      `<script>${js}</` + `script>`
    );
};

const combinedHTML = computed(() => getCombinedHTML(previewFiles.value));

const refreshPreview = () => {
  previewFiles.value = JSON.parse(JSON.stringify(props.files));
  previewKey.value++;
};
defineExpose({ refreshPreview });
</script>

<template>
  <div class="preview-panel">
    <div class="preview-header">
      <span>Preview</span>
    </div>

    <div class="preview-content">
      <iframe
        :key="previewKey"
        class="preview-iframe"
        sandbox="allow-scripts allow-modals allow-forms"
        :srcdoc="combinedHTML"
      ></iframe>
    </div>
  </div>
</template>

<style scoped>
.preview-panel {
  background: #1e1e1e;
  display: flex;
  flex-direction: column;
}

.preview-header {
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

.external-btn {
  background: none;
  border: none;
  color: #cccccc;
  cursor: pointer;
  font-size: 12px;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 3px;
}

.external-btn:hover {
  background: #3e3e42;
}

.preview-content {
  flex: 1;
  max-height: calc(38 * 1.5em);
  overflow-y: auto;
  padding: 8px;
}

.preview-iframe {
  width: 100%;
  height: 100%;
  border: 1px solid #3e3e42;
  border-radius: 4px;
  background: white;
}
</style>
