const setupNoticeEl = document.getElementById('setupNotice');
const mainPanelEl = document.getElementById('mainPanel');
const appFrameEl = document.getElementById('appFrame');
const statusEl = document.getElementById('status');
const goSetupBtn = document.getElementById('goSetupBtn');
const openOptionsBtn = document.getElementById('openOptionsBtn');
const themeToggleBtn = document.getElementById('themeToggleBtn');
const logoutBtn = document.getElementById('logoutBtn');
const LAST_FRAME_CACHE_KEY = 'cf_drop_popup_last_frame_v1';
const SYSTEM_THEME_QUERY = '(prefers-color-scheme: dark)';
const systemThemeMedia = typeof window !== 'undefined' && typeof window.matchMedia === 'function'
  ? window.matchMedia(SYSTEM_THEME_QUERY)
  : null;

let activeInstance = null;
let activeLocale = 'zh-CN';
let activeThemeMode = 'system';
let currentFrameBaseUrl = '';

goSetupBtn?.addEventListener('click', openOptionsPage);
openOptionsBtn?.addEventListener('click', openOptionsPage);
themeToggleBtn?.addEventListener('click', () => {
  void handleThemeToggle();
});
logoutBtn?.addEventListener('click', () => {
  postToFrame('cf-drop-ext-logout');
});
appFrameEl?.addEventListener('load', () => {
  if (isMainPanelVisible()) {
    postToFrame('cf-drop-ext-theme-set', {
      theme: activeThemeMode,
      themeMode: activeThemeMode,
    });
  }
});
window.addEventListener('message', handleFrameMessage);
bindSystemThemeListener();

void init();

async function init() {
  setStatus('');
  const cachedFrame = readLastFrameCache();

  if (cachedFrame) {
    activeLocale = cachedFrame.locale;
    activeThemeMode = normalizeThemeMode(cachedFrame.themeMode);
    applyPopupTheme(activeThemeMode);
    showMain();
    loadFrame(cachedFrame.baseUrl, activeLocale, activeThemeMode);
  } else {
    applyPopupTheme(activeThemeMode);
  }

  const res = await sendMessage('ext:getActiveInstance');
  if (!res.ok) {
    if (cachedFrame) {
      setStatus(`配置读取失败：${res.error}`);
      return;
    }
    showSetup(`初始化失败：${res.error}`);
    return;
  }

  activeInstance = res.instance || null;
  activeLocale = normalizeLocale(res.locale);
  activeThemeMode = normalizeThemeMode(res.theme);
  applyPopupTheme(activeThemeMode);
  if (!activeInstance) {
    clearLastFrameCache();
    showSetup();
    return;
  }

  const normalizedBaseUrl = normalizeBaseUrl(activeInstance.baseUrl);
  if (!normalizedBaseUrl) {
    clearLastFrameCache();
    showSetup('实例地址无效，请前往设置页修复');
    return;
  }

  showMain();
  const nextFrameUrl = buildFrameUrl(normalizedBaseUrl, activeLocale, activeThemeMode);
  if (appFrameEl.getAttribute('src') !== nextFrameUrl) {
    loadFrame(normalizedBaseUrl, activeLocale, activeThemeMode);
  } else {
    setStatus('');
  }

  writeLastFrameCache({
    baseUrl: normalizedBaseUrl,
    locale: activeLocale,
    themeMode: activeThemeMode,
  });
}

function showSetup(message) {
  setupNoticeEl.classList.remove('hidden');
  mainPanelEl.classList.add('hidden');
  toggleActionButtons(false);
  currentFrameBaseUrl = '';
  if (message) setStatus(message, true);
}

function showMain() {
  setupNoticeEl.classList.add('hidden');
  mainPanelEl.classList.remove('hidden');
  toggleActionButtons(true);
}

function loadFrame(baseUrl, locale, theme) {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  if (!normalizedBaseUrl) return;
  currentFrameBaseUrl = normalizedBaseUrl;
  appFrameEl.src = buildFrameUrl(normalizedBaseUrl, locale, theme);
  setStatus('');
}

function setStatus(message, isError = false) {
  statusEl.textContent = message || '';
  statusEl.classList.toggle('is-error', Boolean(isError));
}

function openOptionsPage() {
  chrome.runtime.openOptionsPage();
}

function postToFrame(type, payload = {}) {
  if (!isMainPanelVisible()) {
    setStatus('请先完成实例配置', true);
    return;
  }
  appFrameEl.contentWindow?.postMessage({ type, ...payload }, '*');
}

function handleFrameMessage(event) {
  if (event.source !== appFrameEl.contentWindow) return;
  if (event.data?.type === 'cf-drop-ext-open-options') {
    openOptionsPage();
  }
}

