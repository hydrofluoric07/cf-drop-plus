import './App.scss';
import { ContentInput } from './components/ContentInput';
import { UploadRecords } from './components/UploadRecords';
import { PasswordInput } from './components/PasswordInput';
import { useAtom } from 'jotai';
import { uploadingErrorAtom, uploadingProgressAtom } from './store/uploading';
import { useLocale, useT } from './store/locale';
import { localeOptions, tError, resolveLocale } from './i18n';
import { useEffect, useId, useRef, useState } from 'react';
import { ThemeMode, useThemeMode } from './store/theme';
import { logout, passwordAtom } from './store/auth';
import { globalMessageAtom, hideGlobalMessage, showGlobalMessage } from './store';

const App = () => {
  const [, setLocale] = useLocale();
  const [themeMode, setThemeMode] = useThemeMode();
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

  return (
    <div className={`app-root${isExtensionMode ? ' is-extension-mode' : ''}`}>
      <GlobalMessage />

      {!isExtensionMode && (
        <div className="app-topbar">
          <div className="app-controls">
            <LanguageSwitcher />
            <ThemeSwitcher />
            <LogoutButton />
          </div>
        </div>
      )}

      <main className="app-shell">
        <section className="workspace-panel">
          <SimpleProgressBar />
          <ContentInput />
        </section>

        <UploadRecords />
      </main>
      <div className="app-grain" aria-hidden="true" />
      <div className="app-ruler" aria-hidden="true" />
      <div className="app-orb app-orb-top" aria-hidden="true" />
      <div className="app-orb app-orb-bottom" aria-hidden="true" />
      <div className="app-fade" aria-hidden="true" />
      <PasswordInput />
    </div>
  );
};

function LanguageSwitcher() {
  const [locale, setLocale] = useLocale();
  const t = useT();
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listboxId = useId();

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!wrapperRef.current?.contains(target)) {
        setOpen(false);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div className="locale-picker" ref={wrapperRef}>
      <button
        ref={triggerRef}
        type="button"
        className={`locale-trigger ${open ? 'is-open' : ''}`}
        aria-label={t('language.switchAria')}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        onClick={() => setOpen((v) => !v)}
      >
        <i className="i-lucide-languages locale-trigger-icon" />
      </button>

      {open && (
        <div id={listboxId} role="listbox" className="locale-menu">
          {localeOptions.map((item) => (
            <button
              key={item.code}
              type="button"
              role="option"
              className={`locale-option ${item.code === locale ? 'is-active' : ''}`}
              aria-selected={item.code === locale}
              onClick={() => {
                setLocale(item.code);
                setOpen(false);
                triggerRef.current?.focus();
              }}
            >
              <span className="locale-option-label">{item.label}</span>
              {item.code === locale && <i className="i-lucide-check locale-option-check" />}
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

  return (
    <button
      type="button"
      className="theme-trigger"
      aria-label={t('theme.switchAria')}
      title={
        themeMode === 'system'
          ? t('theme.system')
          : themeMode === 'light'
            ? t('theme.light')
            : t('theme.dark')
      }
      onClick={() => setThemeMode(getNextThemeMode(themeMode))}
    >
      <i className={`${icon} theme-trigger-icon`} />
    </button>
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
