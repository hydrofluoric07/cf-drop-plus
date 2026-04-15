import './App.scss';
import { ContentInput } from './components/ContentInput';
import { UploadRecords } from './components/UploadRecords';
import { PasswordInput } from './components/PasswordInput';
import { useAtom } from 'jotai';
import { uploadingErrorAtom, uploadingProgressAtom } from './store/uploading';
import { useLocale, useT } from './store/locale';
import { localeOptions, tError } from './i18n';
import { useEffect, useId, useRef, useState } from 'react';
import { useThemeMode } from './store/theme';

const App = () => {
  return (
    <div className="app-root">
      <div className="app-topbar">
        <div className="app-controls">
          <LanguageSwitcher />
          <ThemeSwitcher />
        </div>
      </div>

      <main className="app-shell">
        <section className="workspace-panel">
          <SimpleProgressBar />
          <ContentInput />
        </section>

        <section className="records-panel withScrollbar">
          <UploadRecords />
        </section>
      </main>
      <div className="app-grain" aria-hidden="true" />
      <div className="app-ruler" aria-hidden="true" />
      <div className="app-orb app-orb-top" aria-hidden="true" />
      <div className="app-orb app-orb-bottom" aria-hidden="true" />
      <div className="app-border" aria-hidden="true" />
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
  const icon = themeMode === 'dark' ? 'i-lucide-moon' : 'i-lucide-sun';
  const nextMode = themeMode === 'dark' ? 'light' : 'dark';

  return (
    <button
      type="button"
      className="theme-trigger"
      aria-label={t('theme.switchAria')}
      onClick={() => setThemeMode(nextMode)}
    >
      <i className={`${icon} theme-trigger-icon`} />
    </button>
  );
}

function SimpleProgressBar() {
  const [locale] = useLocale();
  const t = useT();
  const [progress] = useAtom(uploadingProgressAtom);
  const [error] = useAtom(uploadingErrorAtom);
  const translatedError = error ? tError(locale, error) : '';

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