function toggleActionButtons(enabled) {
  const disabled = !enabled;
  if (themeToggleBtn) themeToggleBtn.disabled = false;
  if (logoutBtn) logoutBtn.disabled = disabled;
}

async function handleThemeToggle() {
  activeThemeMode = getNextThemeMode(activeThemeMode);
  applyPopupTheme(activeThemeMode);
  if (isMainPanelVisible()) {
    postToFrame('cf-drop-ext-theme-set', {
      theme: activeThemeMode,
      themeMode: activeThemeMode,
    });
  }
  if (currentFrameBaseUrl) {
    writeLastFrameCache({
      baseUrl: currentFrameBaseUrl,
      locale: normalizeLocale(activeLocale),
      themeMode: activeThemeMode,
    });
  }

  const res = await sendMessage('ext:setTheme', { theme: activeThemeMode });
  if (!res.ok) {
    setStatus(`主题保存失败：${res.error}`, true);
  }
}

function applyPopupTheme(themeMode) {
  const mode = normalizeThemeMode(themeMode);
  const resolvedTheme = resolveTheme(mode);
  document.documentElement.dataset.theme = resolvedTheme;
  document.documentElement.dataset.themeMode = mode;
  document.documentElement.style.colorScheme = resolvedTheme;
}

function normalizeThemeMode(value) {
  if (value === 'system' || value === 'dark' || value === 'light') {
    return value;
  }
  return 'system';
}

function resolveTheme(themeMode) {
  if (themeMode === 'light' || themeMode === 'dark') return themeMode;
  return systemThemeMedia?.matches ? 'dark' : 'light';
}

function getNextThemeMode(themeMode) {
  if (themeMode === 'system') return 'light';
  if (themeMode === 'light') return 'dark';
  return 'system';
}

function normalizeLocale(value) {
  return value === 'en' ? 'en' : 'zh-CN';
}

function normalizeBaseUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return '';
    url.pathname = '';
    url.search = '';
    url.hash = '';
    return url.toString().replace(/\/$/, '');
  } catch {
    return '';
  }
}

function buildFrameUrl(baseUrl, locale, theme) {
  const frameUrl = new URL(baseUrl);
  frameUrl.pathname = '/';
  frameUrl.search = '';
  frameUrl.hash = '';
  frameUrl.searchParams.set('ext', '1');
  frameUrl.searchParams.set('extLocale', normalizeLocale(locale));
  frameUrl.searchParams.set('extTheme', normalizeThemeMode(theme));
  return frameUrl.toString();
}

function readLastFrameCache() {
  try {
    const raw = localStorage.getItem(LAST_FRAME_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const baseUrl = normalizeBaseUrl(parsed?.baseUrl);
    if (!baseUrl) return null;
    return {
      baseUrl,
      locale: normalizeLocale(parsed?.locale),
      themeMode: normalizeThemeMode(parsed?.themeMode || parsed?.theme),
    };
  } catch {
    return null;
  }
}

function writeLastFrameCache(frame) {
  if (!frame?.baseUrl) return;
  try {
    localStorage.setItem(
      LAST_FRAME_CACHE_KEY,
      JSON.stringify({
        baseUrl: normalizeBaseUrl(frame.baseUrl),
        locale: normalizeLocale(frame.locale),
        themeMode: normalizeThemeMode(frame.themeMode || frame.theme),
        updatedAt: Date.now(),
      }),
    );
  } catch {
    // no-op
  }
}

function bindSystemThemeListener() {
  if (!systemThemeMedia) return;
  const onSystemThemeChange = () => {
    if (activeThemeMode !== 'system') return;
    applyPopupTheme('system');
    if (isMainPanelVisible()) {
      postToFrame('cf-drop-ext-theme-set', {
        theme: 'system',
        themeMode: 'system',
      });
    }
  };

  if (typeof systemThemeMedia.addEventListener === 'function') {
    systemThemeMedia.addEventListener('change', onSystemThemeChange);
    return;
  }
  if (typeof systemThemeMedia.addListener === 'function') {
    systemThemeMedia.addListener(onSystemThemeChange);
  }
}

function clearLastFrameCache() {
  try {
    localStorage.removeItem(LAST_FRAME_CACHE_KEY);
  } catch {
    // no-op
  }
}

function isMainPanelVisible() {
  return Boolean(mainPanelEl && !mainPanelEl.classList.contains('hidden'));
}

function sendMessage(type, payload = {}) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type, payload }, (response) => {
      if (chrome.runtime.lastError) {
        resolve({ ok: false, error: chrome.runtime.lastError.message });
        return;
      }
      resolve(response || { ok: false, error: 'No response' });
    });
  });
}
