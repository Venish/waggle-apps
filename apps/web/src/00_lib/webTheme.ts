export type WebThemeId = "orange" | "green" | "sky" | "coral";
export type WebMode = "light" | "dark";

export interface WebThemeOption {
  id: WebThemeId;
  label: string;
  swatch: string;
}

export const DEFAULT_WEB_THEME: WebThemeId = "orange";
export const DEFAULT_WEB_MODE: WebMode = "light";
export const WEB_THEME_STORAGE_KEY = "waggle-web-theme";
export const WEB_MODE_STORAGE_KEY = "waggle-web-mode";

export const WEB_THEMES: readonly WebThemeOption[] = [
  { id: "orange", label: "와글 오렌지", swatch: "#F18118" },
  { id: "green", label: "와글 그린", swatch: "#25CE62" },
  { id: "sky", label: "스카이 블루", swatch: "#22B1F2" },
  { id: "coral", label: "코랄 피치", swatch: "#FA5C5D" },
] as const;

const VALID_THEME_IDS = new Set<string>(WEB_THEMES.map((t) => t.id));

export function isWebThemeId(value: string | null | undefined): value is WebThemeId {
  return typeof value === "string" && VALID_THEME_IDS.has(value);
}

function syncThemeColorMeta(mode: WebMode): void {
  if (typeof document === "undefined") return;
  const color = mode === "dark" ? "#121417" : "#ffffff";
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (meta) meta.content = color;
}

/**
 * First Paint 이전(SSR <head>)에 localStorage의 브랜드 컬러 + 다크 모드를 즉시 적용해 FOUC 0ms 차단
 */
export const WEB_THEME_BOOTSTRAP_SCRIPT =
  `(function(){try{var d=document.documentElement;var t=localStorage.getItem("${WEB_THEME_STORAGE_KEY}");if(t==="orange"||t==="green"||t==="sky"||t==="coral"){d.dataset.webTheme=t;}var m=localStorage.getItem("${WEB_MODE_STORAGE_KEY}")==="dark"?"dark":"light";d.dataset.webMode=m;d.style.colorScheme=m;var meta=document.querySelector('meta[name="theme-color"]');if(meta)meta.setAttribute("content",m==="dark"?"#121417":"#ffffff");}catch(e){}})();`;

export function readCurrentWebTheme(): WebThemeId {
  if (typeof window === "undefined") return DEFAULT_WEB_THEME;
  const fromDom = document.documentElement.dataset.webTheme;
  if (isWebThemeId(fromDom)) return fromDom;
  try {
    const stored = window.localStorage.getItem(WEB_THEME_STORAGE_KEY);
    if (isWebThemeId(stored)) return stored;
  } catch {
    // ignore storage restriction
  }
  return DEFAULT_WEB_THEME;
}

export function readCurrentWebMode(): WebMode {
  if (typeof window === "undefined") return DEFAULT_WEB_MODE;
  if (document.documentElement.dataset.webMode === "dark") return "dark";
  try {
    if (window.localStorage.getItem(WEB_MODE_STORAGE_KEY) === "dark") return "dark";
  } catch {
    // ignore storage restriction
  }
  return DEFAULT_WEB_MODE;
}

export function applyWebTheme(theme: WebThemeId): void {
  if (typeof window === "undefined") return;
  document.documentElement.dataset.webTheme = theme;
  try {
    window.localStorage.setItem(WEB_THEME_STORAGE_KEY, theme);
  } catch {
    // ignore storage restriction
  }
}

export function applyWebMode(mode: WebMode): void {
  if (typeof window === "undefined") return;
  const root = document.documentElement;
  root.dataset.webMode = mode;
  root.style.colorScheme = mode;
  syncThemeColorMeta(mode);
  try {
    window.localStorage.setItem(WEB_MODE_STORAGE_KEY, mode);
  } catch {
    // ignore storage restriction
  }
}
