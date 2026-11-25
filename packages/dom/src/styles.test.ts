import { describe, expect, it } from 'vitest';
import { CSS } from './styles.js';

/** Every `--name:` declared in the stylesheet. */
const declared = [...CSS.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]);
/** Every `var(--name` read in the stylesheet. */
const read = [...CSS.matchAll(/var\((--[\w-]+)/g)].map((m) => m[1]);

describe('default stylesheet', () => {
  it('never declares a public --sk-* variable, so a value set on :root or any ancestor is not shadowed', () => {
    expect(declared.filter((name) => name.startsWith('--sk-'))).toEqual([]);
  });

  it('gives every private --_sk-* variable it reads a default that the public one overrides', () => {
    const privates = new Set(read.filter((name) => name.startsWith('--_sk-')));
    expect(privates.size).toBeGreaterThan(0);
    for (const name of privates) {
      const pub = name.replace('--_sk-', '--sk-');
      expect(CSS, name).toMatch(new RegExp(`${name}:var\\(${pub},[^)]+\\)`));
    }
  });

  it('reads the public variables only as overrides, apart from the ones that have no default', () => {
    const publicReads = new Set(read.filter((name) => name.startsWith('--sk-')));
    // --sk-z has its fallback inline; --sk-arrow is set by the renderer on the popover.
    for (const name of publicReads) {
      if (name === '--sk-z' || name === '--sk-arrow') continue;
      expect(CSS, name).toMatch(new RegExp(`--_sk-${name.slice(5)}:var\\(${name},`));
    }
  });
});
