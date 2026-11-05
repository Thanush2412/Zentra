import { readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";

/**
 * A dialog whose save handler never releases its own open-state stays on screen after the
 * write succeeds, so the user sees a filled form instead of a saved record. This shipped
 * once (admin KAM add/edit, fixed by closing the dialog on success) and the shape is
 * invisible to tsc and to the other gates here, so it is pinned structurally: for every
 * dialog mounted off a local useState, the submit/confirm handler bound inside it must
 * release that state. DIALOG_GUARD_DEBUG=1 npx vitest run this file dumps what was read.
 */
function tsxFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) tsxFiles(full, out);
    else if (/\.tsx$/.test(full)) out.push(full);
  }
  return out;
}

/** Text of the opening tag at `<`, honouring nested {…} and quotes. */
function openingTag(src: string, start: number): string {
  let brace = 0;
  let quote: string | null = null;
  for (let i = start + 1; i < src.length; i++) {
    const c = src[i];
    if (quote) {
      if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") { quote = c; continue; }
    if (c === "{") brace++;
    else if (c === "}") brace--;
    else if (c === ">" && brace === 0) return src.slice(start, i + 1);
  }
  return "";
}

/** [start, end) of the element whose opening tag starts at `start`, or null if unbalanced. */
function elementRange(src: string, start: number, tag: string): [number, number] | null {
  const root = openingTag(src, start);
  if (!root) return null;
  if (root.endsWith("/>")) return [start, start + root.length];

  const re = new RegExp(`<(/)?${tag}\\b`, "g");
  re.lastIndex = start + root.length;
  let depth = 1;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    if (m[1]) {
      if (--depth === 0) return [start, re.lastIndex];
      continue;
    }
    const inner = openingTag(src, m.index);
    if (!inner) return null;
    if (!inner.endsWith("/>")) depth++;
  }
  return null;
}

