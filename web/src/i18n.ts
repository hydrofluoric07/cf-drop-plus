export const supportedLocales = ['zh-CN', 'en'] as const;
export type Locale = (typeof supportedLocales)[number];
export interface LocaleMeta {
  code: Locale;
  label: string;
}
export const localeOptions: readonly LocaleMeta[] = [
  { code: 'zh-CN', label: '简体中文' },
  { code: 'en', label: 'English' },
] as const;

export const defaultLocale: Locale = 'zh-CN';

const zhCN = {
  'language.switchAria': '语言切换',
  'language.zhCN': '中文',
  'language.en': 'EN',
  'theme.switchAria': '主题切换',
  'theme.light': '浅色模式',
  'theme.dark': '深色模式',
  'auth.logoutAria': '退出登录',

  'common.errorWithMessage': '错误：{message}',
  'common.no': '取消',
  'common.yes': '确认',

  'composer.placeholder': '在这里输入文本，或粘贴 / 拖拽文件...',
  'composer.addFile': '添加文件',
  'composer.clear': '清空',
  'composer.send': '发送',
  'composer.dropFiles': '松开以上传文件',

  'records.errorPrefix': '错误',
  'records.empty': '暂无上传记录。可在上方粘贴文本或添加文件。',
  'records.loadMore': '加载更多',
  'records.copyText': '复制文本',
  'records.downloadAll': '下载全部',
  'records.delete': '删除',
  'records.previewCloseAria': '关闭图片预览',
  'records.previewDownloadAria': '下载图片',
  'records.previewShareAria': '复制图片链接',
  'records.filterDateAria': '按日期筛选消息',
  'records.filterTypeAria': '按类型筛选消息',
  'records.filterTypeAll': '全部',
  'records.filterTypeText': '文本',
  'records.filterTypeImage': '图片',
  'records.filterTypeDocument': '文档',
  'records.filterTypeArchive': '压缩包',
  'records.filterTypeAudio': '音频',
  'records.filterTypeOther': '其他',
  'records.scrollTopAria': '回到顶部',
  'records.scrollBottomAria': '回到底部',
  'records.paginationAria': '消息分页',
  'records.paginationPrev': '上一页',
  'records.paginationNext': '下一页',
  'records.paginationLabel': '{current} / {total}',
  'records.deviceWindows': 'Windows 设备',
  'records.deviceMacos': 'macOS 设备',
  'records.deviceLinux': 'Linux 设备',
  'records.deviceIos': 'iOS 设备',
  'records.deviceAndroid': 'Android 设备',
  'records.deviceIpados': 'iPadOS 设备',
  'records.deviceUnknown': '未知设备',
  'records.timeToday': '今天',
  'records.timeYesterday': '昨天',

  'password.title': '需要密码',
  'password.caption': '输入共享密码后可查看与管理上传记录。',
  'password.label': '密码',
  'password.placeholder': '请输入密码',
  'password.validating': '校验中...',
  'password.ok': '确认',

  'sw.newVersion': '发现新版本，点击刷新',

  'errors.noContent': '没有可上传的文件或文本',
  'errors.uploadFailed': '上传失败',
  'errors.passwordRequired': '需要密码',
  'errors.unknown': '发生未知错误',
} as const;

