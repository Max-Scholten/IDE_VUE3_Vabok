<script setup>
import { ref, onMounted, defineExpose } from "vue";
import { EditorSelection } from "@codemirror/state";

// We'll keep an internal list of top-level functions detected from /index.html
const indexHtmlFunctions = ref([]);

const createHTMLCompletions = () => {
  return (context) => {
    let word = context.matchBefore(/\w*/);
    const pos = context.pos;
    const wordFrom = word ? word.from : pos;
    const wordText = word ? word.text : "";

    const lookbackStart = Math.max(0, wordFrom - 200);
    const before = context.state.doc.sliceString(lookbackStart, word.from);
    const lastOpen = before.lastIndexOf("<");
    const lastClose = before.lastIndexOf(">");
    const insideTag = lastOpen > lastClose;

    const htmlTags = [
      "div",
      "span",
      "p",
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "a",
      "img",
      "button",
      "input",
      "form",
      "label",
      "textarea",
      "ul",
      "ol",
      "li",
      "table",
      "tr",
      "td",
      "th",
      "thead",
      "tbody",
      "header",
      "main",
      "section",
      "article",
      "aside",
      "footer",
      "nav",
      "br",
      "hr",
      "meta",
      "link",
      "script",
      "style",
    ];

    const htmlAttrs = [
      "id",
      "class",
      "style",
      "src",
      "alt",
      "href",
      "type",
      "name",
      "value",
      "placeholder",
      "disabled",
      "readonly",
      "required",
      "checked",
      "for",
      "onclick",
      "onchange",
      "oninput",
      "onfocus",
      "onblur",
    ];

    if (insideTag) {
      const tagNamePart = before.slice(lastOpen + 1);
      // Special case: user typed '<!' — offer DOCTYPE/html skeleton insertion
      if (tagNamePart.startsWith("!")) {
        const skeleton = `<!DOCTYPE html>\n<html lang="nl">\n<head>\n    <meta charset="UTF-8">\n    <meta name="viewport" content="width=device-width, initial-scale=1.0">\n    <title>Document</title>\n</head>\n<body>\n\n</body>\n</html>`;
        return {
          from: word ? word.from : pos,
          options: [
            {
              label: "<!DOCTYPE html>",
              type: "keyword",
              detail: "Insert HTML5 skeleton",
              apply(view, completion, from, to) {
                // Replace entire document with the skeleton and place caret inside <body>
                const docLen = view.state.doc.length;
                const bodyOpen = skeleton.indexOf("<body>");
                const caret = bodyOpen + "<body>\n".length;
                view.dispatch({
                  changes: { from: 0, to: docLen, insert: skeleton },
                  selection: EditorSelection.single(caret),
                });
                view.focus();
              },
            },
          ],
        };
      }
      const inTagName =
        !/\s/.test(tagNamePart) &&
        !tagNamePart.startsWith("!") &&
        !tagNamePart.startsWith("/");

      if (inTagName) {
        const openPos = lookbackStart + lastOpen;
        const tagNameStart = openPos + 1;
        return {
          from: word ? word.from : tagNameStart,
          options: htmlTags.map((tag) => ({
            label: tag,
            type: "keyword",
            detail: "HTML tag",
            apply(view, completion, from, to) {
              const replaceFrom = tagNameStart;
              const replaceTo = Math.max(to, replaceFrom);
              const hasOpenChar =
                context.state.doc.sliceString(openPos, openPos + 1) === "<";
              const insert = (hasOpenChar ? "" : "<") + `${tag}></${tag}>`;
              const caret =
                replaceFrom + (hasOpenChar ? tag.length + 1 : tag.length + 2);
              view.dispatch({
                changes: { from: replaceFrom, to: replaceTo, insert },
                selection: EditorSelection.single(caret),
              });
              view.focus();
            },
          })),
        };
      }

      try {
        const openPos = lookbackStart + lastOpen;
        const tagTextToCursor = context.state.doc.sliceString(openPos, pos);
        const attrValueMatch = tagTextToCursor.match(
          /([A-Za-z0-9_\-]+)\s*=\s*"([^"]*)$/
        );
        if (attrValueMatch) {
          const attrName = attrValueMatch[1];
          const partialValue = attrValueMatch[2];
          if (/^on[A-Za-z]+/.test(attrName)) {
            const docText = context.state.doc.toString();
            const localFuncs = Array.from(
              new Set(
                (
                  docText.match(/function\s+([A-Za-z_$][\\w$]*)\s*\(/g) || []
                ).map((m) => m.replace(/function\s+|\(|/g, ""))
              )
            );
            const externalFuncs = indexHtmlFunctions.value || [];
            const windowFuncs = ["alert", "confirm", "prompt", "console.log"];
            const funcs = Array.from(
              new Set([...windowFuncs, ...localFuncs, ...externalFuncs])
            );
            const valueFrom = pos - partialValue.length;
            return {
              from: valueFrom,
              options: funcs
                .map((f) => ({
                  label: f,
                  type: "function",
                  detail: windowFuncs.includes(f)
                    ? "global/window function"
                    : "detected function",
                  apply(view, completion, from, to) {
                    if (f === "alert" || f === "confirm" || f === "prompt") {
                      const insert = `${f}(\"\");`;
                      const caret = valueFrom + f.length + 2;
                      view.dispatch({
                        changes: {
                          from: valueFrom,
                          to: valueFrom + partialValue.length,
                          insert,
                        },
                        selection: EditorSelection.single(caret),
                      });
                      view.focus();
                    } else if (f === "console.log") {
                      const insert = `console.log(\"\");`;
                      const caret = valueFrom + "console.log".length + 2;
                      view.dispatch({
                        changes: {
                          from: valueFrom,
                          to: valueFrom + partialValue.length,
                          insert,
                        },
                        selection: EditorSelection.single(caret),
                      });
                      view.focus();
                    } else {
                      const insert = `${f}()`;
                      const caret = valueFrom + f.length + 2;
                      view.dispatch({
                        changes: {
                          from: valueFrom,
                          to: valueFrom + partialValue.length,
                          insert,
                        },
                        selection: EditorSelection.single(caret),
                      });
                      view.focus();
                    }
                  },
                }))
                .filter((o) => o.label.startsWith(partialValue)),
            };
          }
        }
      } catch (e) {
        // ignore parse errors
      }

      return {
        from: word ? word.from : pos,
        options: htmlAttrs.map((attr) => {
          if (/^on[A-Za-z]+/.test(attr)) {
            return {
              label: attr,
              type: "property",
              detail: "HTML event attribute",
              apply(view, completion, from, to) {
                const placeholder = "myFunction";
                const insert = `${attr}="${placeholder}()"`;
                const nameStart = from + attr.length + 2;
                const nameEnd = nameStart + placeholder.length;
                view.dispatch({
                  changes: { from, to, insert },
                  selection: EditorSelection.range(nameStart, nameEnd),
                });
                view.focus();
              },
            };
          }
          return {
            label: attr,
            type: "property",
            apply: `${attr}=""`,
            detail: "HTML attribute",
          };
        }),
      };
    }

    return {
      from: word.from,
      options: htmlTags.map((tag) => ({
        label: tag,
        type: "keyword",
        apply: `<${tag}>`,
        detail: "HTML tag",
      })),
    };
  };
};

