const STORAGE_KEY = 'cf_drop_extension_config_v1';
const SUPPORTED_LOCALES = ['zh-CN', 'en'];
const DEFAULT_LOCALE = 'zh-CN';
const SUPPORTED_THEMES = ['system', 'light', 'dark'];
const DEFAULT_THEME = 'system';

const DEFAULT_CONFIG = {
  activeInstanceId: '',
  locale: DEFAULT_LOCALE,
  theme: DEFAULT_THEME,
  instances: [],
};

chrome.runtime.onInstalled.addListener(() => {
  void ensureConfig();
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  void (async () => {
    try {
      const result = await handleMessage(message || {});
      sendResponse({ ok: true, ...result });
    } catch (error) {
      sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : String(error || 'Unknown error'),
      });
    }
  })();

  return true;
});

async function handleMessage(message) {
  const type = String(message.type || '');

  switch (type) {
    case 'ext:listInstances':
      return { config: await ensureConfig() };
    case 'ext:getActiveInstance': {
      const config = await ensureConfig();
      return {
        instance: getActiveInstance(config),
        locale: config.locale,
        theme: config.theme,
      };
    }
    case 'ext:upsertInstance':
      return { config: await upsertInstance(message.payload || {}) };
    case 'ext:removeInstance':
      return { config: await removeInstance(String(message.payload?.id || '')) };
    case 'ext:setActiveInstance':
      return { config: await setActiveInstance(String(message.payload?.id || '')) };
    case 'ext:setLocale':
      return { config: await setLocale(String(message.payload?.locale || '')) };
    case 'ext:setTheme':
      return { config: await setTheme(String(message.payload?.theme || '')) };
    case 'ext:testConnection':
      return { result: await testConnection(message.payload || {}) };
    case 'ext:getActiveCount':
      return { result: await getActiveCount() };
    case 'ext:upload':
      return { result: await uploadWithActiveInstance(message.payload || {}) };
    default:
      throw new Error(`Unsupported message type: ${type}`);
  }
}

async function ensureConfig() {
  const raw = await chrome.storage.local.get(STORAGE_KEY);
  const normalized = normalizeConfig(raw[STORAGE_KEY]);
  await chrome.storage.local.set({ [STORAGE_KEY]: normalized });
  return normalized;
}

function normalizeConfig(input) {
  const instances = Array.isArray(input?.instances)
    ? input.instances.map((item) => normalizeInstance(item)).filter(Boolean)
    : [];
  const locale = normalizeLocale(input?.locale);
  const theme = normalizeTheme(input?.theme);

  let activeInstanceId = String(input?.activeInstanceId || '');
  if (!instances.some((item) => item.id === activeInstanceId)) {
    activeInstanceId = instances[0]?.id || '';
  }

  return {
    activeInstanceId,
    locale,
    theme,
    instances,
  };
}

function normalizeInstance(input) {
  const baseUrl = normalizeBaseUrl(String(input?.baseUrl || ''));
  if (!baseUrl) return null;

  const id = String(input?.id || createId());
  const name = String(input?.name || baseUrl);
  const password = String(input?.password || '');
  return {
    id,
    name,
    baseUrl,
    password,
  };
}

async function saveConfig(config) {
  const normalized = normalizeConfig(config);
  await chrome.storage.local.set({ [STORAGE_KEY]: normalized });
  return normalized;
}

function getActiveInstance(config) {
  return config.instances.find((item) => item.id === config.activeInstanceId) || null;
}

async function upsertInstance(payload) {
  const config = await ensureConfig();
  const incoming = normalizeInstance({
    id: payload.id,
    name: payload.name,
    baseUrl: payload.baseUrl,
    password: payload.password,
  });

  if (!incoming) {
    throw new Error('实例地址无效');
  }

  const exists = config.instances.some((item) => item.id === incoming.id);
  const instances = exists
    ? config.instances.map((item) => (item.id === incoming.id ? incoming : item))
    : [...config.instances, incoming];

  const activeInstanceId = config.activeInstanceId || incoming.id;
  return saveConfig({
    instances,
    activeInstanceId,
    locale: config.locale,
    theme: config.theme,
  });
}

