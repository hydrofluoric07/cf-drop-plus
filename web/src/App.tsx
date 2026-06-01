import './App.scss';
import { ContentInput } from './components/ContentInput';
import { UploadRecordCard, UploadRecords } from './components/UploadRecords';
import { PasswordInput } from './components/PasswordInput';
import { createPortal } from 'react-dom';
import { useAtom } from 'jotai';
import { uploadingErrorAtom, uploadingProgressAtom } from './store/uploading';
import { useLocale, useT } from './store/locale';
import { localeOptions, tError, resolveLocale } from './i18n';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { ThemeMode, useThemeMode } from './store/theme';
import { useBackgroundColors, normalizeHexColor } from './store/background';
import { fetchAPI, logout, passwordAtom } from './store/auth';
import { globalMessageAtom, hideGlobalMessage, showGlobalMessage } from './store';
import type { UploadRecord } from '../../src/database';

const HOME_PATH = '/';
const SHARE_PATH = '/share';
const SETTINGS_PATH = '/settings';

type AppPath = typeof HOME_PATH | typeof SHARE_PATH | typeof SETTINGS_PATH;
interface SharedRecordResponse {
  record: UploadRecord;
  share: {
    slug: string;
    recordSlug: string;
    ctime: number;
  };
}
interface ShareCountResponse {
  total: number;
  pageSize: number;
  totalPages: number;
}
interface ExtensionInstance {
  id: string;
  name: string;
  baseUrl: string;
  password?: string;
}
interface ExtensionConfig {
  activeInstanceId: string;
  locale: string;
  theme: string;
  instances: ExtensionInstance[];
}
interface ExtensionResponse<T = Record<string, unknown>> {
  ok: boolean;
  error?: string;
  config?: ExtensionConfig;
  result?: T;
}

function resolveAppPath(pathname: string): AppPath {
  if (pathname === SHARE_PATH || pathname.startsWith(`${SHARE_PATH}/`)) return SHARE_PATH;
  if (pathname === SETTINGS_PATH) return SETTINGS_PATH;
  return HOME_PATH;
}

function getCurrentAppPath(): AppPath {
  if (typeof window === 'undefined') return HOME_PATH;
  return resolveAppPath(window.location.pathname);
}

function getNavigationUrl(path: AppPath, preserveSearch: boolean) {
  if (!preserveSearch || typeof window === 'undefined') return path;
  return `${path}${window.location.search}`;
}

