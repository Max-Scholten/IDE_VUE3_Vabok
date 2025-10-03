<script setup>
import { ref, onMounted, watch, defineProps, defineEmits } from "vue";
import Format from "./Format.vue";
import CodeSuggestions from "./CodeSuggestions.vue";
import { EditorView } from "@codemirror/view";
import { EditorState, EditorSelection } from "@codemirror/state";
import { oneDark } from "@codemirror/theme-one-dark";
import { html } from "@codemirror/lang-html";
import { css } from "@codemirror/lang-css";
import { javascript } from "@codemirror/lang-javascript";
import { autocompletion, completionKeymap } from "@codemirror/autocomplete";
import { keymap } from "@codemirror/view";
import { defaultKeymap, indentWithTab } from "@codemirror/commands";
import { lineNumbers } from "@codemirror/view";

const props = defineProps({
  content: String,
  language: String,
  fileName: String,
});

const emit = defineEmits(["update:content"]);

const editorRef = ref(null);
let editorView = null;
const suggestionsRef = ref(null);

function handleFormat(formatted) {
  emit("update:content", formatted);
  if (editorView) {
    editorView.dispatch({
      changes: {
        from: 0,
        to: editorView.state.doc.length,
        insert: formatted,
      },
    });
  }
}

const getLanguageSupport = (lang) => {
  switch (lang) {
    case "html":
      return html();
    case "css":
      return css();
    case "javascript":
      return javascript();
    default:
      return html();
  }
};
// We'll delegate code suggestion generators to the CodeSuggestions helper component
// We'll delegate code suggestion generators to the CodeSuggestions helper component

onMounted(() => {
  if (editorRef.value) {
    const state = EditorState.create({
      doc: props.content,
      extensions: [
        lineNumbers(),
        getLanguageSupport(props.language),
        oneDark,
        autocompletion({
          override: suggestionsRef.value
            ? suggestionsRef.value.getOverrides(props.language)
            : [],
        }),
        keymap && keymap.of
          ? keymap.of([indentWithTab, ...completionKeymap, ...defaultKeymap])
          : [],
        EditorView.updateListener && EditorView.updateListener.of
          ? EditorView.updateListener.of((update) => {
              if (update.docChanged) {
                emit("update:content", update.state.doc.toString());
              }
            })
          : [],
        EditorView.theme({
          "&": {
            height: "100%",
          },
          ".cm-scroller": {
            fontFamily: 'Consolas, Monaco, "Courier New", monospace',
            fontSize: "14px",
            lineHeight: "1.5",
          },
        }),
      ],
    });

    editorView = new EditorView({
      state,
      parent: editorRef.value,
    });
  }

  // Try to fetch the site's index.html and extract top-level function names so we can
  // Suggestions component will populate indexHtmlFunctions on mount; no-op here.
});

watch(
  () => props.content,
  (newContent) => {
    if (editorView && editorView.state.doc.toString() !== newContent) {
      editorView.dispatch({
        changes: {
          from: 0,
          to: editorView.state.doc.length,
          insert: newContent,
        },
      });
    }
  }
);

watch(
  () => props.language,
  (newLanguage) => {
    if (editorView) {
      editorView.dispatch({
        effects:
          EditorState.reconfigure && EditorState.reconfigure.of
            ? EditorState.reconfigure.of([
                lineNumbers(),
                getLanguageSupport(newLanguage),
                oneDark,
                autocompletion({
                  override: suggestionsRef.value
                    ? suggestionsRef.value.getOverrides(newLanguage)
                    : [],
                }),
                keymap && keymap.of
                  ? keymap.of([
                      indentWithTab,
                      ...completionKeymap,
                      ...defaultKeymap,
                    ])
                  : [],
                EditorView.updateListener && EditorView.updateListener.of
                  ? EditorView.updateListener.of((update) => {
                      if (update.docChanged) {
                        emit("update:content", update.state.doc.toString());
                      }
                    })
                  : [],
                EditorView.theme({
                  "&": {
                    height: "100%",
                  },
                  ".cm-scroller": {
                    fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                    fontSize: "14px",
                    lineHeight: "1.5",
                  },
                }),
              ])
            : [],
      });
    }
  }
);
</script>

<template>
  <div class="editor-header">
    <Format
      :code="props.content"
      :language="props.language"
      :fileName="props.fileName"
      @format="handleFormat"
    />
  </div>
  <div ref="editorRef" class="code-editor"></div>
  <CodeSuggestions ref="suggestionsRef" />
</template>

<style scoped>
.editor-header {
  width: 100%;
  background: #23272e;
  border-bottom: 1px solid #333;
}

.code-editor {
  flex: 1;
  max-width: 834px;
  box-sizing: border-box;
  max-height: calc(38 * 1.5em); /* 38 lines * line-height (1.5em) */
  overflow-y: auto;
  overflow-x: auto; /* show horizontal scrollbar when content overflows */
}

:deep(.cm-editor) {
  height: 100%;
}

/* Ensure CodeMirror's scroller allows horizontal scrolling and preserves long lines */
:deep(.cm-scroller) {
  overflow-x: auto !important;
  white-space: pre; /* keep long lines on single line so horizontal scroll appears */
}

:deep(.cm-focused) {
  outline: none;
}
</style>
