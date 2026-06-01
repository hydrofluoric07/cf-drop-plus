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
  'topbar.navAria': '主导航',
  'topbar.actionsAria': '顶栏操作',
  'topbar.home': '首页',
  'topbar.share': '分享',
  'topbar.manage': '设置',
  'language.switchAria': '语言切换',
  'settings.openAria': '打开设置菜单',
  'settings.homeAria': '返回主页',
  'settings.title': '设置',
  'settings.lightBgTitle': '浅色背景',
  'settings.darkBgTitle': '深色背景',
  'settings.instancesTitle': '实例管理',
  'settings.instanceNamePlaceholder': '名称，例如：个人实例',
  'settings.instanceBaseUrlPlaceholder': 'Worker 地址',
  'settings.instancePasswordPlaceholder': '密码，可留空',
  'settings.instanceSave': '保存实例',
  'settings.instanceCancelEdit': '取消编辑',
  'settings.instanceTest': '测试连接',
  'settings.instancesEmpty': '暂无实例，请先新增。',
  'settings.instanceCurrent': '当前使用',
  'settings.instanceEdit': '编辑',
  'settings.instanceSetDefault': '设为默认',
  'settings.instanceDelete': '删除',
  'settings.instanceOpen': '打开站点',
  'settings.instancesRequired': '请填写名称和 Worker 地址',
  'settings.instancesLoadFailed': '读取配置失败：{message}',
  'settings.instancesSaveSuccess': '保存成功',
  'settings.instancesSaveFailed': '保存失败：{message}',
  'settings.instancesTesting': '连接测试中...',
  'settings.instancesTestRequired': '请先填写 Worker 地址',
  'settings.instancesTestSuccess': '连接成功，当前记录 {total} 条',
  'settings.instancesTestFailed': '连接失败：{message}',
  'settings.instancesSwitchSuccess': '已切换默认实例',
  'settings.instancesSwitchFailed': '切换失败：{message}',
  'settings.instancesDeleteConfirm': '确认删除实例 "{name}"？',
  'settings.instancesDeleteSuccess': '删除成功',
  'settings.instancesDeleteFailed': '删除失败：{message}',
  'share.title': '分享',
  'share.empty': '暂无分享记录。',
  'share.loading': '正在加载分享内容...',
  'share.notFound': '分享内容不存在或已被删除。',
  'share.loadFailed': '分享内容加载失败，请稍后重试。',
  'share.createFailed': '创建分享链接失败，请稍后重试。',
  'share.createdAt': '分享创建于 {time}',
  'share.manageAria': '管理分享',
  'share.manageTitle': '管理分享',
  'share.linkLabel': '分享链接',
  'share.copyLinkAria': '复制分享链接',
  'share.delete': '删除',
  'share.deleteSuccess': '分享已取消',
  'share.deleteFailed': '取消分享失败，请稍后重试。',
  'language.zhCN': '中文',
  'language.en': 'EN',
  'theme.switchAria': '主题切换',
  'theme.system': '跟随系统',
  'theme.light': '浅色模式',
  'theme.dark': '深色模式',
  'auth.logoutAria': '退出登录',

  'common.errorWithMessage': '错误：{message}',
  'common.no': '取消',
  'common.yes': '确认',
  'common.close': '关闭',

  'composer.placeholder': '在这里输入文本，或粘贴 / 拖拽文件...',
  'composer.addFile': '添加文件',
  'composer.clear': '清空',
  'composer.send': '发送',
  'composer.dropFiles': '松开以上传文件',

  'records.errorPrefix': '错误',
  'records.loading': '加载中...',
  'records.empty': '暂无上传记录。可在上方粘贴文本或添加文件。',
  'records.loadMore': '加载更多',
  'records.copyText': '复制',
  'records.downloadAll': '下载全部',
  'records.delete': '删除',
  'records.share': '分享',
  'records.previewCloseAria': '关闭图片预览',
  'records.previewDownloadAria': '下载图片',
  'records.previewShareAria': '复制图片链接',
  'records.filterDateAria': '按日期筛选消息',
  'records.filterDateAll': '全部日期',
  'records.filterDateToday': '今天',
  'records.filterDateClear': '清除',
  'records.filterDatePrevMonthAria': '查看上个月',
  'records.filterDateNextMonthAria': '查看下个月',
  'records.filterTypeAria': '按类型筛选消息',
  'records.refreshAria': '刷新消息',
  'records.fileActionMenuAria': '文件操作菜单',
  'records.fileActionDownload': '下载',
  'records.fileActionShare': '分享',
  'records.fileActionDelete': '删除',
  'records.fileDeleteFailed': '删除文件失败，请稍后重试。',
  'records.filterTypeAll': '全部',
  'records.filterTypeText': '文本',
  'records.filterTypeImage': '图片',
  'records.filterTypeDocument': '文档',
  'records.filterTypeArchive': '压缩包',
  'records.filterTypeAudio': '音频',
  'records.filterTypeMore': '更多',
  'records.scrollTopAria': '回到顶部',
  'records.scrollBottomAria': '回到底部',
  'records.paginationAria': '消息分页',
  'records.paginationPrev': '上一页',
  'records.paginationNext': '下一页',
  'records.paginationLabel': '{current} / {total}',
  'records.deviceWindows': 'Windows',
  'records.deviceMacos': 'macOS',
  'records.deviceLinux': 'Linux',
  'records.deviceIos': 'iOS',
  'records.deviceAndroid': 'Android',
  'records.deviceIpados': 'iPadOS',
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
  'toast.copySuccess': '已复制到剪贴板',
  'toast.copyFailed': '复制失败，请手动复制',
  'toast.uploadErrorPrefix': '上传失败：{message}',

  'errors.noContent': '没有可上传的文件或文本',
  'errors.uploadFailed': '上传失败',
  'errors.passwordRequired': '需要密码',
  'errors.tooManyAttempts': '尝试过于频繁，请稍后重试',
  'errors.tooManyAttemptsWithRetry': '尝试过于频繁，请 {seconds} 秒后重试',
  'errors.unknown': '发生未知错误',
} as const;