function sendExtensionRequest<T = Record<string, unknown>>(action: string, payload: Record<string, unknown> = {}) {
  return new Promise<ExtensionResponse<T>>((resolve, reject) => {
    if (typeof window === 'undefined' || window.parent === window) {
      reject(new Error('Extension bridge unavailable'));
      return;
    }

    const requestId = `ext-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    const timeoutId = window.setTimeout(() => {
      window.removeEventListener('message', onMessage);
      reject(new Error('Extension request timed out'));
    }, 12000);

    function onMessage(event: MessageEvent) {
      if (event.source !== window.parent) return;
      const data = event.data as { type?: string; requestId?: string; ok?: boolean; error?: string };
      if (data?.type !== 'cf-drop-ext-response' || data.requestId !== requestId) return;
      window.clearTimeout(timeoutId);
      window.removeEventListener('message', onMessage);
      resolve(data as ExtensionResponse<T>);
    }

    window.addEventListener('message', onMessage);
    window.parent.postMessage({
      type: 'cf-drop-ext-request',
      requestId,
      action,
      payload,
    }, '*');
  });
}

function shouldHandleAppNavigation(event: React.MouseEvent<HTMLAnchorElement>) {
  return !event.defaultPrevented
    && event.button === 0
    && !event.metaKey
    && !event.altKey
    && !event.ctrlKey
    && !event.shiftKey;
}

const App = () => {
  const t = useT();
  const [locale, setLocale] = useLocale();
  const [themeMode, setThemeMode] = useThemeMode();
  const [currentPath, setCurrentPath] = useState<AppPath>(getCurrentAppPath);
  const isSharePath = currentPath === SHARE_PATH;
  const isPublicSharePath = typeof window !== 'undefined'
    && window.location.pathname.startsWith(`${SHARE_PATH}/`);
  const isExtensionMode = typeof window !== 'undefined'
    && new URLSearchParams(window.location.search).get('ext') === '1';
  const extensionLocale = typeof window !== 'undefined'
    ? resolveLocale(new URLSearchParams(window.location.search).get('extLocale'))
    : null;
  const extensionTheme = typeof window !== 'undefined'
    ? resolveThemeMode(new URLSearchParams(window.location.search).get('extTheme'))
    : null;

  useEffect(() => {
    if (!isExtensionMode || !extensionLocale) return;
    setLocale(extensionLocale);
  }, [extensionLocale, isExtensionMode, setLocale]);

  useEffect(() => {
    if (!isExtensionMode || !extensionTheme) return;
    setThemeMode(extensionTheme);
  }, [extensionTheme, isExtensionMode, setThemeMode]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const pathname = window.location.pathname;
    const resolvedPath = resolveAppPath(pathname);
    if (resolvedPath !== pathname && !pathname.startsWith(`${SHARE_PATH}/`)) {
      const shouldPreserveSearch = new URLSearchParams(window.location.search).get('ext') === '1';
      window.history.replaceState(null, '', getNavigationUrl(resolvedPath, shouldPreserveSearch));
    }
    setCurrentPath(resolvedPath);

    const onPopState = () => {
      setCurrentPath(getCurrentAppPath());
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigateApp = (path: AppPath) => {
    if (typeof window === 'undefined') return;
    if (window.location.pathname !== path) {
      window.history.pushState(null, '', getNavigationUrl(path, isExtensionMode));
    }
    setCurrentPath(path);
  };

  useEffect(() => {
    if (typeof document === 'undefined') return;

    const html = document.documentElement;
    const body = document.body;

    if (isExtensionMode) {
      html.dataset.extMode = '1';
      body.dataset.extMode = '1';
    } else {
      delete html.dataset.extMode;
      delete body.dataset.extMode;
    }

    return () => {
      delete html.dataset.extMode;
      delete body.dataset.extMode;
    };
  }, [isExtensionMode]);

  useEffect(() => {
    if (!isExtensionMode) return;

    const onMessage = (event: MessageEvent) => {
      if (event.source !== window.parent) return;
      const type = String(event.data?.type || '');
      if (type === 'cf-drop-ext-theme-toggle') {
        setThemeMode(getNextThemeMode(themeMode));
        return;
      }
      if (type === 'cf-drop-ext-theme-set') {
        const nextTheme = resolveThemeMode(event.data?.theme);
        if (nextTheme) {
          setThemeMode(nextTheme);
        }
        return;
      }
      if (type === 'cf-drop-ext-logout') {
        void logout();
      }
    };

    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [isExtensionMode, setThemeMode, themeMode]);

  useEffect(() => {
    if (!isExtensionMode || typeof window === 'undefined' || window.parent === window) return;
    window.parent.postMessage({
      type: 'cf-drop-ext-locale-set',
      locale,
    }, '*');
  }, [isExtensionMode, locale]);

  useEffect(() => {
    if (!isExtensionMode || typeof window === 'undefined' || window.parent === window) return;
    window.parent.postMessage({
      type: 'cf-drop-ext-theme-set',
      theme: themeMode,
      themeMode,
    }, '*');
  }, [isExtensionMode, themeMode]);

  return (
    <div className={`app-root${isExtensionMode ? ' is-extension-mode' : ''}${isPublicSharePath ? ' is-share-page' : ''}`}>
      <GlobalMessage />

      {!isPublicSharePath && (
        <div className="app-topbar">
          <div className="app-topbar-content">
            <div className="app-topbar-inner">
              <a
                href={HOME_PATH}
                className="app-brand"
                aria-label="cf-drop"
                onClick={(event) => {
                  if (!shouldHandleAppNavigation(event)) return;
                  event.preventDefault();
                  navigateApp(HOME_PATH);
                }}
              >
                cf-drop
              </a>
              <nav className="app-nav" aria-label={t('topbar.navAria')}>
                <TopbarNavLink
                  href={HOME_PATH}
                  active={currentPath === HOME_PATH}
                  onNavigate={navigateApp}
                >
                  {t('topbar.home')}
                </TopbarNavLink>
                <TopbarNavLink
                  href={SHARE_PATH}
                  active={currentPath === SHARE_PATH}
                  onNavigate={navigateApp}
                >
                  {t('topbar.share')}
                </TopbarNavLink>
                <TopbarNavLink
                  href={SETTINGS_PATH}
                  active={currentPath === SETTINGS_PATH}
                  onNavigate={navigateApp}
                >
                  {t('topbar.manage')}
                </TopbarNavLink>
              </nav>
            </div>
            <div className="app-controls" aria-label={t('topbar.actionsAria')}>
              <LanguageSwitcher />
              <ThemeSwitcher />
              <LogoutButton />
            </div>
          </div>
        </div>
      )}

      <main className="app-shell">
        {currentPath === SETTINGS_PATH ? (
          <SettingsPage isExtensionMode={isExtensionMode} />
        ) : currentPath === SHARE_PATH ? (
          <SharePage />
        ) : (
          <>
            <section className="workspace-panel">
              <SimpleProgressBar />
              <ContentInput />
            </section>

            <UploadRecords />
          </>
        )}
      </main>
      <div className="app-grain" aria-hidden="true" />
      <div className="app-ruler" aria-hidden="true" />
      <div className="app-orb app-orb-top" aria-hidden="true" />
      <div className="app-orb app-orb-bottom" aria-hidden="true" />
      <div className="app-fade" aria-hidden="true" />
      {!isPublicSharePath && <PasswordInput />}
    </div>
  );
};

function TopbarNavLink({
  href,
  active,
  onNavigate,
  children,
}: {
  href: AppPath;
  active: boolean;
  onNavigate: (path: AppPath) => void;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      className={`app-nav-link ${active ? 'is-active' : ''}`}
      aria-current={active ? 'page' : undefined}
      onClick={(event) => {
        if (!shouldHandleAppNavigation(event)) return;
        event.preventDefault();
        onNavigate(href);
      }}
    >
      {children}
    </a>
  );
}

function LanguageSwitcher() {
  const t = useT();
  const [locale, setLocale] = useLocale();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuWrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!menuOpen) return;

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!menuWrapRef.current?.contains(target)) {
        setMenuOpen(false);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [menuOpen]);

  return (
    <div className="topbar-option-wrap" ref={menuWrapRef}>
      <button
        ref={triggerRef}
        type="button"
        className={`theme-trigger language-trigger ${menuOpen ? 'is-open' : ''}`}
        aria-label={t('language.switchAria')}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        title={t('language.switchAria')}
        onClick={() => setMenuOpen((open) => !open)}
      >
        <i className="i-lucide-languages theme-trigger-icon" aria-hidden="true" />
      </button>

      {menuOpen && (
        <div className="topbar-option-menu" role="menu" aria-label={t('language.switchAria')}>
          {localeOptions.map((item) => (
            <button
              key={item.code}
              type="button"
              className={`topbar-option-item ${locale === item.code ? 'is-active' : ''}`}
              role="menuitemradio"
              aria-checked={locale === item.code}
              onClick={() => {
                setLocale(item.code);
                setMenuOpen(false);
                triggerRef.current?.focus();
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ThemeSwitcher() {
  const t = useT();
  const [themeMode, setThemeMode] = useThemeMode();
  const icon = themeMode === 'dark'
    ? 'i-lucide-moon'
    : themeMode === 'light'
      ? 'i-lucide-sun'
      : 'i-lucide-monitor';
  const themeLabel = themeMode === 'system'
    ? t('theme.system')
    : themeMode === 'light'
      ? t('theme.light')
      : t('theme.dark');

  return (
    <div className="topbar-option-wrap">
      <button
        type="button"
        className="theme-trigger"
        aria-label={t('theme.switchAria')}
        title={themeLabel}
        onClick={() => setThemeMode(getNextThemeMode(themeMode))}
      >
        <i className={`${icon} theme-trigger-icon`} />
      </button>
    </div>
  );
}

function SharePage() {
  const t = useT();
  const [previewImage, setPreviewImage] = useState<{ src: string; name: string } | null>(null);
  const [shared, setShared] = useState<SharedRecordResponse | null>(null);
  const [sharedPages, setSharedPages] = useState<SharedRecordResponse[][]>([]);
  const [countData, setCountData] = useState<ShareCountResponse | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [status, setStatus] = useState<'idle' | 'loading' | 'not-found' | 'error'>('idle');
  const [listStatus, setListStatus] = useState<'loading' | 'idle' | 'error'>('loading');
  const slug = typeof window !== 'undefined'
    ? decodeURIComponent(window.location.pathname.slice(`${SHARE_PATH}/`.length).replace(/^\/+|\/+$/g, ''))
    : '';

  useEffect(() => {
    if (!previewImage) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setPreviewImage(null);
      }
    };

    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [previewImage]);

  const openImagePreview = (src: string, name: string) => {
    setPreviewImage({ src, name });
  };
  const closeImagePreview = () => {
    setPreviewImage(null);
  };
  const sharePreviewImage = () => {
    if (!previewImage) return;
    const absoluteUrl = new URL(previewImage.src, window.location.origin).toString();
    void copyToClipboard(absoluteUrl).then((copied) => {
      showGlobalMessage({
        type: copied ? 'success' : 'error',
        text: copied ? t('toast.copySuccess') : t('toast.copyFailed'),
      });
    });
  };

  useEffect(() => {
    if (!slug) return;

    let disposed = false;
    setStatus('loading');
    setShared(null);

    fetch(`/api/share/${encodeURIComponent(slug)}`)
      .then((res) => {
        if (res.status === 404) {
          if (!disposed) setStatus('not-found');
          return null;
        }
        if (!res.ok) throw new Error('share load failed');
        return res.json() as Promise<SharedRecordResponse>;
      })
      .then((nextShared) => {
        if (disposed || !nextShared) return;
        setShared(nextShared);
        setStatus('idle');
      })
      .catch(() => {
        if (!disposed) setStatus('error');
      });

    return () => {
      disposed = true;
    };
  }, [slug]);

  useEffect(() => {
    if (slug) return;

    let disposed = false;
    setListStatus('loading');
    setSharedPages([]);
    setCountData(null);
    setCurrentPage(1);

    Promise.all([
      fetchAPI('/api/share/list/count').then((res) => res.json() as Promise<ShareCountResponse>),
      fetchAPI('/api/share/list').then((res) => res.json() as Promise<SharedRecordResponse[]>),
    ])
      .then(([nextCount, firstPage]) => {
        if (disposed) return;
        setCountData(nextCount);
        setSharedPages([firstPage]);
        setListStatus('idle');
      })
      .catch(() => {
        if (!disposed) setListStatus('error');
      });

    return () => {
      disposed = true;
    };
  }, [slug]);

  const totalPages = countData?.totalPages || 0;
  const visiblePage = sharedPages[currentPage - 1] || [];
  const displayCurrentPage = totalPages === 0 ? 0 : Math.min(currentPage, totalPages);
  const isListLoading = !slug && listStatus === 'loading';
  const isListError = !slug && listStatus === 'error';

  const handlePrevPage = () => {
    setCurrentPage((prev) => Math.max(1, prev - 1));
  };
  const handleNextPage = () => {
    if (!totalPages || currentPage >= totalPages) return;
    const targetPage = currentPage + 1;
    if (sharedPages.length >= targetPage) {
      setCurrentPage(targetPage);
      return;
    }

    const prevPage = sharedPages[sharedPages.length - 1] || [];
    const cursor = prevPage.at(-1);
    if (!cursor) return;

    const params = new URLSearchParams({
      beforeCtime: String(cursor.share.ctime),
      beforeSlug: cursor.share.slug,
    });
    setListStatus('loading');
    fetchAPI(`/api/share/list?${params.toString()}`)
      .then((res) => res.json() as Promise<SharedRecordResponse[]>)
      .then((nextPage) => {
        setSharedPages((prev) => [...prev, nextPage]);
        setCurrentPage(targetPage);
        setListStatus('idle');
      })
      .catch(() => setListStatus('error'));
  };
  const handleDeleteShare = (shareSlug: string) => {
    return fetchAPI('/api/share/delete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ slug: shareSlug }),
    })
      .then((res) => {
        if (!res.ok) throw new Error('share delete failed');
        setSharedPages((prev) => {
          const nextPages = prev.map((page) => page.filter((item) => item.share.slug !== shareSlug));
          const activePage = nextPages[currentPage - 1] || [];
          if (!activePage.length && currentPage > 1) {
            setCurrentPage(currentPage - 1);
          }
          return nextPages;
        });
        setCountData((prev) => {
          if (!prev) return prev;
          const total = Math.max(0, prev.total - 1);
          return {
            ...prev,
            total,
            totalPages: Math.ceil(total / prev.pageSize),
          };
        });
        showGlobalMessage({
          type: 'success',
          text: t('share.deleteSuccess'),
        });
      })
      .catch((err) => {
        showGlobalMessage({
          type: 'error',
          text: t('share.deleteFailed'),
        });
        throw err;
      });
  };
  const previewOverlay = previewImage && typeof document !== 'undefined'
    ? createPortal(
      <div className="image-preview-mask" onClick={closeImagePreview} role="dialog" aria-modal="true" aria-label={previewImage.name}>
        <div className="image-preview-dialog" onClick={(event) => event.stopPropagation()}>
          <button
            type="button"
            className="image-preview-close"
            aria-label={t('records.previewCloseAria')}
            onClick={closeImagePreview}
          >
            <i className="i-lucide-x theme-trigger-icon" />
          </button>
          <img src={previewImage.src} alt={previewImage.name} className="image-preview-img" />
        </div>
        <div className="image-preview-actions" onClick={(event) => event.stopPropagation()}>
          <a
            href={previewImage.src}
            download={previewImage.name}
            className="image-preview-action"
            aria-label={t('records.previewDownloadAria')}
          >
            <i className="i-lucide-download image-preview-action-icon" />
          </a>
          <button
            type="button"
            className="image-preview-action"
            aria-label={t('records.previewShareAria')}
            onClick={sharePreviewImage}
          >
            <i className="i-lucide-share-2 image-preview-action-icon" />
          </button>
        </div>
      </div>,
      document.body,
    )
    : null;

  return (
    <>
      {!slug && (
        <section className="records-panel share-records-panel">
          <div className="records-list">
            {isListError && (
              <div className="records-error">
                {t('common.errorWithMessage', { message: t('share.loadFailed') })}
              </div>
            )}
            {isListLoading && !visiblePage.length && (
              <div className="records-loading" role="status" aria-live="polite">
                <span className="records-loading-dot" aria-hidden="true" />
                <span>{t('records.loading')}</span>
              </div>
            )}
            {!isListLoading && !isListError && totalPages === 0 && visiblePage.length === 0 && (
              <div className="records-empty">{t('share.empty')}</div>
            )}
            {visiblePage.length > 0 && (
              <div className="records-page">
                {visiblePage.map((item) => (
                  <UploadRecordCard
                    key={item.share.slug}
                    record={item.record}
                    onPreviewImage={openImagePreview}
                    mode="share"
                    shareSlug={item.share.slug}
                    shareCreatedAt={item.share.ctime}
                    onDeleteShare={handleDeleteShare}
                  />
                ))}
              </div>
            )}
          </div>
          <div className="records-pagination-wrap">
            <div className="records-pagination" role="navigation" aria-label={t('records.paginationAria')}>
              <button
                type="button"
                className="records-page-btn"
                onClick={handlePrevPage}
                aria-label={t('records.paginationPrev')}
                title={t('records.paginationPrev')}
                disabled={currentPage <= 1 || isListLoading}
              >
                <i className="i-lucide-chevron-left records-page-btn-icon" />
              </button>
              <span className="records-pagination-status">
                {t('records.paginationLabel', { current: displayCurrentPage, total: totalPages })}
              </span>
              <button
                type="button"
                className="records-page-btn"
                onClick={handleNextPage}
                aria-label={t('records.paginationNext')}
                title={t('records.paginationNext')}
                disabled={!totalPages || currentPage >= totalPages || isListLoading}
              >
                <i className="i-lucide-chevron-right records-page-btn-icon" />
              </button>
            </div>
          </div>
        </section>
      )}
      {!!slug && status === 'loading' && (
        <section className="records-panel">
          <div className="records-list">
            <div className="records-loading" role="status" aria-live="polite">
              <span className="records-loading-dot" aria-hidden="true" />
              <span>{t('share.loading')}</span>
            </div>
          </div>
        </section>
      )}
      {!!slug && status === 'not-found' && (
        <section className="records-panel">
          <div className="records-list">
            <div className="records-empty">{t('share.notFound')}</div>
          </div>
        </section>
      )}
      {!!slug && status === 'error' && (
        <section className="records-panel">
          <div className="records-list">
            <div className="records-error">
              {t('common.errorWithMessage', { message: t('share.loadFailed') })}
            </div>
          </div>
        </section>
      )}
      {!!shared && (
        <UploadRecordCard
          record={shared.record}
          onPreviewImage={openImagePreview}
          mode="share"
          shareCreatedAt={shared.share.ctime}
        />
      )}
      {previewOverlay}
    </>
  );
}

function SettingsPage({ isExtensionMode }: { isExtensionMode: boolean }) {
  const {
    lightBgColor,
    darkBgColor,
    setLightBgColor,
    setDarkBgColor,
  } = useBackgroundColors();
  const t = useT();
  const [lightBgInput, setLightBgInput] = useState(lightBgColor);
  const [darkBgInput, setDarkBgInput] = useState(darkBgColor);

  useEffect(() => {
    setLightBgInput(lightBgColor);
  }, [lightBgColor]);

  useEffect(() => {
    setDarkBgInput(darkBgColor);
  }, [darkBgColor]);

  return (
    <>
      <section className="records-panel settings-panel">
        <div className="records-list">
          <div className="settings-section">
            <div className="settings-row">
              <label className="settings-row-label" htmlFor="settings-light-bg">
                {t('settings.lightBgTitle')}
              </label>
              <div className="settings-color-wrap">
                <input
                  id="settings-light-bg"
                  type="color"
                  className="settings-color-input"
                  value={lightBgColor}
                  onChange={(event) => {
                    const nextColor = normalizeHexColor(event.target.value, lightBgColor);
                    setLightBgInput(nextColor);
                    setLightBgColor(nextColor);
                  }}
                />
                <input
                  type="text"
                  className="settings-color-text"
                  value={lightBgInput}
                  spellCheck={false}
                  inputMode="text"
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    setLightBgInput(nextValue);
                    const nextColor = normalizeHexColor(nextValue, '');
                    if (nextColor) setLightBgColor(nextColor);
                  }}
                  onBlur={() => setLightBgInput(lightBgColor)}
                />
              </div>
            </div>
            <div className="settings-row">
              <label className="settings-row-label" htmlFor="settings-dark-bg">
                {t('settings.darkBgTitle')}
              </label>
              <div className="settings-color-wrap">
                <input
                  id="settings-dark-bg"
                  type="color"
                  className="settings-color-input"
                  value={darkBgColor}
                  onChange={(event) => {
                    const nextColor = normalizeHexColor(event.target.value, darkBgColor);
                    setDarkBgInput(nextColor);
                    setDarkBgColor(nextColor);
                  }}
                />
                <input
                  type="text"
                  className="settings-color-text"
                  value={darkBgInput}
                  spellCheck={false}
                  inputMode="text"
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    setDarkBgInput(nextValue);
                    const nextColor = normalizeHexColor(nextValue, '');
                    if (nextColor) setDarkBgColor(nextColor);
                  }}
                  onBlur={() => setDarkBgInput(darkBgColor)}
                />
              </div>
            </div>
          </div>
        </div>
      </section>
      {isExtensionMode && <ExtensionInstancesPanel />}
    </>
  );
}

function ExtensionInstancesPanel() {
  const t = useT();
  const [config, setConfig] = useState<ExtensionConfig | null>(null);
  const [status, setStatus] = useState<{ text: string; isError?: boolean } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isBusy, setIsBusy] = useState(false);
  const [editingId, setEditingId] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [baseUrlInput, setBaseUrlInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');

  const resetForm = () => {
    setEditingId('');
    setNameInput('');
    setBaseUrlInput('');
    setPasswordInput('');
  };

  const loadConfig = () => {
    setIsLoading(true);
    sendExtensionRequest('ext:listInstances')
      .then((res) => {
        if (!res.ok || !res.config) throw new Error(res.error || 'load failed');
        setConfig(res.config);
        setStatus(null);
      })
      .catch((err) => {
        setStatus({ text: t('settings.instancesLoadFailed', { message: String(err?.message || err) }), isError: true });
      })
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    loadConfig();
  }, []);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const payload = {
      id: editingId || undefined,
      name: nameInput.trim(),
      baseUrl: baseUrlInput.trim(),
      password: passwordInput,
    };

    if (!payload.name || !payload.baseUrl) {
      setStatus({ text: t('settings.instancesRequired'), isError: true });
      return;
    }

    setIsBusy(true);
    sendExtensionRequest('ext:upsertInstance', payload)
      .then((res) => {
        if (!res.ok || !res.config) throw new Error(res.error || 'save failed');
        setConfig(res.config);
        resetForm();
        setStatus({ text: t('settings.instancesSaveSuccess') });
      })
      .catch((err) => {
        setStatus({ text: t('settings.instancesSaveFailed', { message: String(err?.message || err) }), isError: true });
      })
      .finally(() => setIsBusy(false));
  };

  const testConnection = (baseUrlInputValue: string, passwordInputValue: string) => {
    const baseUrl = baseUrlInputValue.trim();
    if (!baseUrl) {
      setStatus({ text: t('settings.instancesTestRequired'), isError: true });
      return;
    }
    setIsBusy(true);
    setStatus({ text: t('settings.instancesTesting') });
    sendExtensionRequest<{ total: number }>('ext:testConnection', {
      baseUrl,
      password: passwordInputValue,
    })
      .then((res) => {
        if (!res.ok || !res.result) throw new Error(res.error || 'test failed');
        setStatus({ text: t('settings.instancesTestSuccess', { total: Number(res.result.total || 0) }) });
      })
      .catch((err) => {
        setStatus({ text: t('settings.instancesTestFailed', { message: String(err?.message || err) }), isError: true });
      })
      .finally(() => setIsBusy(false));
  };

  const handleTestCurrentForm = () => {
    testConnection(baseUrlInput, passwordInput);
  };

  const handleEditInstance = (item: ExtensionInstance) => {
    setEditingId(item.id);
    setNameInput(item.name);
    setBaseUrlInput(item.baseUrl);
    setPasswordInput(item.password || '');
    setStatus(null);
  };

  const handleSetActive = (id: string) => {
    setIsBusy(true);
    sendExtensionRequest('ext:setActiveInstance', { id })
      .then((res) => {
        if (!res.ok || !res.config) throw new Error(res.error || 'switch failed');
        setConfig(res.config);
        setStatus({ text: t('settings.instancesSwitchSuccess') });
      })
      .catch((err) => {
        setStatus({ text: t('settings.instancesSwitchFailed', { message: String(err?.message || err) }), isError: true });
      })
      .finally(() => setIsBusy(false));
  };

  const handleDeleteInstance = (item: ExtensionInstance) => {
    if (!window.confirm(t('settings.instancesDeleteConfirm', { name: item.name }))) return;
    setIsBusy(true);
    sendExtensionRequest('ext:removeInstance', { id: item.id })
      .then((res) => {
        if (!res.ok || !res.config) throw new Error(res.error || 'delete failed');
        setConfig(res.config);
        if (editingId === item.id) resetForm();
        setStatus({ text: t('settings.instancesDeleteSuccess') });
      })
      .catch((err) => {
        setStatus({ text: t('settings.instancesDeleteFailed', { message: String(err?.message || err) }), isError: true });
      })
      .finally(() => setIsBusy(false));
  };

  const instances = config?.instances || [];

  return (
    <section className="records-panel settings-panel settings-instances-panel">
      <div className="records-list">
        <div className="settings-section">
          <div className="settings-section-head">
            <h2 className="settings-section-title">{t('settings.instancesTitle')}</h2>
          </div>
          <form className="settings-instance-form" onSubmit={handleSubmit}>
            <input
              className="settings-instance-input"
              value={nameInput}
              placeholder={t('settings.instanceNamePlaceholder')}
              onChange={(event) => setNameInput(event.target.value)}
              disabled={isBusy}
            />
            <input
              className="settings-instance-input"
              value={baseUrlInput}
              type="url"
              placeholder={t('settings.instanceBaseUrlPlaceholder')}
              onChange={(event) => setBaseUrlInput(event.target.value)}
              disabled={isBusy}
            />
            <input
              className="settings-instance-input"
              value={passwordInput}
              type="password"
              placeholder={t('settings.instancePasswordPlaceholder')}
              onChange={(event) => setPasswordInput(event.target.value)}
              disabled={isBusy}
            />
            <div className="settings-instance-actions">
              <button className="btn btn-primary" type="submit" disabled={isBusy}>
                {t('settings.instanceSave')}
              </button>
              {!!editingId && (
                <button className="btn btn-ghost" type="button" onClick={resetForm} disabled={isBusy}>
                  {t('settings.instanceCancelEdit')}
                </button>
              )}
              <button className="btn btn-ghost" type="button" onClick={handleTestCurrentForm} disabled={isBusy}>
                {t('settings.instanceTest')}
              </button>
            </div>
          </form>

          {!!status?.text && (
            <div className={`settings-instance-status ${status.isError ? 'is-error' : ''}`} role="status" aria-live="polite">
              {status.text}
            </div>
          )}

          {isLoading ? (
            <div className="records-loading" role="status" aria-live="polite">
              <span className="records-loading-dot" aria-hidden="true" />
              <span>{t('records.loading')}</span>
            </div>
          ) : !instances.length ? (
            <div className="settings-instances-empty">{t('settings.instancesEmpty')}</div>
          ) : (
            <div className="settings-instances-list">
              {instances.map((item) => {
                const isActive = item.id === config?.activeInstanceId;
                return (
                  <article key={item.id} className={`settings-instance-item ${isActive ? 'is-active' : ''}`}>
                    <div className="settings-instance-main">
                      <div className="settings-instance-top">
                        <div className="settings-instance-name">{item.name}</div>
                        {isActive && <span className="settings-instance-tag">{t('settings.instanceCurrent')}</span>}
                      </div>
                      <div className="settings-instance-url">{item.baseUrl}</div>
                    </div>
                    <div className="settings-instance-row-actions">
                      <button className="btn btn-ghost" type="button" onClick={() => handleEditInstance(item)} disabled={isBusy}>
                        {t('settings.instanceEdit')}
                      </button>
                      <button className="btn btn-ghost" type="button" onClick={() => {
                        testConnection(item.baseUrl, item.password || '');
                      }} disabled={isBusy}>
                        {t('settings.instanceTest')}
                      </button>
                      {!isActive && (
                        <button className="btn btn-ghost" type="button" onClick={() => handleSetActive(item.id)} disabled={isBusy}>
                          {t('settings.instanceSetDefault')}
                        </button>
                      )}
                      <button className="btn btn-ghost btn-danger" type="button" onClick={() => handleDeleteInstance(item)} disabled={isBusy}>
                        {t('settings.instanceDelete')}
                      </button>
                      <a className="btn btn-ghost" href={item.baseUrl} target="_blank" rel="noreferrer">
                        {t('settings.instanceOpen')}
                      </a>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function LogoutButton() {
  const t = useT();
  const [password] = useAtom(passwordAtom);

  if (!password) return null;

  return (
    <button
      type="button"
      className="theme-trigger logout-trigger"
      aria-label={t('auth.logoutAria')}
      onClick={() => {
        void logout();
      }}
    >
      <i className="i-lucide-log-out theme-trigger-icon logout-trigger-icon" />
    </button>
  );
}

function SimpleProgressBar() {
  const [locale] = useLocale();
  const t = useT();
  const [progress] = useAtom(uploadingProgressAtom);
  const [error] = useAtom(uploadingErrorAtom);
  const translatedError = error ? tError(locale, error) : '';
  const showProgress = Boolean(error) || progress > 0;
  const lastNotifiedErrorRef = useRef<string | null>(null);

  useEffect(() => {
    if (!error) {
      lastNotifiedErrorRef.current = null;
      return;
    }
    if (lastNotifiedErrorRef.current === error) return;

    showGlobalMessage({
      type: 'error',
      text: t('toast.uploadErrorPrefix', { message: translatedError }),
      durationMs: 3200,
    });
    lastNotifiedErrorRef.current = error;
  }, [error, t, translatedError]);

  if (!showProgress) return null;

  return (
    <div className="progress-wrap">
      {!!error && (
        <div className="status-error">
          {t('common.errorWithMessage', { message: translatedError })}
        </div>
      )}
      <div className="progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)}>
        <div className="progress-value" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}

export default App;

function resolveThemeMode(input: unknown): ThemeMode | null {
  if (input === 'system' || input === 'light' || input === 'dark') {
    return input;
  }
  return null;
}

function getNextThemeMode(current: ThemeMode): ThemeMode {
  if (current === 'system') return 'light';
  if (current === 'light') return 'dark';
  return 'system';
}

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', 'true');
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    try {
      return document.execCommand('copy');
    } catch {
      return false;
    } finally {
      document.body.removeChild(textarea);
    }
  }
}

function GlobalMessage() {
  const t = useT();
  const [message] = useAtom(globalMessageAtom);
  const [renderedMessage, setRenderedMessage] = useState(message);
  const [isLeaving, setIsLeaving] = useState(false);
  const timerRef = useRef<number | null>(null);
  const timerStartRef = useRef<number>(0);
  const remainingMsRef = useRef<number>(0);

  const clearTimer = () => {
    if (timerRef.current === null) return;
    window.clearTimeout(timerRef.current);
    timerRef.current = null;
    timerStartRef.current = 0;
  };

  useEffect(() => {
    if (message) {
      setRenderedMessage(message);
      setIsLeaving(false);
      return;
    }

    if (!renderedMessage) return;

    clearTimer();
    setIsLeaving(true);
    const leaveTimer = window.setTimeout(() => {
      setRenderedMessage(null);
      setIsLeaving(false);
    }, 150);

    return () => window.clearTimeout(leaveTimer);
  }, [message, renderedMessage]);

  useEffect(() => {
    clearTimer();
    if (!renderedMessage || isLeaving) return;
    if (renderedMessage.durationMs <= 0) return;

    remainingMsRef.current = renderedMessage.durationMs;
    timerStartRef.current = Date.now();
    timerRef.current = window.setTimeout(() => {
      hideGlobalMessage(renderedMessage.id);
    }, remainingMsRef.current);

    return clearTimer;
  }, [isLeaving, renderedMessage]);

  useEffect(() => () => {
    clearTimer();
  }, []);

  if (!renderedMessage) return null;

  const iconClassName = renderedMessage.type === 'success'
    ? 'i-lucide-check-circle-2'
    : renderedMessage.type === 'error'
      ? 'i-lucide-circle-alert'
      : renderedMessage.type === 'warning'
        ? 'i-lucide-triangle-alert'
        : 'i-lucide-info';

  return (
    <div className="app-message-layer" aria-live={renderedMessage.type === 'error' ? 'assertive' : 'polite'}>
      <div
        className={`app-message app-message--${renderedMessage.type}${isLeaving ? ' is-leaving' : ''}`}
        role="status"
        onMouseEnter={() => {
          if (!renderedMessage.durationMs || isLeaving) return;
          const elapsed = timerStartRef.current ? Date.now() - timerStartRef.current : 0;
          remainingMsRef.current = Math.max(0, remainingMsRef.current - elapsed);
          clearTimer();
        }}
        onMouseLeave={() => {
          if (!renderedMessage.durationMs || isLeaving) return;
          if (remainingMsRef.current <= 0) {
            hideGlobalMessage(renderedMessage.id);
            return;
          }
          timerStartRef.current = Date.now();
          timerRef.current = window.setTimeout(() => {
            hideGlobalMessage(renderedMessage.id);
          }, remainingMsRef.current);
        }}
        onClick={() => {
          renderedMessage.onClick?.();
          hideGlobalMessage(renderedMessage.id);
        }}
      >
        <i className={`app-message-icon ${iconClassName}`} aria-hidden="true" />
        <span className="app-message-text">{renderedMessage.text}</span>
        <button
          type="button"
          className="app-message-close"
          aria-label={t('common.close')}
          onClick={(event) => {
            event.stopPropagation();
            hideGlobalMessage(renderedMessage.id);
          }}
        >
          <i className="i-lucide-x" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
