/**
 * Default look. Everything is driven by `--sk-*` custom properties, so a page
 * can restyle without touching this file:
 *
 *   :root { --sk-accent: #e11d48; --sk-radius: 6px; }
 *
 * The stylesheet only ever reads the public `--sk-*` names, with the defaults
 * as fallbacks (light and dark), through private `--_sk-*` copies on
 * `.sk-root`. So a value set anywhere above the overlay — `:root`, `body`, a
 * theme class — reaches it, and so does one set on `.sk-root` itself.
 *
 * Colors: --sk-bg, --sk-fg (title), --sk-text (body), --sk-muted, --sk-soft,
 * --sk-soft-2, --sk-accent, --sk-accent-fg. Shape: --sk-radius. Stacking: --sk-z.
 */
export const CSS = `
.sk-root{position:fixed;inset:0;z-index:var(--sk-z,10000);pointer-events:none;
  --_sk-bg:var(--sk-bg,#fff);--_sk-fg:var(--sk-fg,#0f172a);--_sk-text:var(--sk-text,#475569);
  --_sk-muted:var(--sk-muted,#94a3b8);--_sk-soft:var(--sk-soft,#f1f5f9);--_sk-soft-2:var(--sk-soft-2,#e2e8f0);
  --_sk-accent:var(--sk-accent,#2563eb);--_sk-accent-fg:var(--sk-accent-fg,#fff);--_sk-radius:var(--sk-radius,14px)}
@media (prefers-color-scheme:dark){.sk-root{--_sk-bg:var(--sk-bg,#1e293b);--_sk-fg:var(--sk-fg,#f1f5f9);
  --_sk-text:var(--sk-text,#cbd5e1);--_sk-muted:var(--sk-muted,#64748b);--_sk-soft:var(--sk-soft,#334155);
  --_sk-soft-2:var(--sk-soft-2,#475569);--_sk-accent:var(--sk-accent,#60a5fa);--_sk-accent-fg:var(--sk-accent-fg,#0b1220)}}

.sk-overlay{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}
.sk-mask,.sk-blocker{pointer-events:auto}

.sk-popover{position:absolute;left:0;top:0;box-sizing:border-box;width:min(328px,calc(100vw - 16px));padding:18px 18px 14px;
  border-radius:var(--_sk-radius);background:var(--_sk-bg);color:var(--_sk-text);pointer-events:auto;outline:none;
  font:13.5px/1.6 system-ui,-apple-system,"Segoe UI","PingFang SC","Noto Sans SC",sans-serif;-webkit-font-smoothing:antialiased;
  box-shadow:0 18px 40px -12px rgba(15,23,42,.35),0 6px 14px -4px rgba(15,23,42,.12)}
.sk-in{animation:sk-fade .18s ease-out}
@keyframes sk-fade{from{opacity:0}to{opacity:1}}

.sk-arrow{position:absolute;width:12px;height:12px;border-radius:2px;background:var(--_sk-bg);transform:rotate(45deg)}
.sk-popover[data-side=bottom] .sk-arrow{top:-5px;left:calc(var(--sk-arrow) - 6px)}
.sk-popover[data-side=top] .sk-arrow{bottom:-5px;left:calc(var(--sk-arrow) - 6px)}
.sk-popover[data-side=right] .sk-arrow{left:-5px;top:calc(var(--sk-arrow) - 6px)}
.sk-popover[data-side=left] .sk-arrow{right:-5px;top:calc(var(--sk-arrow) - 6px)}
.sk-popover[data-side=center] .sk-arrow{display:none}

.sk-title{margin:0 26px 4px 0;color:var(--_sk-fg);font-size:15px;font-weight:600;line-height:1.4;letter-spacing:-.01em}
.sk-body{margin:0;white-space:pre-line}
.sk-footer{display:flex;align-items:center;gap:6px;min-height:32px;margin-top:14px}

.sk-progress{display:flex;flex:1;align-items:center;gap:5px;color:var(--_sk-muted);font-size:12px;font-variant-numeric:tabular-nums}
.sk-dot{display:block;width:6px;height:6px;border-radius:3px;background:var(--_sk-soft-2);transition:width .2s ease,background-color .2s ease}
.sk-dot[data-s=done]{background:var(--_sk-accent);opacity:.4}
.sk-dot[data-s=current]{width:18px;background:var(--_sk-accent)}
.sk-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}

.sk-btn{height:32px;padding:0 14px;border:0;border-radius:8px;background:none;color:var(--_sk-text);
  font:inherit;font-size:13px;font-weight:500;cursor:pointer;transition:background-color .12s,filter .12s,transform .08s}
.sk-btn:hover:not(:disabled){background:var(--_sk-soft)}
.sk-btn:active:not(:disabled){transform:scale(.97)}
.sk-btn:disabled{opacity:.4;cursor:default}
.sk-btn:focus-visible,.sk-close:focus-visible{outline:2px solid var(--_sk-accent);outline-offset:2px}
.sk-btn-primary{background:var(--_sk-accent);color:var(--_sk-accent-fg)}
.sk-btn-primary:hover:not(:disabled){background:var(--_sk-accent);filter:brightness(1.08)}

.sk-close{position:absolute;top:10px;right:10px;display:grid;place-items:center;width:26px;height:26px;padding:0;border:0;border-radius:50%;
  background:none;color:var(--_sk-muted);cursor:pointer;transition:background-color .12s,color .12s}
.sk-close svg{display:block}
.sk-close:hover{background:var(--_sk-soft);color:var(--_sk-fg)}
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
