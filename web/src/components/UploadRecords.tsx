import { memo, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import useSWRInfinite from 'swr/infinite';
import useSWR from 'swr';
import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';

import type { RecordFilterType, UploadRecord } from '../../../src/database';
import { fetchAPI } from '../store/auth';
import { PopoverConfirm } from './PopoverConfirm';
import { useLocale, useT } from '../store/locale';
import { tError, type TranslationKey } from '../i18n';

const recordTypeOptions: Array<{ value: RecordFilterType; labelKey: 'records.filterTypeAll' | 'records.filterTypeText' | 'records.filterTypeImage' | 'records.filterTypeDocument' | 'records.filterTypeArchive' | 'records.filterTypeAudio' | 'records.filterTypeOther' }> = [
  { value: 'all', labelKey: 'records.filterTypeAll' },
  { value: 'text', labelKey: 'records.filterTypeText' },
  { value: 'image', labelKey: 'records.filterTypeImage' },
  { value: 'document', labelKey: 'records.filterTypeDocument' },
  { value: 'archive', labelKey: 'records.filterTypeArchive' },
  { value: 'audio', labelKey: 'records.filterTypeAudio' },
  { value: 'other', labelKey: 'records.filterTypeOther' },
];

type UploaderDeviceType = 'windows' | 'macos' | 'linux' | 'ios' | 'android' | 'ipados' | 'unknown';

const uploaderDeviceLabelKeys: Record<UploaderDeviceType, TranslationKey> = {
  windows: 'records.deviceWindows',
  macos: 'records.deviceMacos',
  linux: 'records.deviceLinux',
  ios: 'records.deviceIos',
  android: 'records.deviceAndroid',
  ipados: 'records.deviceIpados',
  unknown: 'records.deviceUnknown',
};

const uploaderDeviceIcons: Record<UploaderDeviceType, string> = {
  windows: 'i-lucide-monitor',
  macos: 'i-lucide-laptop',
  linux: 'i-lucide-terminal',
  ios: 'i-lucide-smartphone',
  android: 'i-lucide-smartphone',
  ipados: 'i-lucide-tablet',
  unknown: 'i-lucide-circle-help',
};

interface RecordCountResponse {
  total: number;
  pageSize: number;
  totalPages: number;
}

export const UploadRecords = memo(() => {
  const [locale] = useLocale();
  const t = useT();
  const [previewImage, setPreviewImage] = useState<{ src: string; name: string } | null>(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [dateMenuOpen, setDateMenuOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<RecordFilterType>('all');
  const [typeMenuOpen, setTypeMenuOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [calendarCursor, setCalendarCursor] = useState(() => dayjs().startOf('month'));
  const dateMenuWrapRef = useRef<HTMLDivElement>(null);
  const dateMenuTriggerRef = useRef<HTMLButtonElement>(null);
  const typeMenuWrapRef = useRef<HTMLDivElement>(null);
  const typeMenuTriggerRef = useRef<HTMLButtonElement>(null);
  const dateMenuId = useId();
  const typeMenuId = useId();

  const dateRange = useMemo(() => {
    if (!selectedDate) return null;
    const start = dayjs(selectedDate, 'YYYY-MM-DD');
    if (!start.isValid()) return null;
    return {
      from: start.startOf('day').valueOf(),
      to: start.add(1, 'day').startOf('day').valueOf(),
    };
  }, [selectedDate]);

  const filterSearch = useMemo(() => {
    const params = new URLSearchParams();
    if (selectedType !== 'all') params.set('recordType', selectedType);
    if (dateRange) {
      params.set('dateFrom', String(dateRange.from));
      params.set('dateTo', String(dateRange.to));
    }
    return params;
  }, [dateRange, selectedType]);

  const countKey = useMemo(() => {
    const query = filterSearch.toString();
    return query ? `/api/list/count?${query}` : '/api/list/count';
  }, [filterSearch]);

  const { data: countData, mutate: mutateCount } = useSWR(
    countKey,
    (url: string) => fetchAPI(url).then((res) => res.json() as Promise<RecordCountResponse>),
  );

  // all records. newest first
  const { data, error, isLoading, isValidating, mutate, setSize } = useSWRInfinite(
    (pageIndex, previousPage?: UploadRecord[]) => {
      if (pageIndex > 0 && previousPage && !previousPage.length) return null;

      const params = new URLSearchParams(filterSearch);
      if (pageIndex > 0) {
        const beforeId = previousPage?.at(-1)?.id;
        if (!beforeId) return null;
        params.set('beforeId', String(beforeId));
      }

      const query = params.toString();
      return query ? `/api/list?${query}` : '/api/list';
    },
    (url: string) => fetchAPI(url).then((res) => res.json() as Promise<UploadRecord[]>),
  );

  useEffect(() => {
    dayjs.locale(locale === 'zh-CN' ? 'zh-cn' : 'en');
  }, [locale]);

  useEffect(() => {
    const refresh = () => {
      mutate();
      mutateCount();
    };
    window.addEventListener('records-updated', refresh);
    return () => window.removeEventListener('records-updated', refresh);
  }, [mutate, mutateCount]);

  useEffect(() => {
    setCurrentPage(1);
    void setSize(1);
  }, [countKey, setSize]);

  useEffect(() => {
    if (!typeMenuOpen && !dateMenuOpen) return;

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      const clickInTypeMenu = typeMenuWrapRef.current?.contains(target);
      const clickInDateMenu = dateMenuWrapRef.current?.contains(target);
      if (!clickInTypeMenu && !clickInDateMenu) {
        setTypeMenuOpen(false);
        setDateMenuOpen(false);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (dateMenuOpen) {
          setDateMenuOpen(false);
          dateMenuTriggerRef.current?.focus();
        }
        if (typeMenuOpen) {
          setTypeMenuOpen(false);
          typeMenuTriggerRef.current?.focus();
        }
      }
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [dateMenuOpen, typeMenuOpen]);

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

  const openImagePreview = useCallback((src: string, name: string) => {
    setPreviewImage({ src, name });
  }, []);

  const closeImagePreview = useCallback(() => {
    setPreviewImage(null);
  }, []);

  const sharePreviewImage = useCallback(() => {
    if (!previewImage) return;
    const absoluteUrl = new URL(previewImage.src, window.location.origin).toString();
    void copyToClipboard(absoluteUrl);
  }, [previewImage]);

  const totalPages = countData?.totalPages || 0;
  const visiblePage = data?.[currentPage - 1] || [];
  const displayCurrentPage = totalPages === 0 ? 0 : Math.min(currentPage, totalPages);
  const selectedDateValue = useMemo(() => {
    if (!selectedDate) return null;
    const value = dayjs(selectedDate, 'YYYY-MM-DD');
    return value.isValid() ? value : null;
  }, [selectedDate]);
  const dateTriggerLabel = selectedDateValue ? selectedDateValue.format('YYYY-MM-DD') : t('records.filterDateAll');
  const selectedTypeOption = useMemo(
    () => recordTypeOptions.find((item) => item.value === selectedType) || recordTypeOptions[0],
    [selectedType],
  );
  const dateWeekLabels = locale === 'zh-CN'
    ? ['日', '一', '二', '三', '四', '五', '六']
    : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dateMenuMonthLabel = calendarCursor.format(locale === 'zh-CN' ? 'YYYY年M月' : 'MMMM YYYY');
  const calendarDays = useMemo(() => {
    const monthStart = calendarCursor.startOf('month');
    const gridStart = monthStart.subtract(monthStart.day(), 'day');
    return Array.from({ length: 42 }, (_, index) => {
      const value = gridStart.add(index, 'day');
      const isCurrentMonth = value.month() === calendarCursor.month();
      const isToday = value.isSame(dayjs(), 'day');
      const isSelected = selectedDateValue ? value.isSame(selectedDateValue, 'day') : false;
      return {
        key: value.format('YYYY-MM-DD'),
        value,
        day: value.date(),
        isCurrentMonth,
        isToday,
        isSelected,
      };
    });
  }, [calendarCursor, selectedDateValue]);

  useEffect(() => {
    if (!totalPages) {
      if (currentPage !== 1) setCurrentPage(1);
      return;
    }
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const handlePrevPage = useCallback(() => {
    setCurrentPage((prev) => Math.max(1, prev - 1));
  }, []);

  const handleNextPage = useCallback(() => {
    if (!totalPages || currentPage >= totalPages) return;
    const targetPage = currentPage + 1;
    if (data && data.length >= targetPage) {
      setCurrentPage(targetPage);
      return;
    }
    void setSize(targetPage).then(() => {
      setCurrentPage(targetPage);
    });
  }, [currentPage, data, setSize, totalPages]);
  const handleRefresh = useCallback(() => {
    setDateMenuOpen(false);
    setTypeMenuOpen(false);
    setCurrentPage(1);
    void setSize(1).then(() => {
      void mutate();
      void mutateCount();
    });
  }, [mutate, mutateCount, setSize]);
  const toggleDateMenu = useCallback(() => {
    setTypeMenuOpen(false);
    setDateMenuOpen((prev) => {
      const next = !prev;
      if (next) {
        const base = selectedDateValue || dayjs();
        setCalendarCursor(base.startOf('month'));
      }
      return next;
    });
  }, [selectedDateValue]);
  const applyDate = useCallback((value: dayjs.Dayjs) => {
    setSelectedDate(value.format('YYYY-MM-DD'));
    setDateMenuOpen(false);
    dateMenuTriggerRef.current?.focus();
  }, []);
  const clearDate = useCallback(() => {
    setSelectedDate('');
    setDateMenuOpen(false);
    dateMenuTriggerRef.current?.focus();
  }, []);

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
      <div className="records-toolbar">
        <div className="records-filters">
          <label className="records-filter-field">
            <span className="sr-only">{t('records.filterDateAria')}</span>
            <div className="records-filter-select-wrap records-date-picker-wrap" ref={dateMenuWrapRef}>
              <button
                ref={dateMenuTriggerRef}
                type="button"
                className={`records-filter-control records-filter-date-btn ${dateMenuOpen ? 'is-open' : ''}`}
                aria-label={t('records.filterDateAria')}
                aria-haspopup="dialog"
                aria-expanded={dateMenuOpen}
                aria-controls={dateMenuId}
                onClick={toggleDateMenu}
              >
                <span className={`records-filter-date-label ${selectedDateValue ? '' : 'is-placeholder'}`}>{dateTriggerLabel}</span>
                <i className="i-lucide-calendar records-filter-date-icon" aria-hidden="true" />
              </button>
              {dateMenuOpen && (
                <div id={dateMenuId} role="dialog" className="records-date-menu" aria-label={t('records.filterDateAria')}>
                  <div className="records-date-menu-head">
                    <button
                      type="button"
                      className="records-date-nav-btn"
                      aria-label={t('records.filterDatePrevMonthAria')}
                      onClick={() => setCalendarCursor((prev) => prev.subtract(1, 'month'))}
                    >
                      <i className="i-lucide-chevron-left" />
                    </button>
                    <div className="records-date-title">{dateMenuMonthLabel}</div>
                    <button
                      type="button"
                      className="records-date-nav-btn"
                      aria-label={t('records.filterDateNextMonthAria')}
                      onClick={() => setCalendarCursor((prev) => prev.add(1, 'month'))}
                    >
                      <i className="i-lucide-chevron-right" />
                    </button>
                  </div>
                  <div className="records-date-weekdays" aria-hidden="true">
                    {dateWeekLabels.map((label) => (
                      <span key={label} className="records-date-weekday">{label}</span>
                    ))}
                  </div>
                  <div className="records-date-grid">
                    {calendarDays.map((item) => (
                      <button
                        key={item.key}
                        type="button"
                        className={`records-date-cell ${item.isCurrentMonth ? '' : 'is-outside'} ${item.isToday ? 'is-today' : ''} ${item.isSelected ? 'is-selected' : ''}`}
                        onClick={() => applyDate(item.value)}
                      >
                        <span>{item.day}</span>
                      </button>
                    ))}
                  </div>
                  <div className="records-date-actions">
                    <button type="button" className="records-date-action" onClick={clearDate}>
                      {t('records.filterDateClear')}
                    </button>
                    <button type="button" className="records-date-action is-primary" onClick={() => applyDate(dayjs())}>
                      {t('records.filterDateToday')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </label>
          <label className="records-filter-field">
            <span className="sr-only">{t('records.filterTypeAria')}</span>
            <div className="records-filter-select-wrap" ref={typeMenuWrapRef}>
              <button
                ref={typeMenuTriggerRef}
                type="button"
                className={`records-filter-control records-filter-select records-filter-select-btn ${typeMenuOpen ? 'is-open' : ''}`}
                aria-label={t('records.filterTypeAria')}
                aria-haspopup="listbox"
                aria-expanded={typeMenuOpen}
                aria-controls={typeMenuId}
                onClick={() => {
                  setDateMenuOpen(false);
                  setTypeMenuOpen((prev) => !prev);
                }}
              >
                <span className="records-filter-select-label">{t(selectedTypeOption.labelKey)}</span>
                <i className="i-lucide-chevron-down records-filter-select-icon" aria-hidden="true" />
              </button>
              {typeMenuOpen && (
                <div id={typeMenuId} role="listbox" className="records-type-menu">
                {recordTypeOptions.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    role="option"
                    className={`records-type-option ${item.value === selectedType ? 'is-active' : ''}`}
                    aria-selected={item.value === selectedType}
                    onClick={() => {
                      setSelectedType(item.value);
                      setTypeMenuOpen(false);
                      typeMenuTriggerRef.current?.focus();
                    }}
                  >
                    <span className="records-type-option-label">{t(item.labelKey)}</span>
                    {item.value === selectedType && <i className="i-lucide-check records-type-option-check" />}
                  </button>
                ))}
                </div>
              )}
            </div>
          </label>
        </div>
        <button
          type="button"
          className="records-refresh-btn"
          aria-label={t('records.refreshAria')}
          title={t('records.refreshAria')}
          onClick={handleRefresh}
        >
          <i className="i-lucide-refresh-cw records-refresh-icon" />
        </button>
      </div>
      <div className="records-list">
        {error && (
          <div className="records-error">
            {t('common.errorWithMessage', { message: tError(locale, error.message) })}
          </div>
        )}
        {!error && !isLoading && totalPages === 0 && (
          <div className="records-empty">{t('records.empty')}</div>
        )}
        {!error && visiblePage.length > 0 && (
          <div className="records-page">
            {visiblePage.map((record) => (
              <UploadRecordItem key={record.id} record={record} onPreviewImage={openImagePreview} />
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
            disabled={currentPage <= 1 || isLoading || isValidating}
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
            disabled={!totalPages || currentPage >= totalPages || isLoading || isValidating}
          >
            <i className="i-lucide-chevron-right records-page-btn-icon" />
          </button>
        </div>
      </div>
      {previewOverlay}
    </>
  );
});

const UploadRecordItem = memo((props: { record: UploadRecord; onPreviewImage: (src: string, name: string) => void }) => {
  const t = useT();
  const files = useMemo(() => props.record.files || [], [props.record.files]);
  const [openFileMenuKey, setOpenFileMenuKey] = useState<string | null>(null);
  const openFileMenuRef = useRef<HTMLDivElement>(null);
  const uploaderType = normalizeUploaderType(props.record.uploader);
  const uploaderLabel = t(uploaderDeviceLabelKeys[uploaderType]);
  const uploaderIcon = uploaderDeviceIcons[uploaderType];
  const recordTime = formatRecordTime(props.record.ctime, t);

  const actionLink = 'record-action';

  useEffect(() => {
    if (!openFileMenuKey) return;

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!openFileMenuRef.current?.contains(target)) {
        setOpenFileMenuKey(null);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpenFileMenuKey(null);
      }
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [openFileMenuKey]);

  const meta = <div className="record-meta">
    <span title={uploaderLabel}>
      <i className={`${uploaderIcon} mr-1`}></i>
      {uploaderLabel}
    </span>
    <span title={dayjs(props.record.ctime).format('YYYY-MM-DD HH:mm:ss')}>
      <i className="i-lucide-clock mr-1"></i>
      {recordTime}
    </span>
    {!!props.record.size && (
      <span title={`${props.record.size} bytes`}>
        <i className="i-lucide-database mr-1"></i>
        {toReadableSize(props.record.size)}
      </span>
    )}
  </div>;

  const actions = <div className="record-actions">
    {!!props.record.message && (<>
      <a className={actionLink} onClick={(e) => (e.preventDefault(), void copyToClipboard(props.record.message))} href='#' role='button'>
        <i className="i-lucide-copy record-action-icon"></i>
        {t('records.copyText')}
      </a>
    </>)}

    {
      props.record.files.length > 1 && (
        <a
          className={`${actionLink}`}
          target="_blank"
          rel="noreferrer"
          href={`/api/download/${encodeURIComponent(props.record.slug)}/tarball`}
          download={`${props.record.id}.tar`}
        >
          <i className="i-lucide-archive record-action-icon"></i>
          {t('records.downloadAll')}
        </a>
      )
    }

    <PopoverConfirm onConfirm={() => deleteRecord(props.record.id)}>
      <a
        className={`${actionLink} record-action-danger`}
        onClick={(e) => e.preventDefault()} href='#' role='button'>
        <i className="i-lucide-trash-2 record-action-icon"></i>
        {t('records.delete')}
      </a>
    </PopoverConfirm>
  </div>;

  return (
    <article className="record-card">
      <div className="record-main">
        <div className="record-fixed">
          {meta}
        </div>
        <div className="record-scroll withScrollbar">
          {!!props.record.message && <pre className="record-message">{props.record.message}</pre>}
          {files.length > 0 && (
            <div className="record-files">
              {files.map((file, index) => {
                const link = `/api/download/${props.record.slug}/${index}`;
                const fileExt = getFileExt(file.name);
                const canPreviewImage = Boolean(file.thumbnail);
                const menuKey = `${props.record.id}-${index}`;
                return (
                  <div key={file.path} className="record-file-item">
                    <a
                      href={link}
                      target={canPreviewImage ? undefined : '_blank'}
                      rel={canPreviewImage ? undefined : 'noreferrer'}
                      title={file.name}
                      className="record-file"
                      onMouseDown={() => setOpenFileMenuKey(null)}
                      onClick={canPreviewImage
                        ? (event) => {
                          event.preventDefault();
                          props.onPreviewImage(link, file.name);
                        }
                        : undefined}
                    >
                      {file.thumbnail ? (
                        <>
                          <img src={file.thumbnail} className="record-file-thumb" />
                          <div className="record-file-info">
                            <div className="record-file-name">{file.name}</div>
                            <div className="record-file-size-row">
                              {!!fileExt && <span className="record-file-ext">{fileExt}</span>}
                              <span className="record-file-size">{toReadableSize(file.size)}</span>
                            </div>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="record-file-icon-wrap" aria-hidden="true">
                            <i className="i-lucide-file record-file-icon"></i>
                          </div>
                          <div className="record-file-info">
                            <div className="record-file-name">{file.name}</div>
                            <div className="record-file-size-row">
                              {!!fileExt && <span className="record-file-ext">{fileExt}</span>}
                              <span className="record-file-size">{toReadableSize(file.size)}</span>
                            </div>
                          </div>
                        </>
                      )}
                    </a>
                    <button
                      ref={openFileMenuKey === menuKey ? openFileMenuRef : undefined}
                      type="button"
                      className={`record-file-menu-trigger ${openFileMenuKey === menuKey ? 'is-open' : ''}`}
                      aria-label={t('records.fileActionMenuAria')}
                      title={t('records.fileActionMenuAria')}
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        setOpenFileMenuKey((prev) => (prev === menuKey ? null : menuKey));
                      }}
                    >
                      <i className="i-lucide-ellipsis-vertical" />
                    </button>
                    {openFileMenuKey === menuKey && (
                      <div className="record-file-menu" role="menu">
                        <a
                          href={link}
                          download={file.name}
                          className="record-file-menu-item"
                          role="menuitem"
                          onClick={(event) => {
                            event.stopPropagation();
                            setOpenFileMenuKey(null);
                          }}
                        >
                          {t('records.fileActionDownload')}
                        </a>
                        <button
                          type="button"
                          className="record-file-menu-item"
                          role="menuitem"
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            setOpenFileMenuKey(null);
                            const absoluteUrl = new URL(link, window.location.origin).toString();
                            void copyToClipboard(absoluteUrl);
                          }}
                        >
                          {t('records.fileActionShare')}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {actions}
    </article>
  );
});

function normalizeUploaderType(rawUploader?: string | null): UploaderDeviceType {
  const raw = String(rawUploader || '').trim().toLowerCase();
  if (!raw) return 'unknown';
  if (raw === 'yon') return 'unknown';

  if (raw === 'windows' || raw.includes('windows') || raw.includes('win')) return 'windows';
  if (raw === 'macos' || raw.includes('mac') || raw.includes('osx')) return 'macos';
  if (raw === 'linux' || raw.includes('linux') || raw.includes('ubuntu') || raw.includes('debian')) return 'linux';
  if (raw === 'ipados' || raw.includes('ipados') || raw.includes('ipad')) return 'ipados';
  if (raw === 'ios' || raw.includes('iphone') || raw.includes('ipod') || raw === 'ios') return 'ios';
  if (raw === 'android' || raw.includes('android')) return 'android';
  if (raw === 'desktop' || raw.includes('desktop') || raw.includes('pc') || raw.includes('computer')) return 'unknown';
  if (raw === 'unknown') return 'unknown';

  return 'unknown';
}

function formatRecordTime(
  ctime: number,
  t: (key: TranslationKey, params?: Record<string, string | number>) => string,
) {
  const value = dayjs(ctime);
  const time = value.format('HH:mm:ss');
  if (value.isSame(dayjs(), 'day')) return `${t('records.timeToday')} ${time}`;
  if (value.isSame(dayjs().subtract(1, 'day'), 'day')) return `${t('records.timeYesterday')} ${time}`;
  return value.format('YYYY-MM-DD HH:mm:ss');
}

function toReadableSize(size: number) {
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  let unit = 0;
  while (size >= 1024) {
    size /= 1024;
    unit++;
  }
  return `${size.toFixed(1)} ${units[unit]}`;
}

function getFileExt(name: string) {
  const dotIndex = name.lastIndexOf('.');
  if (dotIndex <= 0) return '';
  if (dotIndex === name.length - 1) return '';
  return name.slice(dotIndex + 1).toUpperCase();
}

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch (err) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
  }
}

function deleteRecord(id: number) {
  fetchAPI('/api/delete', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ id }),
  })
    .then((res) => res.json())
    .then((data) => {
      console.log('deleted data', data);
      window.dispatchEvent(new Event('records-updated'));
    });
}