const createCSSCompletions = () => {
  return (context) => {
    let word = context.matchBefore(/[#\$\-\w]*/);
    if (word === null || (word.from == word.to && !context.explicit))
      return null;

    const cssProps = [
      "color",
      "background",
      "background-color",
      "margin",
      "margin-top",
      "margin-bottom",
      "padding",
      "padding-left",
      "padding-right",
      "display",
      "position",
      "top",
      "left",
      "right",
      "bottom",
      "width",
      "height",
      "max-width",
      "min-width",
      "font-size",
      "font-weight",
      "line-height",
      "border",
      "border-radius",
      "box-shadow",
      "text-align",
      "flex",
      "flex-direction",
      "justify-content",
      "align-items",
    ];

    const selectors = [
      "h1",
      "h2",
      "h3",
      "p",
      "div",
      "span",
      "a",
      "ul",
      "ol",
      "li",
      "header",
      "main",
      "section",
      "article",
      ".my-class",
      "#my-id",
    ];

    const propOptions = cssProps.map((p) => ({
      label: p,
      type: "property",
      apply: `${p}: `,
      detail: "CSS property",
    }));

    const lookbackStart = Math.max(0, word.from - 300);
    const before = context.state.doc.sliceString(lookbackStart, word.from);
    const propMatch = before.match(/([\-\w]+)\s*:\s*([#\$\w\-]*)$/);
    if (propMatch) {
      const propName = propMatch[1];
      const partial = propMatch[2] || "";
      if (propName === "color" || propName.endsWith("-color")) {
        const cssColorNames = [
          "black",
          "white",
          "red",
          "green",
          "blue",
          "yellow",
          "orange",
          "purple",
          "pink",
          "cyan",
          "magenta",
          "teal",
          "navy",
          "maroon",
          "olive",
          "lime",
          "silver",
          "gray",
          "brown",
        ];
        const hexExamples = [
          "#000000",
          "#ffffff",
          "#ff0000",
          "#00ff00",
          "#0000ff",
        ];
        const fullDoc = context.state.doc.toString();
        const varMatches = Array.from(
          new Set(fullDoc.match(/\$[A-Za-z0-9_\-]+/g) || [])
        );
        const colorOptions = [];
        cssColorNames.forEach((name) =>
          colorOptions.push({
            label: name,
            type: "constant",
            apply: name + "; ",
            detail: "color name",
          })
        );
        hexExamples.forEach((h) =>
          colorOptions.push({
            label: h,
            type: "constant",
            apply: h + "; ",
            detail: "hex color",
          })
        );
        varMatches.forEach((v) =>
          colorOptions.push({
            label: v,
            type: "variable",
            apply: v + "; ",
            detail: "variable",
          })
        );
        const valueFrom = word.from - partial.length;
        return {
          from: valueFrom,
          options: colorOptions.filter((opt) => opt.label.startsWith(partial)),
        };
      }
    }

    const sizeProps = [
      "width",
      "height",
      "max-width",
      "min-width",
      "max-height",
      "min-height",
      "margin",
      "margin-top",
      "margin-bottom",
      "margin-left",
      "margin-right",
      "padding",
      "padding-left",
      "padding-right",
      "padding-top",
      "padding-bottom",
      "font-size",
      "line-height",
      "top",
      "left",
      "right",
      "bottom",
    ];
    if (propMatch) {
      const propName = propMatch[1];
      const partial = propMatch[2] || "";
      if (sizeProps.includes(propName)) {
        const units = ["px", "em", "rem", "%", "vh", "vw"];
        const numberMatch = partial.match(/^\d*\.?\d*$/);
        const valueFrom = word.from - partial.length;
        let options = [];
        if (numberMatch) {
          if (partial === "") {
            options = ["0px", "1px", "8px", "16px", "100%"].map((v) => ({
              label: v,
              type: "constant",
              apply: v + "; ",
              detail: "size",
            }));
          } else {
            options = units.map((u) => ({
              label: partial + u,
              type: "constant",
              apply: partial + u + "; ",
              detail: "unit",
            }));
          }
        } else {
          options = units
            .filter((u) => u.startsWith(partial))
            .map((u) => ({
              label: u,
              type: "constant",
              apply: u + "; ",
              detail: "unit",
            }));
        }
        return { from: valueFrom, options };
      }
    }

    const selectorOptions = selectors.map((sel) => ({
      label: sel,
      type: "keyword",
      detail: "CSS selector",
      apply(view, completion, from, to) {
        const insert = `${sel} {\n  \n}`;
        const caret = from + sel.length + 5;
        view.dispatch({
          changes: { from, to, insert },
          selection: EditorSelection.single(caret),
        });
        view.focus();
      },
    }));

    return { from: word.from, options: [...selectorOptions, ...propOptions] };
  };
};

const createJSCompletions = () => {
  return (context) => {
    let word = context.matchBefore(/\w*/);
    if (word === null || (word.from == word.to && !context.explicit))
      return null;

    const jsItems = [
      "console.log",
      "document.querySelector",
      "document.getElementById",
      "window.addEventListener",
      "setTimeout",
      "setInterval",
      "clearTimeout",
      "clearInterval",
      "JSON.parse",
      "JSON.stringify",
      "fetch",
      "Promise",
      "async",
      "await",
      "function",
      "const",
      "let",
      "var",
    ];
    const docText = context.state.doc.toString();
    const localFuncs = Array.from(
      new Set(
        (docText.match(/function\s+([A-Za-z_$][\\w$]*)\s*\(/g) || []).map((m) =>
          m.replace(/function\s+|\(|/g, "")
        )
      )
    );
    const externalFuncs = indexHtmlFunctions.value || [];
    const windowFuncs = ["alert", "confirm", "prompt", "console.log"];
    const funcOptions = Array.from(
      new Set([...windowFuncs, ...localFuncs, ...externalFuncs])
    ).map((f) => ({
      label: f,
      type: "function",
      detail: windowFuncs.includes(f)
        ? "global/window function"
        : "detected function",
      apply(view, completion, from, to) {
        const before = context.state.doc.sliceString(
          Math.max(0, from - 10),
          from
        );
        const functionPrefix = /function\s+$/.test(before);
        if (functionPrefix) {
          const insert = `${f}() {\n  \n}`;
          view.dispatch({
            changes: { from, to, insert },
            selection: EditorSelection.single(from + f.length + 3),
          });
          view.focus();
        } else {
          if (f === "alert" || f === "confirm" || f === "prompt") {
            const insert = `${f}(\"\");`;
            const caret = from + f.length + 2;
            view.dispatch({
              changes: { from, to, insert },
              selection: EditorSelection.single(caret),
            });
            view.focus();
          } else if (f === "console.log") {
            const insert = `console.log(\"\");`;
            const caret = from + "console.log".length + 2;
            view.dispatch({
              changes: { from, to, insert },
              selection: EditorSelection.single(caret),
            });
            view.focus();
          } else {
            const insert = `${f}()`;
            view.dispatch({
              changes: { from, to, insert },
              selection: EditorSelection.single(from + f.length + 2),
            });
            view.focus();
          }
        }
      },
    }));

    const keywordOptions = jsItems.map((j) => {
      if (j === "function") {
        return {
          label: j,
          type: "keyword",
          detail: "JavaScript keyword",
          apply(view, completion, from, to) {
            const placeholder = "myFunction";
            const insert = `function ${placeholder}() {\n  \n}`;
            const nameStart = from + "function ".length;
            const nameEnd = nameStart + placeholder.length;
            view.dispatch({
              changes: { from, to, insert },
              selection: EditorSelection.range(nameStart, nameEnd),
            });
            view.focus();
          },
        };
      }
      return { label: j, type: "keyword", apply: j, detail: "JavaScript" };
    });

    return { from: word.from, options: [...keywordOptions, ...funcOptions] };
  };
};

// Expose a helper to parent components: return an array suitable for autocompletion.override
function getOverrides(language) {
  if (language === "html") return [createHTMLCompletions()];
  if (language === "css") return [createCSSCompletions()];
  if (language === "javascript") return [createJSCompletions()];
  return [];
}

defineExpose({ getOverrides });

onMounted(() => {
  try {
    fetch("/index.html")
      .then((res) => res.text())
      .then((text) => {
        const funcs = [];
        const re = /function\s+([A-Za-z_$][\w$]*)\s*\(/g;
        let m;
        while ((m = re.exec(text)) !== null) {
          funcs.push(m[1]);
        }
        indexHtmlFunctions.value = Array.from(new Set(funcs));
      })
      .catch(() => {});
  } catch (e) {
    // ignore
  }
});
</script>

<template>
  <!-- invisible helper component that exposes suggestion generators to parent -->
  <div style="display: none" aria-hidden="true"></div>
</template>

<style scoped>
/* no visual styles */
</style>