/** Body of the `{...}` expression whose `{` sits at `braceIdx`. */
function expressionAt(src: string, braceIdx: number): string | null {
  let depth = 0;
  let quote: string | null = null;
  for (let i = braceIdx; i < src.length; i++) {
    const c = src[i];
    if (quote) {
      if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") { quote = c; continue; }
    if (c === "{") depth++;
    else if (c === "}" && --depth === 0) return src.slice(braceIdx + 1, i);
  }
  return null;
}

/** Body of `const NAME = (…) => {` or `function NAME(…) {` declared in the same file. */
function handlerBody(src: string, name: string): string | null {
  const patterns = [
    new RegExp(`const\\s+${name}\\s*=\\s*(?:async\\s*)?\\(([^)]*)\\)\\s*(?::[^=\\n]+)?=>\\s*\\{`),
    new RegExp(`function\\s+${name}\\s*\\(([^)]*)\\)\\s*(?::[^{\\n]+)?\\{`)
  ];
  for (const re of patterns) {
    const m = re.exec(src);
    if (!m) continue;
    const openIdx = m.index + m[0].length - 1;
    let depth = 0;
    for (let i = openIdx; i < src.length; i++) {
      if (src[i] === "{") depth++;
      else if (src[i] === "}" && --depth === 0) return src.slice(openIdx, i + 1);
    }
  }
  return null;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const DIALOG_TAG = /<(Dialog|Modal|Sheet|Drawer|Popup|Wizard|[A-Z][A-Za-z0-9]*(?:Dialog|Modal|Sheet|Drawer|Wizard|Popup))\b/g;
const SUBMIT_PROP = /\bon(Submit|Confirm|Save|Ok|Approve|Accept|Click)=\{/g;
// `onClick` is the footer-button route to the same bug, but it also matches every Cancel
// button, so a click handler only counts when its own name says it writes.
const WRITEISH_NAME = /(save|submit|confirm|create|update|approve|add|publish|resolve)/i;
const WRITE = /(fetch\(|apiFetch\(|await\s+[\w.]*\w*(create|update|delete|save|submit|approve|resolve|import|assign|bulk))/i;

// Dialogs that stay open after a successful write on purpose, each with its reason.
const ALLOW_LIST = new Map<string, string>([
  ["/src/components/admin/dialogs/CampusWizardDialog.tsx", "create path shows an in-dialog Campus Created screen"],
  ["/src/components/DashboardLayout.tsx", "feedback form switches the open dialog to the submitted-issues tab"]
]);

/** The useState-backed visibility flag a dialog element is keyed on, or null. */
function openStateOf(src: string, elementStart: number, attrs: string): string | null {
  const direct = /\bopen=\{\s*(?:!!\s*|Boolean\(\s*)?([A-Za-z_]\w*)/.exec(attrs);
  if (direct && !/^(true|false|Boolean)$/.test(direct[1])) return direct[1];

  // `open={true}` (or a bare Boolean of a flag) inside a `{flag && <Dialog/>}` mount.
  const before = src.slice(Math.max(0, elementStart - 400), elementStart);
  const mounted = /\{\s*([A-Za-z_]\w*)\s*(?:&&|\?)\s*\(?\s*$/.exec(before.trim());
  return mounted ? mounted[1] : null;
}

describe("save dialogs close themselves", () => {
  it("binds each state-controlled dialog to a handler that releases that state", () => {
    const violations: string[] = [];
    const inspected: string[] = [];

    for (const file of tsxFiles(join(process.cwd(), "src"))) {
      const src = readFileSync(file, "utf8");
      const rel = file.replace(process.cwd(), "").replace(/\\/g, "/");
      const allowed = ALLOW_LIST.get(rel);

      const tagRe = new RegExp(DIALOG_TAG.source, "g");
      let m: RegExpExecArray | null;

      while ((m = tagRe.exec(src))) {
        const tag = m[1];
        const attrs = openingTag(src, m.index);
        const range = elementRange(src, m.index, tag);
        if (!range || !attrs) continue;

        const state = openStateOf(src, m.index, attrs);
        tagRe.lastIndex = range[1] - m[0].length;
        // Only dialogs whose visibility is a useState declared in this file are checkable.
        if (!state) continue;
        if (!new RegExp(`const\\s*\\[\\s*${state}\\s*,\\s*set${cap(state)}\\s*\\]\\s*=\\s*useState`).test(src)) continue;

        const element = src.slice(range[0], range[1]);
        const propRe = new RegExp(SUBMIT_PROP.source, "g");
        let p: RegExpExecArray | null;

        while ((p = propRe.exec(element))) {
          const expr = expressionAt(element, p.index + p[0].length - 1);
          if (expr === null) continue;
          if (p[1] === "Click" && !WRITEISH_NAME.test(expr)) continue;
          const named = /^\s*([A-Za-z_]\w*)\s*$/.exec(expr);
          const body = named ? handlerBody(src, named[1]) : expr;
          const label = named ? `${named[1]}()` : "inline handler";
          if (!body || !WRITE.test(body)) continue; // prop-supplied, or a pure read

          inspected.push(`${rel} <${tag} ${state}> via on${p[1]}=${label}`);
          const releases = new RegExp(`set${cap(state)}\\(\\s*(?:false|null|undefined)\\s*\\)`).test(body);
          if (!releases && !allowed) {
            violations.push(`${rel}: <${tag} ${state}> writes via on${p[1]}=${label} but never calls set${cap(state)}(false)`);
          }
        }
      }
    }

    if (process.env.DIALOG_GUARD_DEBUG) {
      console.log(`dialogs inspected: ${inspected.length}\n${inspected.map((x) => "  " + x).join("\n")}`);
    }
    expect(violations).toEqual([]);
    expect(inspected.length, "guard must keep reading dialogs, not pass vacuously").toBeGreaterThan(15);
  });

  it("keeps the admin KAM dialog closed on a successful add or edit", () => {
    const src = readFileSync(join(process.cwd(), "src/components/admin/people/KamsTab.tsx"), "utf8");
    const body = handlerBody(src, "handleSubmit") || "";
    expect(body).toContain("setShowModal(false)");
  });
});