const en = {
  'topbar.navAria': 'Main navigation',
  'topbar.actionsAria': 'Topbar actions',
  'topbar.home': 'Home',
  'topbar.share': 'Share',
  'topbar.manage': 'Settings',
  'language.switchAria': 'Language switch',
  'settings.openAria': 'Open settings menu',
  'settings.homeAria': 'Back home',
  'settings.title': 'Settings',
  'settings.lightBgTitle': 'Light background',
  'settings.darkBgTitle': 'Dark background',
  'settings.instancesTitle': 'Instances',
  'settings.instanceNamePlaceholder': 'Name, e.g. Personal',
  'settings.instanceBaseUrlPlaceholder': 'Worker URL',
  'settings.instancePasswordPlaceholder': 'Password, optional',
  'settings.instanceSave': 'Save instance',
  'settings.instanceCancelEdit': 'Cancel edit',
  'settings.instanceTest': 'Test connection',
  'settings.instancesEmpty': 'No instances yet.',
  'settings.instanceCurrent': 'Active',
  'settings.instanceEdit': 'Edit',
  'settings.instanceSetDefault': 'Set default',
  'settings.instanceDelete': 'Delete',
  'settings.instanceOpen': 'Open site',
  'settings.instancesRequired': 'Name and Worker URL are required',
  'settings.instancesLoadFailed': 'Failed to read config: {message}',
  'settings.instancesSaveSuccess': 'Saved',
  'settings.instancesSaveFailed': 'Failed to save: {message}',
  'settings.instancesTesting': 'Testing connection...',
  'settings.instancesTestRequired': 'Enter a Worker URL first',
  'settings.instancesTestSuccess': 'Connected, {total} records',
  'settings.instancesTestFailed': 'Connection failed: {message}',
  'settings.instancesSwitchSuccess': 'Default instance updated',
  'settings.instancesSwitchFailed': 'Failed to switch: {message}',
  'settings.instancesDeleteConfirm': 'Delete instance "{name}"?',
  'settings.instancesDeleteSuccess': 'Deleted',
  'settings.instancesDeleteFailed': 'Failed to delete: {message}',
  'share.title': 'Share',
  'share.empty': 'No shared records yet.',
  'share.loading': 'Loading shared content...',
  'share.notFound': 'Shared content does not exist or has been deleted.',
  'share.loadFailed': 'Failed to load shared content. Please try again later.',
  'share.createFailed': 'Failed to create share link. Please try again later.',
  'share.createdAt': 'Shared at {time}',
  'share.manageAria': 'Manage share',
  'share.manageTitle': 'Manage share',
  'share.linkLabel': 'Share link',
  'share.copyLinkAria': 'Copy share link',
  'share.delete': 'Delete',
  'share.deleteSuccess': 'Share removed',
  'share.deleteFailed': 'Failed to remove share. Please try again later.',
  'language.zhCN': '中文',
  'language.en': 'EN',
  'theme.switchAria': 'Theme switch',
  'theme.system': 'System',
  'theme.light': 'Light',
  'theme.dark': 'Dark',
  'auth.logoutAria': 'Logout',

  'common.errorWithMessage': 'Error: {message}',
  'common.no': 'No',
  'common.yes': 'Yes',
  'common.close': 'Close',

  'composer.placeholder': 'Type text here, or paste / drop files...',
  'composer.addFile': 'Add file',
  'composer.clear': 'Clear',
  'composer.send': 'Send',
  'composer.dropFiles': 'Drop files to upload',

  'records.errorPrefix': 'Error',
  'records.loading': 'Loading...',
  'records.empty': 'No uploads yet. Paste text or add files above to create your first entry.',
  'records.loadMore': 'Load more',
  'records.copyText': 'Copy',
  'records.downloadAll': 'Download All',
  'records.delete': 'Delete',
  'records.share': 'Share',
  'records.previewCloseAria': 'Close image preview',
  'records.previewDownloadAria': 'Download image',
  'records.previewShareAria': 'Copy image link',
  'records.filterDateAria': 'Filter messages by date',
  'records.filterDateAll': 'All dates',
  'records.filterDateToday': 'Today',
  'records.filterDateClear': 'Clear',
  'records.filterDatePrevMonthAria': 'View previous month',
  'records.filterDateNextMonthAria': 'View next month',
  'records.filterTypeAria': 'Filter messages by type',
  'records.refreshAria': 'Refresh records',
  'records.fileActionMenuAria': 'File actions',
  'records.fileActionDownload': 'Download',
  'records.fileActionShare': 'Share',
  'records.fileActionDelete': 'Delete',
  'records.fileDeleteFailed': 'Failed to delete file. Please try again later.',
  'records.filterTypeAll': 'All',
  'records.filterTypeText': 'Text',
  'records.filterTypeImage': 'Image',
  'records.filterTypeDocument': 'Document',
  'records.filterTypeArchive': 'Archive',
  'records.filterTypeAudio': 'Audio',
  'records.filterTypeMore': 'More',
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
  'toast.copySuccess': 'Copied to clipboard',
  'toast.copyFailed': 'Copy failed, please copy manually',
  'toast.uploadErrorPrefix': 'Upload failed: {message}',

  'errors.noContent': 'No files or text to upload',
  'errors.uploadFailed': 'Upload failed',
  'errors.passwordRequired': 'Password required',
  'errors.tooManyAttempts': 'Too many attempts, please try again later',
  'errors.tooManyAttemptsWithRetry': 'Too many attempts, try again in {seconds}s',
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
  'error.tooManyAttempts': 'errors.tooManyAttempts',
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
  if (normalized.startsWith('error.tooManyAttempts:')) {
    const seconds = Number.parseInt(normalized.slice('error.tooManyAttempts:'.length), 10);
    if (Number.isFinite(seconds) && seconds > 0) {
      return t(locale, 'errors.tooManyAttemptsWithRetry', { seconds });
    }
    return t(locale, 'errors.tooManyAttempts');
  }

  const mappedKey = errorCodeMap[normalized];
  if (mappedKey) return t(locale, mappedKey);
  return normalized;
}
