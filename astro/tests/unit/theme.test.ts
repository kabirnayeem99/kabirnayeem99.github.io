import test from "node:test";
import assert from "node:assert/strict";
import { runInNewContext } from "node:vm";

import { fileURLToPath } from "node:url";

import { compileScript } from "../../scripts/compile-script.ts";
import type { Theme } from "../../src/inline/theme-api.ts";

const KEY = "person-portfolio-theme";
// The head script exactly as the pages get it.
const SCRIPT = compileScript(
  fileURLToPath(new URL("../../src/inline/theme-bootstrap.ts", import.meta.url)),
  "es5-script",
);

/** What the head script puts on `window`. */
interface ThemeApi {
  sync: () => void;
  choose: (theme: Theme) => void;
}

interface BootOptions {
  readonly stored?: string;
  readonly osDark?: boolean;
  readonly storage?: Map<string, string> | null;
  readonly matchMedia?: boolean;
}

/** Runs the head script in a fake page. `storage: null` stands for storage that throws. */
function boot({ stored, osDark = false, storage = new Map<string, string>(), matchMedia = true }: BootOptions = {}) {
  if (stored !== undefined) storage?.set(KEY, stored);
  const attributes = new Map<string, string>();
  const events: object[] = [];
  const metaColors: string[] = [];
  const listeners: (() => void)[] = [];
  const media = {
    matches: osDark,
    addEventListener: (_type: string, listener: () => void): void => {
      listeners.push(listener);
    },
  };
  const refuse = (): never => {
    throw new Error("storage is blocked");
  };
  const window: { localStorage: object; matchMedia?: () => object; personPortfolioTheme?: ThemeApi } = {
    localStorage:
      storage === null
        ? { getItem: refuse, setItem: refuse }
        : {
            getItem: (key: string) => storage.get(key) ?? null,
            setItem: (key: string, value: string) => storage.set(key, value),
          },
    ...(matchMedia ? { matchMedia: () => media } : {}),
  };
  const document = {
    documentElement: {
      getAttribute: (name: string) => attributes.get(name) ?? null,
      setAttribute: (name: string, value: string) => attributes.set(name, value),
    },
    querySelectorAll: () => [{ setAttribute: (_name: string, value: string) => metaColors.push(value) }],
    dispatchEvent: (event: { readonly detail: object }) => events.push({ ...event.detail }),
  };
  class CustomEvent {
    readonly detail: object;
    constructor(_type: string, { detail }: { readonly detail: object }) {
      this.detail = detail;
    }
  }
  runInNewContext(SCRIPT, { window, document, CustomEvent });
  return {
    theme: () => attributes.get("data-theme"),
    api(): ThemeApi {
      assert.ok(window.personPortfolioTheme, "the head script sets window.personPortfolioTheme");
      return window.personPortfolioTheme;
    },
    storage,
    events,
    metaColors,
    setOsDark(dark: boolean): void {
      media.matches = dark;
      assert.ok(listeners.length > 0, "the head script listens for OS changes");
      for (const listener of listeners) listener();
    },
  };
}

test("without a stored choice the page follows the OS, and says nothing on first paint", () => {
  assert.equal(boot().theme(), "light");
  const dark = boot({ osDark: true });
  assert.equal(dark.theme(), "dark");
  assert.deepEqual(dark.events, []);
  assert.deepEqual(dark.metaColors, ["#12100d"]);
});

test("a stored choice beats the OS", () => {
  assert.equal(boot({ stored: "light", osDark: true }).theme(), "light");
  assert.equal(boot({ stored: "dark" }).theme(), "dark");
});

test("an unknown stored value is ignored", () => {
  assert.equal(boot({ stored: "blue", osDark: true }).theme(), "dark");
});

test("without matchMedia the page is light", () => {
  assert.equal(boot({ matchMedia: false }).theme(), "light");
});

test("OS changes apply live until a choice is made", () => {
  const page = boot();
  page.setOsDark(true);
  assert.equal(page.theme(), "dark");
  page.api().choose("light");
  page.setOsDark(true);
  assert.equal(page.theme(), "light");
  assert.deepEqual(page.events, [{ theme: "dark", source: "system" }, { theme: "light", source: "toggle" }]);
});

test("choosing stores the theme and recolours the browser bar", () => {
  const page = boot();
  page.api().choose("dark");
  assert.equal(page.theme(), "dark");
  assert.equal(page.storage?.get(KEY), "dark");
  assert.equal(page.metaColors.at(-1), "#12100d");
});

test("with storage blocked, the choice still lasts for the page", () => {
  const page = boot({ storage: null });
  page.api().choose("dark");
  page.setOsDark(false);
  assert.equal(page.theme(), "dark");
});

test("sync picks up a choice made elsewhere", () => {
  const page = boot();
  page.storage?.set(KEY, "dark");
  page.api().sync();
  assert.equal(page.theme(), "dark");
});