const en = {
  'language.switchAria': 'Language switch',
  'language.zhCN': '中文',
  'language.en': 'EN',
  'theme.switchAria': 'Theme switch',
  'theme.light': 'Light',
  'theme.dark': 'Dark',
  'auth.logoutAria': 'Logout',

  'common.errorWithMessage': 'Error: {message}',
  'common.no': 'No',
  'common.yes': 'Yes',

  'composer.placeholder': 'Type text here, or paste / drop files...',
  'composer.addFile': 'Add file',
  'composer.clear': 'Clear',
  'composer.send': 'Send',
  'composer.dropFiles': 'Drop files to upload',

  'records.errorPrefix': 'Error',
  'records.empty': 'No uploads yet. Paste text or add files above to create your first entry.',
  'records.loadMore': 'Load more',
  'records.copyText': 'Copy Text',
  'records.downloadAll': 'Download All',
  'records.delete': 'Delete',
  'records.previewCloseAria': 'Close image preview',
  'records.previewDownloadAria': 'Download image',
  'records.previewShareAria': 'Copy image link',
  'records.filterDateAria': 'Filter messages by date',
  'records.filterTypeAria': 'Filter messages by type',
  'records.filterTypeAll': 'All',
  'records.filterTypeText': 'Text',
  'records.filterTypeImage': 'Image',
  'records.filterTypeDocument': 'Document',
  'records.filterTypeArchive': 'Archive',
  'records.filterTypeAudio': 'Audio',
  'records.filterTypeOther': 'Other',
  'records.scrollTopAria': 'Back to top',
  'records.scrollBottomAria': 'Back to bottom',
  'records.paginationAria': 'Message pagination',
  'records.paginationPrev': 'Prev',
  'records.paginationNext': 'Next',
  'records.paginationLabel': '{current} / {total}',
  'records.deviceWindows': 'Windows Device',
  'records.deviceMacos': 'macOS Device',
  'records.deviceLinux': 'Linux Device',
  'records.deviceIos': 'iOS Device',
  'records.deviceAndroid': 'Android Device',
  'records.deviceIpados': 'iPadOS Device',
  'records.deviceUnknown': 'Unknown Device',
  'records.timeToday': 'Today',
  'records.timeYesterday': 'Yesterday',

  'password.title': 'Password required',
  'password.caption': 'Enter the shared key to unlock upload history and files.',
  'password.label': 'Password',
  'password.placeholder': 'Password',
  'password.validating': 'Validating...',
  'password.ok': 'OK',

  'sw.newVersion': 'New version available. Click to refresh',

  'errors.noContent': 'No files or text to upload',
  'errors.uploadFailed': 'Upload failed',
  'errors.passwordRequired': 'Password required',
  'errors.unknown': 'Unknown error',
} as const;

type Dictionary = typeof zhCN;
export type TranslationKey = keyof Dictionary;

const dictionaries: Record<Locale, Dictionary> = {
  'zh-CN': zhCN,
  en,
};

const errorCodeMap: Record<string, TranslationKey> = {
  'error.noContent': 'errors.noContent',
  'error.uploadFailed': 'errors.uploadFailed',
  'error.passwordRequired': 'errors.passwordRequired',
  'error.unknown': 'errors.unknown',
  'No files or text': 'errors.noContent',
  'Upload failed': 'errors.uploadFailed',
  'Password required': 'errors.passwordRequired',
};

let runtimeLocale: Locale = defaultLocale;

export function isSupportedLocale(input: string): input is Locale {
  return input === 'zh-CN' || input === 'en';
}

export function resolveLocale(input?: string | null): Locale | null {
  if (!input) return null;
  const raw = input.trim();
  const lower = raw.toLowerCase();

  const exact = supportedLocales.find((item) => item.toLowerCase() === lower);
  if (exact) return exact;

  const base = lower.split(/[-_]/)[0];
  if (base) {
    const matchedByBase = supportedLocales.find((item) => {
      const itemLower = item.toLowerCase();
      return itemLower === base || itemLower.startsWith(`${base}-`);
    });
    if (matchedByBase) return matchedByBase;
  }

  return null;
}

export function detectInitialLocale(candidates?: readonly string[]): Locale {
  const source = candidates?.length
    ? candidates
    : (typeof navigator !== 'undefined'
      ? [...(navigator.languages || []), navigator.language]
      : []);

  for (const item of source) {
    const resolved = resolveLocale(item);
    if (resolved) return resolved;
  }
  return defaultLocale;
}

export function setRuntimeLocale(locale: Locale) {
  runtimeLocale = locale;
  if (typeof document !== 'undefined') {
    document.documentElement.lang = locale;
  }
}

export function getRuntimeLocale() {
  return runtimeLocale;
}

export function t(
  locale: Locale,
  key: TranslationKey,
  params?: Record<string, string | number>,
) {
  const dict = dictionaries[locale] || dictionaries[defaultLocale];
  let text = dict[key] || dictionaries[defaultLocale][key];

  if (params) {
    for (const [name, value] of Object.entries(params)) {
      text = text.replaceAll(`{${name}}`, String(value));
    }
  }
  return text;
}

export function tRuntime(
  key: TranslationKey,
  params?: Record<string, string | number>,
) {
  return t(runtimeLocale, key, params);
}

export function tError(locale: Locale, rawError?: string | null) {
  if (!rawError) return t(locale, 'errors.unknown');

  const normalized = rawError.startsWith('Error: ')
    ? rawError.slice('Error: '.length)
    : rawError;
  const mappedKey = errorCodeMap[normalized];
  if (mappedKey) return t(locale, mappedKey);
  return normalized;
}