async function removeInstance(id) {
  if (!id) return ensureConfig();
  const config = await ensureConfig();
  const instances = config.instances.filter((item) => item.id !== id);
  let activeInstanceId = config.activeInstanceId;
  if (activeInstanceId === id) {
    activeInstanceId = instances[0]?.id || '';
  }
  return saveConfig({
    instances,
    activeInstanceId,
    locale: config.locale,
    theme: config.theme,
  });
}

async function setActiveInstance(id) {
  const config = await ensureConfig();
  if (!config.instances.some((item) => item.id === id)) {
    throw new Error('实例不存在');
  }
  return saveConfig({
    instances: config.instances,
    activeInstanceId: id,
    locale: config.locale,
    theme: config.theme,
  });
}

async function setLocale(locale) {
  const config = await ensureConfig();
  return saveConfig({
    activeInstanceId: config.activeInstanceId,
    locale: normalizeLocale(locale),
    theme: config.theme,
    instances: config.instances,
  });
}

async function setTheme(theme) {
  const config = await ensureConfig();
  return saveConfig({
    activeInstanceId: config.activeInstanceId,
    locale: config.locale,
    theme: normalizeTheme(theme),
    instances: config.instances,
  });
}

async function testConnection(payload) {
  const baseUrl = normalizeBaseUrl(String(payload.baseUrl || ''));
  if (!baseUrl) throw new Error('实例地址无效');
  const password = String(payload.password || '');

  const data = await requestJson(`${baseUrl}/api/list/count`, {
    method: 'GET',
    headers: {
      'x-password': password,
    },
  });

  return {
    total: Number(data?.total || 0),
    totalPages: Number(data?.totalPages || 0),
  };
}

async function getActiveCount() {
  const config = await ensureConfig();
  const active = getActiveInstance(config);
  if (!active) throw new Error('请先在扩展设置中配置实例');

  const data = await requestJson(`${active.baseUrl}/api/list/count`, {
    method: 'GET',
    headers: {
      'x-password': active.password,
    },
  });
  return {
    total: Number(data?.total || 0),
    totalPages: Number(data?.totalPages || 0),
  };
}

async function uploadWithActiveInstance(payload) {
  const config = await ensureConfig();
  const active = getActiveInstance(config);
  if (!active) throw new Error('请先在扩展设置中配置实例');

  const text = String(payload.text || '');
  const files = toUploadFiles(payload.files || []);
  if (!text && !files.length) {
    throw new Error('请先输入文本或选择文件');
  }

  const formData = new FormData();
  formData.append('message', text);
  formData.append('fileInfos', JSON.stringify(files.map((file) => ({
    name: file.name,
    size: file.size,
    type: file.type || 'application/octet-stream',
    thumbnail: '',
  }))));
  files.forEach((file) => formData.append('files', file));

  const data = await requestJson(`${active.baseUrl}/api/upload`, {
    method: 'POST',
    headers: {
      'x-password': active.password,
      'x-uploader': 'extension',
    },
    body: formData,
  });
  return data;
}

function toUploadFiles(input) {
  if (!Array.isArray(input)) return [];
  const FileCtor = typeof File !== 'undefined' ? File : null;
  return input
    .map((item, index) => {
      if (FileCtor && item instanceof FileCtor) return item;
      if (item instanceof Blob) {
        return FileCtor ? new FileCtor([item], `file-${index + 1}`, {
          type: item.type || 'application/octet-stream',
        }) : item;
      }
      return null;
    })
    .filter(Boolean);
}

async function requestJson(url, init) {
  const response = await fetch(url, init);
  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('密码错误或未授权');
    }
    const message = String(data?.message || data?.error || `请求失败 (${response.status})`);
    throw new Error(message);
  }

  return data;
}

function normalizeBaseUrl(rawUrl) {
  const value = rawUrl.trim();
  if (!value) return '';
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return '';
    url.pathname = '';
    url.search = '';
    url.hash = '';
    return url.toString().replace(/\/$/, '');
  } catch {
    return '';
  }
}

function createId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `inst_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function normalizeLocale(value) {
  const locale = String(value || '').trim();
  if (SUPPORTED_LOCALES.includes(locale)) {
    return locale;
  }
  return DEFAULT_LOCALE;
}

function normalizeTheme(value) {
  const theme = String(value || '').trim();
  if (SUPPORTED_THEMES.includes(theme)) {
    return theme;
  }
  return DEFAULT_THEME;
}
