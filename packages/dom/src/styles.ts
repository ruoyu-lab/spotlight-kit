/**
 * Default look. Everything is driven by `--sk-*` custom properties, so a page
 * can restyle without touching this file:
 *
 *   :root { --sk-accent: #e11d48; --sk-radius: 6px; }
 *
 * Colors: --sk-bg, --sk-fg (title), --sk-text (body), --sk-muted, --sk-soft,
 * --sk-soft-2, --sk-accent, --sk-accent-fg. Shape: --sk-radius. Stacking: --sk-z.
 */
export const CSS = `
.sk-root{position:fixed;inset:0;z-index:var(--sk-z,10000);pointer-events:none;
  --sk-bg:#fff;--sk-fg:#0f172a;--sk-text:#475569;--sk-muted:#94a3b8;--sk-soft:#f1f5f9;--sk-soft-2:#e2e8f0;
  --sk-accent:#2563eb;--sk-accent-fg:#fff;--sk-radius:14px}
@media (prefers-color-scheme:dark){.sk-root{--sk-bg:#1e293b;--sk-fg:#f1f5f9;--sk-text:#cbd5e1;--sk-muted:#64748b;
  --sk-soft:#334155;--sk-soft-2:#475569;--sk-accent:#60a5fa;--sk-accent-fg:#0b1220}}

.sk-overlay{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}
.sk-mask,.sk-blocker{pointer-events:auto}

.sk-popover{position:absolute;left:0;top:0;box-sizing:border-box;width:min(328px,calc(100vw - 16px));padding:18px 18px 14px;
  border-radius:var(--sk-radius);background:var(--sk-bg);color:var(--sk-text);pointer-events:auto;outline:none;
  font:13.5px/1.6 system-ui,-apple-system,"Segoe UI","PingFang SC","Noto Sans SC",sans-serif;-webkit-font-smoothing:antialiased;
  box-shadow:0 18px 40px -12px rgba(15,23,42,.35),0 6px 14px -4px rgba(15,23,42,.12)}
.sk-in{animation:sk-fade .18s ease-out}
@keyframes sk-fade{from{opacity:0}to{opacity:1}}

.sk-arrow{position:absolute;width:12px;height:12px;border-radius:2px;background:var(--sk-bg);transform:rotate(45deg)}
.sk-popover[data-side=bottom] .sk-arrow{top:-5px;left:calc(var(--sk-arrow) - 6px)}
.sk-popover[data-side=top] .sk-arrow{bottom:-5px;left:calc(var(--sk-arrow) - 6px)}
.sk-popover[data-side=right] .sk-arrow{left:-5px;top:calc(var(--sk-arrow) - 6px)}
.sk-popover[data-side=left] .sk-arrow{right:-5px;top:calc(var(--sk-arrow) - 6px)}
.sk-popover[data-side=center] .sk-arrow{display:none}

.sk-title{margin:0 26px 4px 0;color:var(--sk-fg);font-size:15px;font-weight:600;line-height:1.4;letter-spacing:-.01em}
.sk-body{margin:0;white-space:pre-line}
.sk-footer{display:flex;align-items:center;gap:6px;min-height:32px;margin-top:14px}

.sk-progress{display:flex;flex:1;align-items:center;gap:5px;color:var(--sk-muted);font-size:12px;font-variant-numeric:tabular-nums}
.sk-dot{display:block;width:6px;height:6px;border-radius:3px;background:var(--sk-soft-2);transition:width .2s ease,background-color .2s ease}
.sk-dot[data-s=done]{background:var(--sk-accent);opacity:.4}
.sk-dot[data-s=current]{width:18px;background:var(--sk-accent)}
.sk-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}

.sk-btn{height:32px;padding:0 14px;border:0;border-radius:8px;background:none;color:var(--sk-text);
  font:inherit;font-size:13px;font-weight:500;cursor:pointer;transition:background-color .12s,filter .12s,transform .08s}
.sk-btn:hover:not(:disabled){background:var(--sk-soft)}
.sk-btn:active:not(:disabled){transform:scale(.97)}
.sk-btn:disabled{opacity:.4;cursor:default}
.sk-btn:focus-visible,.sk-close:focus-visible{outline:2px solid var(--sk-accent);outline-offset:2px}
.sk-btn-primary{background:var(--sk-accent);color:var(--sk-accent-fg)}
.sk-btn-primary:hover:not(:disabled){background:var(--sk-accent);filter:brightness(1.08)}

.sk-close{position:absolute;top:10px;right:10px;display:grid;place-items:center;width:26px;height:26px;padding:0;border:0;border-radius:50%;
  background:none;color:var(--sk-muted);cursor:pointer;transition:background-color .12s,color .12s}
.sk-close svg{display:block}
.sk-close:hover{background:var(--sk-soft);color:var(--sk-fg)}
@media (prefers-reduced-motion:reduce){.sk-in{animation:none}.sk-dot,.sk-btn,.sk-close{transition:none}}
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
