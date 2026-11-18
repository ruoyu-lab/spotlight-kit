/**
 * Default look. Everything is driven by `--sk-*` custom properties, so a page
 * can restyle without touching this file:
 *
 *   :root { --sk-accent: #e11d48; --sk-radius: 4px; }
 */
export const CSS = `
.sk-root{position:fixed;inset:0;z-index:var(--sk-z,10000);pointer-events:none;
  --sk-bg:#fff;--sk-fg:#111827;--sk-muted:#6b7280;--sk-soft:#f3f4f6;--sk-accent:#2563eb;--sk-accent-fg:#fff;--sk-radius:10px}
@media (prefers-color-scheme:dark){.sk-root{--sk-bg:#1f2937;--sk-fg:#f9fafb;--sk-muted:#9ca3af;--sk-soft:#374151;--sk-accent:#3b82f6}}
.sk-overlay{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}
.sk-mask,.sk-blocker{pointer-events:auto}
.sk-popover{position:absolute;left:0;top:0;box-sizing:border-box;width:min(340px,calc(100vw - 16px));padding:16px;
  border-radius:var(--sk-radius);background:var(--sk-bg);color:var(--sk-fg);pointer-events:auto;outline:none;
  font:14px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.28)}
.sk-popover[data-side=center]{--sk-arrow:0px}
.sk-arrow{position:absolute;width:10px;height:10px;background:var(--sk-bg);transform:rotate(45deg)}
.sk-popover[data-side=bottom] .sk-arrow{top:-5px;left:calc(var(--sk-arrow) - 5px)}
.sk-popover[data-side=top] .sk-arrow{bottom:-5px;left:calc(var(--sk-arrow) - 5px)}
.sk-popover[data-side=right] .sk-arrow{left:-5px;top:calc(var(--sk-arrow) - 5px)}
.sk-popover[data-side=left] .sk-arrow{right:-5px;top:calc(var(--sk-arrow) - 5px)}
.sk-popover[data-side=center] .sk-arrow{display:none}
.sk-title{margin:0 28px 6px 0;font-size:16px;font-weight:600;line-height:1.3}
.sk-body{margin:0 0 14px;white-space:pre-line}
.sk-footer{display:flex;align-items:center;gap:8px}
.sk-progress{flex:1;color:var(--sk-muted);font-size:12px}
.sk-btn{padding:6px 12px;border:0;border-radius:6px;background:var(--sk-soft);color:inherit;font:inherit;cursor:pointer}
.sk-btn:disabled{opacity:.4;cursor:default}
.sk-btn:focus-visible,.sk-close:focus-visible{outline:2px solid var(--sk-accent);outline-offset:2px}
.sk-btn-primary{background:var(--sk-accent);color:var(--sk-accent-fg)}
.sk-close{position:absolute;top:10px;right:10px;display:grid;place-items:center;width:26px;height:26px;padding:0;border:0;border-radius:50%;background:none;color:var(--sk-muted);cursor:pointer;transition:background-color .12s,color .12s}
.sk-close svg{display:block}
.sk-close:hover{background:var(--sk-soft);color:var(--sk-fg)}
@media (prefers-reduced-motion:reduce){.sk-close{transition:none}}
`;

const STYLE_ID = 'spotlight-kit-style';

/** Injects the default stylesheet once per document. */
export function ensureStyles(doc: Document): void {
  if (doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CSS;
  doc.head.append(style);
}

export function removeStylesIfUnused(doc: Document, rootAttribute: string): void {
  if (doc.querySelector(`[${rootAttribute}]`)) return;
  doc.getElementById(STYLE_ID)?.remove();
}
