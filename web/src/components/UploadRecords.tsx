import { memo, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import useSWRInfinite from 'swr/infinite';
import useSWR from 'swr';
import dayjs from 'dayjs';
import Linkify from 'linkify-react';
import 'dayjs/locale/zh-cn';

import type { RecordFilterType, UploadRecord } from '../../../src/database';
import { fetchAPI } from '../store/auth';
import { RECORD_CREATED_EVENT, type RecordCreatedEventDetail } from '../store/uploading';
import { showGlobalMessage } from '../store';
import { PopoverConfirm } from './PopoverConfirm';
import { useLocale, useT } from '../store/locale';
import { tError, type TranslationKey } from '../i18n';

const recordTypeOptions: Array<{ value: RecordFilterType; labelKey: 'records.filterTypeAll' | 'records.filterTypeText' | 'records.filterTypeImage' | 'records.filterTypeDocument' | 'records.filterTypeArchive' | 'records.filterTypeAudio' }> = [
  { value: 'all', labelKey: 'records.filterTypeAll' },
  { value: 'text', labelKey: 'records.filterTypeText' },
  { value: 'image', labelKey: 'records.filterTypeImage' },
  { value: 'document', labelKey: 'records.filterTypeDocument' },
  { value: 'archive', labelKey: 'records.filterTypeArchive' },
  { value: 'audio', labelKey: 'records.filterTypeAudio' },
];

type UploaderDeviceType = 'windows' | 'macos' | 'linux' | 'ios' | 'android' | 'ipados' | 'unknown';
type FileMenuPlacement = 'top' | 'bottom';

interface OpenFileMenuState {
  key: string;
  link: string;
  fileName: string;
  top: number;
  left: number;
  placement: FileMenuPlacement;
}

const FILE_MENU_WIDTH = 120;
const FILE_MENU_ESTIMATED_HEIGHT = 92;
const FILE_MENU_GAP = 6;
const FILE_MENU_VIEWPORT_PADDING = 8;
const PAGE_SIZE_FALLBACK = 20;
const VISIBLE_TYPE_COUNT = 4;
const messageLinkifyOptions = {
  className: 'record-message-link',
  target: '_blank',
  rel: 'noopener noreferrer',
  validate: (value: string, type: string) => type === 'url' && /^https?:\/\//i.test(value),
};

const IMAGE_FILE_EXTS = new Set([
  'jpg',
  'jpeg',
  'png',
  'gif',
  'webp',
  'bmp',
  'svg',
  'avif',
  'heic',
]);

const DOCUMENT_FILE_EXTS = new Set([
  'pdf',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'ppt',
  'pptx',
  'txt',
  'md',
  'rtf',
  'csv',
  'json',
  'xml',
  'yaml',
  'yml',
]);

const ARCHIVE_FILE_EXTS = new Set([
  'zip',
  'rar',
  '7z',
  'tar',
  'gz',
  'bz2',
  'xz',
  'tgz',
]);

const AUDIO_FILE_EXTS = new Set([
  'mp3',
  'wav',
  'flac',
  'aac',
  'm4a',
  'ogg',
  'opus',
]);

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
  const [isListPending, setIsListPending] = useState(true);
  const [selectedDate, setSelectedDate] = useState('');
  const [dateMenuOpen, setDateMenuOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<RecordFilterType>('all');
  const [showTypeOverflowMenu, setShowTypeOverflowMenu] = useState(false);
  const [typeOverflowMenuOpen, setTypeOverflowMenuOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [calendarCursor, setCalendarCursor] = useState(() => dayjs().startOf('month'));
  const hasCountKeyMountedRef = useRef(false);
  const typeSegmentRef = useRef<HTMLDivElement>(null);
  const typeMeasureRef = useRef<HTMLDivElement>(null);
  const typeOverflowWrapRef = useRef<HTMLDivElement>(null);
  const dateMenuWrapRef = useRef<HTMLDivElement>(null);
  const dateMenuTriggerRef = useRef<HTMLButtonElement>(null);
  const dateMenuId = useId();
  const typeOverflowMenuId = useId();
  const visibleTypeOptions = useMemo(
    () => recordTypeOptions.slice(0, VISIBLE_TYPE_COUNT),
    [],
  );
  const overflowTypeOptions = useMemo(
    () => recordTypeOptions.slice(VISIBLE_TYPE_COUNT),
    [],
  );
  const isSelectedTypeInOverflow = useMemo(
    () => overflowTypeOptions.some((item) => item.value === selectedType),
    [overflowTypeOptions, selectedType],
  );

  const dateRange = useMemo(() => {
    if (!selectedDate) return null;
    const start = dayjs(selectedDate, 'YYYY-MM-DD');
    if (!start.isValid()) return null;
    return {
      from: start.startOf('day').valueOf(),
      to: start.add(1, 'day').startOf('day').valueOf(),
    };
  }, [selectedDate]);
  const isRecordMatchedCurrentFilter = useCallback((record: UploadRecord) => (
    isRecordMatchedByFilter(record, selectedType, dateRange)
  ), [dateRange, selectedType]);

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
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    },
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
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    },
  );

  useEffect(() => {
    dayjs.locale(locale === 'zh-CN' ? 'zh-cn' : 'en');
  }, [locale]);

  const refreshRecords = useCallback(async () => {
    setIsListPending(true);
    setCurrentPage(1);
    const loadedPages = data?.length ?? 0;
    if (loadedPages > 1) {
      await setSize(1);
    } else {
      await mutate(undefined, {
        revalidate: (_pageData, pageKey) => typeof pageKey === 'string' && !pageKey.includes('beforeId='),
      });
    }
    await mutateCount();
  }, [data?.length, mutate, mutateCount, setSize]);
  const mutateCountBy = useCallback((delta: number) => {
    void mutateCount((prev?: RecordCountResponse) => {
      const pageSize = prev?.pageSize || PAGE_SIZE_FALLBACK;
      const total = Math.max(0, (prev?.total || 0) + delta);
      return {
        total,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      };
    }, {
      revalidate: false,
    });
  }, [mutateCount]);
  const applyCreatedRecord = useCallback((record: UploadRecord) => {
    if (!isRecordMatchedCurrentFilter(record)) return;

    mutateCountBy(1);
    if (currentPage !== 1) return;

    void mutate((pages?: UploadRecord[][]) => {
      if (!pages || !pages.length) return [[record]];
      if (pages.some((page) => page.some((item) => item.id === record.id))) return pages;

      const pageSize = countData?.pageSize || PAGE_SIZE_FALLBACK;
      const next = pages.map((page) => page.slice());
      next[0] = [record, ...next[0]].slice(0, pageSize);
      return next;
    }, {
      revalidate: false,
    });
  }, [countData?.pageSize, currentPage, isRecordMatchedCurrentFilter, mutate, mutateCountBy]);
  const handleDeleteRecord = useCallback((id: number) => {
    const snapshotPages = data?.map((page) => page.slice());
    const snapshotCount = countData ? { ...countData } : undefined;
    const removedRecord = snapshotPages?.flat().find((item) => item.id === id);

    void mutate((pages?: UploadRecord[][]) => {
      if (!pages) return pages;
      return pages.map((page) => page.filter((item) => item.id !== id));
    }, {
      revalidate: false,
    });

    if (removedRecord && isRecordMatchedCurrentFilter(removedRecord)) {
      mutateCountBy(-1);
    }

    fetchAPI('/api/delete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ id }),
    })
      .then((res) => res.json())
      .then((resp) => {
        if (!resp?.ok) {
          throw new Error('error.unknown');
        }
      })
      .catch((err) => {
        console.error('delete failed', err);
        if (snapshotPages) {
          void mutate(snapshotPages, { revalidate: false });
        }
        if (snapshotCount) {
          void mutateCount(snapshotCount, { revalidate: false });
        }
      });
  }, [countData, data, isRecordMatchedCurrentFilter, mutate, mutateCount, mutateCountBy]);

  useEffect(() => {
    const refresh = () => {
      void refreshRecords();
    };
    window.addEventListener('records-updated', refresh);
    return () => window.removeEventListener('records-updated', refresh);
  }, [refreshRecords]);

  useEffect(() => {
    const onRecordCreated = (event: Event) => {
      const detail = (event as CustomEvent<RecordCreatedEventDetail>).detail;
      if (!detail?.record) return;
      applyCreatedRecord(detail.record);
    };

    window.addEventListener(RECORD_CREATED_EVENT, onRecordCreated as EventListener);
    return () => window.removeEventListener(RECORD_CREATED_EVENT, onRecordCreated as EventListener);
  }, [applyCreatedRecord]);

  useEffect(() => {
    if (!hasCountKeyMountedRef.current) {
      hasCountKeyMountedRef.current = true;
      return;
    }
    setIsListPending(true);
    setCurrentPage(1);
    void setSize(1);
  }, [countKey, setSize]);

  useEffect(() => {
    if (error || (!isLoading && !isValidating)) {
      setIsListPending(false);
    }
  }, [error, isLoading, isValidating]);

  useEffect(() => {
    if (!dateMenuOpen) return;

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      const clickInDateMenu = dateMenuWrapRef.current?.contains(target);
      if (!clickInDateMenu) {
        setDateMenuOpen(false);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setDateMenuOpen(false);
        dateMenuTriggerRef.current?.focus();
      }
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [dateMenuOpen]);

  useEffect(() => {
    const computeTypeOverflow = () => {
      const segmentEl = typeSegmentRef.current;
      const measureEl = typeMeasureRef.current;
      if (!segmentEl || !measureEl) return;
      if (!overflowTypeOptions.length) {
        setShowTypeOverflowMenu(false);
        return;
      }

      const allChipWidths = Array.from(
        measureEl.querySelectorAll<HTMLElement>('.records-type-chip[data-measure-type="all"]'),
      ).reduce((sum, item) => sum + item.offsetWidth, 0);
      const overflowButtonWidth = measureEl.querySelector<HTMLElement>('.records-type-overflow-btn')?.offsetWidth || 0;
      const gap = Number.parseFloat(window.getComputedStyle(segmentEl).columnGap || window.getComputedStyle(segmentEl).gap || '0') || 0;
      const allChipsGap = Math.max(0, recordTypeOptions.length - 1) * gap;
      const withMoreGap = visibleTypeOptions.length * gap;
      const widthWhenOverflow = Array.from(
        measureEl.querySelectorAll<HTMLElement>('.records-type-chip[data-measure-type="visible"]'),
      ).reduce((sum, item) => sum + item.offsetWidth, 0) + overflowButtonWidth + withMoreGap;
      const totalWidth = allChipWidths + allChipsGap;
      const availableWidth = segmentEl.clientWidth;
      const shouldOverflow = totalWidth > availableWidth && widthWhenOverflow <= availableWidth + 1;
      setShowTypeOverflowMenu(shouldOverflow);
      if (!shouldOverflow) {
        setTypeOverflowMenuOpen(false);
      }
    };

    computeTypeOverflow();
    const segmentEl = typeSegmentRef.current;
    if (!segmentEl) return;
    const observer = new ResizeObserver(() => computeTypeOverflow());
    observer.observe(segmentEl);
    window.addEventListener('resize', computeTypeOverflow);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', computeTypeOverflow);
    };
  }, [overflowTypeOptions.length, t, visibleTypeOptions.length]);

  useEffect(() => {
    if (!typeOverflowMenuOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!typeOverflowWrapRef.current?.contains(target)) {
        setTypeOverflowMenuOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setTypeOverflowMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [typeOverflowMenuOpen]);

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
    void copyToClipboard(absoluteUrl).then((copied) => {
      showGlobalMessage({
        type: copied ? 'success' : 'error',
        text: copied ? t('toast.copySuccess') : t('toast.copyFailed'),
      });
    });
  }, [previewImage, t]);

  const totalPages = countData?.totalPages || 0;
  const visiblePage = data?.[currentPage - 1] || [];
  const displayCurrentPage = totalPages === 0 ? 0 : Math.min(currentPage, totalPages);
  const showRecordsLoading = !error && (isListPending || (isLoading && !data?.length));
  const selectedDateValue = useMemo(() => {
    if (!selectedDate) return null;
    const value = dayjs(selectedDate, 'YYYY-MM-DD');
    return value.isValid() ? value : null;
  }, [selectedDate]);
  const dateTriggerLabel = selectedDateValue
    ? `${t('records.filterDateAria')}: ${selectedDateValue.format('YYYY-MM-DD')}`
    : t('records.filterDateAll');
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
    void refreshRecords();
  }, [refreshRecords]);
  const toggleDateMenu = useCallback(() => {
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
    setIsListPending(true);
    setSelectedDate(value.format('YYYY-MM-DD'));
    setDateMenuOpen(false);
    dateMenuTriggerRef.current?.focus();
  }, []);
  const clearDate = useCallback(() => {
    setIsListPending(true);
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
      <div className="records-filterbar">
        <div className="records-type-segment-wrap">
          <div ref={typeSegmentRef} className="records-type-segment" role="tablist" aria-label={t('records.filterTypeAria')}>
            {(showTypeOverflowMenu ? visibleTypeOptions : recordTypeOptions).map((item) => (
              <button
                key={item.value}
                type="button"
                role="tab"
                aria-selected={item.value === selectedType}
                className={`records-type-chip ${item.value === selectedType ? 'is-active' : ''}`}
                onClick={() => {
                  if (item.value === selectedType) return;
                  setDateMenuOpen(false);
                  setTypeOverflowMenuOpen(false);
                  setIsListPending(true);
                  setSelectedType(item.value);
                }}
              >
                {t(item.labelKey)}
              </button>
            ))}
            {showTypeOverflowMenu && (
              <div ref={typeOverflowWrapRef} className="records-type-overflow-wrap">
                <button
                  type="button"
                  className={`records-type-overflow-btn ${typeOverflowMenuOpen || isSelectedTypeInOverflow ? 'is-active' : ''} ${typeOverflowMenuOpen ? 'is-open' : ''}`}
                  aria-label={t('records.filterTypeMore')}
                  title={t('records.filterTypeMore')}
                  aria-haspopup="listbox"
                  aria-expanded={typeOverflowMenuOpen}
                  aria-controls={typeOverflowMenuId}
                  onClick={() => setTypeOverflowMenuOpen((prev) => !prev)}
                >
                  <i className="i-lucide-chevron-down" />
                </button>
                {typeOverflowMenuOpen && (
                  <div id={typeOverflowMenuId} className="records-type-overflow-menu" role="listbox" aria-label={t('records.filterTypeAria')}>
                    {overflowTypeOptions.map((item) => (
                      <button
                        key={item.value}
                        type="button"
                        role="option"
                        aria-selected={item.value === selectedType}
                        className={`records-type-overflow-option ${item.value === selectedType ? 'is-active' : ''}`}
                        onClick={() => {
                          if (item.value !== selectedType) {
                            setDateMenuOpen(false);
                            setIsListPending(true);
                            setSelectedType(item.value);
                          }
                          setTypeOverflowMenuOpen(false);
                        }}
                      >
                        {t(item.labelKey)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          <div ref={typeMeasureRef} className="records-type-segment records-type-segment-measure" aria-hidden="true">
            {recordTypeOptions.map((item) => (
              <button key={`all-${item.value}`} type="button" className="records-type-chip" data-measure-type="all">
                {t(item.labelKey)}
              </button>
            ))}
            {visibleTypeOptions.map((item) => (
              <button key={`visible-${item.value}`} type="button" className="records-type-chip" data-measure-type="visible">
                {t(item.labelKey)}
              </button>
            ))}
            <button type="button" className="records-type-overflow-btn" aria-hidden="true" tabIndex={-1}>
              <i className="i-lucide-chevron-down" />
            </button>
          </div>
        </div>
        <div className="records-filter-actions">
          <label className="records-filter-field">
            <span className="sr-only">{t('records.filterDateAria')}</span>
            <div className="records-date-picker-wrap" ref={dateMenuWrapRef}>
              <button
                ref={dateMenuTriggerRef}
                type="button"
                className={`records-date-icon-btn ${dateMenuOpen ? 'is-open' : ''}`}
                aria-label={t('records.filterDateAria')}
                title={dateTriggerLabel}
                aria-haspopup="dialog"
                aria-expanded={dateMenuOpen}
                aria-controls={dateMenuId}
                onClick={toggleDateMenu}
              >
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
      </div>
      <section className="records-panel">
        <div className="records-list">
          {error && (
            <div className="records-error">
              {t('common.errorWithMessage', { message: tError(locale, error.message) })}
            </div>
          )}
          {showRecordsLoading && (
            <div className="records-loading" role="status" aria-live="polite">
              <span className="records-loading-dot" aria-hidden="true" />
              <span>{t('records.loading')}</span>
            </div>
          )}
          {!error && !showRecordsLoading && totalPages === 0 && visiblePage.length === 0 && (
            <div className="records-empty">{t('records.empty')}</div>
          )}
          {!error && !showRecordsLoading && visiblePage.length > 0 && (
            <div className="records-page">
              {visiblePage.map((record) => (
                <UploadRecordItem
                  key={record.id}
                  record={record}
                  onPreviewImage={openImagePreview}
                  onDeleteRecord={handleDeleteRecord}
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
      </section>
      {previewOverlay}
    </>
  );
});

const UploadRecordItem = memo((props: {
  record: UploadRecord;
  onPreviewImage: (src: string, name: string) => void;
  onDeleteRecord: (id: number) => void;
}) => {
  const t = useT();
  const files = useMemo(() => props.record.files || [], [props.record.files]);
  const [openFileMenu, setOpenFileMenu] = useState<OpenFileMenuState | null>(null);
  const openFileMenuRef = useRef<HTMLDivElement>(null);
  const openFileMenuTriggerRef = useRef<HTMLButtonElement>(null);
  const recordBodyRef = useRef<HTMLDivElement>(null);
  const [isBodyScrollable, setIsBodyScrollable] = useState(false);
  const [isBodyAtTop, setIsBodyAtTop] = useState(true);
  const [isBodyAtBottom, setIsBodyAtBottom] = useState(true);
  const uploaderType = normalizeUploaderType(props.record.uploader);
  const uploaderLabel = t(uploaderDeviceLabelKeys[uploaderType]);
  const uploaderIcon = uploaderDeviceIcons[uploaderType];
  const recordTime = formatRecordTime(props.record.ctime, t);
  const messageText = String(props.record.message || '');
  const hasText = Boolean(messageText.trim());
  const singleFile = props.record.files.length === 1 ? props.record.files[0] : null;
  const canCopySingleImage = Boolean(singleFile) && !hasText && isImageRecordFile(singleFile) && isDesktopClipboardFileSupported();
  const canDownloadRecord = props.record.files.length > 0;
  const handleCopy = useCallback((text: string) => {
    void copyToClipboard(text).then((copied) => {
      showGlobalMessage({
        type: copied ? 'success' : 'error',
        text: copied ? t('toast.copySuccess') : t('toast.copyFailed'),
      });
    });
  }, [t]);
  const handleCopyRecord = useCallback(() => {
    if (hasText) {
      handleCopy(messageText);
      return;
    }
    if (!canCopySingleImage || !singleFile) return;

    const imageLink = `/api/download/${props.record.slug}/0`;
    void copyImageFileToClipboard(imageLink, singleFile.name).then((copied) => {
      showGlobalMessage({
        type: copied ? 'success' : 'error',
        text: copied ? t('toast.copySuccess') : t('toast.copyFailed'),
      });
    });
  }, [canCopySingleImage, handleCopy, hasText, messageText, props.record.slug, singleFile, t]);
  const handleDownloadRecord = useCallback(() => {
    if (!canDownloadRecord) return;
    if (props.record.files.length === 1) {
      triggerDownload(`/api/download/${props.record.slug}/0`, props.record.files[0].name);
      return;
    }
    triggerDownload(`/api/download/${props.record.slug}/tarball`, `${props.record.id}.tar`);
  }, [canDownloadRecord, props.record.files, props.record.id, props.record.slug]);
  const updateRecordBodyScrollState = useCallback(() => {
    const bodyEl = recordBodyRef.current;
    if (!bodyEl) return;

    const maxScrollTop = Math.max(0, bodyEl.scrollHeight - bodyEl.clientHeight);
    const isScrollable = maxScrollTop > 1;
    const atTop = bodyEl.scrollTop <= 1;
    const atBottom = bodyEl.scrollTop >= maxScrollTop - 1;

    setIsBodyScrollable(isScrollable);
    setIsBodyAtTop(!isScrollable || atTop);
    setIsBodyAtBottom(!isScrollable || atBottom);
  }, []);

  const resolveFileMenuPosition = useCallback((triggerRect: DOMRect) => {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let left = triggerRect.right - FILE_MENU_WIDTH;
    left = Math.max(
      FILE_MENU_VIEWPORT_PADDING,
      Math.min(left, viewportWidth - FILE_MENU_WIDTH - FILE_MENU_VIEWPORT_PADDING),
    );

    const fitsBottom = triggerRect.bottom + FILE_MENU_GAP + FILE_MENU_ESTIMATED_HEIGHT <= viewportHeight - FILE_MENU_VIEWPORT_PADDING;
    const placement: FileMenuPlacement = fitsBottom ? 'bottom' : 'top';

    let top = placement === 'bottom'
      ? triggerRect.bottom + FILE_MENU_GAP
      : triggerRect.top - FILE_MENU_GAP - FILE_MENU_ESTIMATED_HEIGHT;
    top = Math.max(
      FILE_MENU_VIEWPORT_PADDING,
      Math.min(top, viewportHeight - FILE_MENU_ESTIMATED_HEIGHT - FILE_MENU_VIEWPORT_PADDING),
    );

    return { top, left, placement };
  }, []);

  useEffect(() => {
    if (!openFileMenu) return;

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (openFileMenuRef.current?.contains(target)) return;
      if (openFileMenuTriggerRef.current?.contains(target)) return;
      setOpenFileMenu(null);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpenFileMenu(null);
      }
    };

    const onViewportChange = () => {
      setOpenFileMenu(null);
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', onViewportChange);
    window.addEventListener('scroll', onViewportChange, true);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', onViewportChange);
      window.removeEventListener('scroll', onViewportChange, true);
    };
  }, [openFileMenu]);

  useEffect(() => {
    updateRecordBodyScrollState();
    const bodyEl = recordBodyRef.current;
    if (!bodyEl) return;

    const onBodyScroll = () => {
      updateRecordBodyScrollState();
    };

    bodyEl.addEventListener('scroll', onBodyScroll, { passive: true });
    const resizeObserver = new ResizeObserver(() => {
      updateRecordBodyScrollState();
    });
    resizeObserver.observe(bodyEl);
    window.addEventListener('resize', updateRecordBodyScrollState);

    return () => {
      bodyEl.removeEventListener('scroll', onBodyScroll);
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateRecordBodyScrollState);
    };
  }, [files.length, messageText, updateRecordBodyScrollState]);

  const head = (
    <div className="record-head">
      <div className="record-head-main">
        <div className="record-device-row">
          <i className={`${uploaderIcon} record-device-icon`} aria-hidden="true"></i>
          <span className="record-device-name" title={uploaderLabel}>{uploaderLabel}</span>
        </div>
        <div className="record-time-row" title={dayjs(props.record.ctime).format('YYYY-MM-DD HH:mm:ss')}>
          {recordTime}
        </div>
      </div>
    </div>
  );
  const fileMenuOverlay = openFileMenu && typeof document !== 'undefined'
    ? createPortal(
      <div
        ref={openFileMenuRef}
        className={`record-file-menu record-file-menu-floating is-${openFileMenu.placement}`}
        role="menu"
        style={{ top: `${openFileMenu.top}px`, left: `${openFileMenu.left}px` }}
      >
        <a
          href={openFileMenu.link}
          download={openFileMenu.fileName}
          className="record-file-menu-item"
          role="menuitem"
          onClick={(event) => {
            event.stopPropagation();
            setOpenFileMenu(null);
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
            setOpenFileMenu(null);
            const absoluteUrl = new URL(openFileMenu.link, window.location.origin).toString();
            handleCopy(absoluteUrl);
          }}
        >
          {t('records.fileActionShare')}
        </button>
      </div>,
      document.body,
    )
    : null;
  const recordBodyClassName = [
    'record-body',
    isBodyScrollable ? 'is-scrollable' : '',
    isBodyAtTop ? 'is-at-top' : '',
    isBodyAtBottom ? 'is-at-bottom' : '',
  ].filter(Boolean).join(' ');

  return (
    <>
      <article className="record-item">
        {head}
        <div ref={recordBodyRef} className={recordBodyClassName}>
          {!!messageText && (
            <pre className="record-message">
              <Linkify options={messageLinkifyOptions}>
                {messageText}
              </Linkify>
            </pre>
          )}
          {files.length > 0 && (
            <div className="record-files">
              {files.map((file, index) => {
                const link = `/api/download/${props.record.slug}/${index}`;
                const fileExt = getFileExt(file.name);
                const canPreviewImage = Boolean(file.thumbnail);
                const menuKey = `${props.record.id}-${index}`;
                const isMenuOpen = openFileMenu?.key === menuKey;
                return (
                  <div key={file.path} className="record-file-item">
                    <a
                      href={link}
                      target={canPreviewImage ? undefined : '_blank'}
                      rel={canPreviewImage ? undefined : 'noreferrer'}
                      title={file.name}
                      className="record-file"
                      onMouseDown={() => setOpenFileMenu(null)}
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
                      ref={isMenuOpen ? openFileMenuTriggerRef : undefined}
                      type="button"
                      className={`record-file-menu-trigger ${isMenuOpen ? 'is-open' : ''}`}
                      aria-label={t('records.fileActionMenuAria')}
                      title={t('records.fileActionMenuAria')}
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        if (isMenuOpen) {
                          setOpenFileMenu(null);
                          return;
                        }
                        const triggerRect = event.currentTarget.getBoundingClientRect();
                        const { top, left, placement } = resolveFileMenuPosition(triggerRect);
                        setOpenFileMenu({
                          key: menuKey,
                          link,
                          fileName: file.name,
                          top,
                          left,
                          placement,
                        });
                      }}
                    >
                      <i className="i-lucide-ellipsis-vertical" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <div className="record-footer">
          <div className="record-head-actions record-footer-actions">
            <button
              type="button"
              className="record-head-action-btn"
              aria-label={t('records.copyText')}
              title={t('records.copyText')}
              onClick={handleCopyRecord}
            >
              <i className="i-lucide-copy record-head-action-icon"></i>
            </button>
            <button
              type="button"
              className="record-head-action-btn"
              aria-label={t('records.downloadAll')}
              title={t('records.downloadAll')}
              onClick={handleDownloadRecord}
            >
              <i className="i-lucide-download record-head-action-icon"></i>
            </button>
            <PopoverConfirm onConfirm={() => props.onDeleteRecord(props.record.id)}>
              <button
                type="button"
                className="record-head-action-btn is-danger"
                aria-label={t('records.delete')}
                title={t('records.delete')}
              >
                <i className="i-lucide-trash-2 record-head-action-icon"></i>
              </button>
            </PopoverConfirm>
          </div>
        </div>
      </article>
      {fileMenuOverlay}
    </>
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

function getFileExtLower(name: string) {
  const dotIndex = name.lastIndexOf('.');
  if (dotIndex <= 0) return '';
  if (dotIndex === name.length - 1) return '';
  return name.slice(dotIndex + 1).toLowerCase();
}

function isImageRecordFile(file: UploadRecord['files'][number]) {
  const mime = String(file.type || '').toLowerCase();
  const ext = getFileExtLower(file.name || '');
  return mime.startsWith('image/') || Boolean(file.thumbnail) || IMAGE_FILE_EXTS.has(ext);
}

function isDesktopClipboardFileSupported() {
  if (typeof navigator === 'undefined') return false;
  const ua = String(navigator.userAgent || '').toLowerCase();
  if (/android|iphone|ipad|ipod|mobile/.test(ua)) return false;
  return typeof navigator.clipboard?.write === 'function' && typeof ClipboardItem !== 'undefined';
}

async function copyImageFileToClipboard(link: string, filename: string) {
  try {
    const response = await fetch(link, { credentials: 'same-origin' });
    if (!response.ok) return false;
    const blob = await response.blob();
    const type = blob.type || `image/${getFileExtLower(filename) || 'png'}`;
    await navigator.clipboard.write([
      new ClipboardItem({
        [type]: blob,
      }),
    ]);
    return true;
  } catch {
    return false;
  }
}

function triggerDownload(link: string, filename: string) {
  if (typeof document === 'undefined') return;
  const anchor = document.createElement('a');
  anchor.href = link;
  anchor.download = filename;
  anchor.rel = 'noreferrer';
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
}

function isDocumentMime(mime: string) {
  if (!mime) return false;
  if (mime.startsWith('text/')) return true;
  if (mime === 'application/pdf' || mime === 'application/rtf') return true;
  if (mime.startsWith('application/msword')) return true;
  if (mime.startsWith('application/vnd.openxmlformats-officedocument')) return true;
  if (mime.startsWith('application/vnd.ms-')) return true;
  if (mime.endsWith('/json') || mime.endsWith('/xml') || mime.endsWith('/yaml')) return true;
  return false;
}

function isArchiveMime(mime: string) {
  if (!mime) return false;
  return [
    'application/zip',
    'application/x-zip-compressed',
    'application/x-rar-compressed',
    'application/vnd.rar',
    'application/x-7z-compressed',
    'application/gzip',
    'application/x-gzip',
    'application/x-tar',
    'application/x-bzip2',
    'application/x-xz',
  ].includes(mime);
}

function isTypeMatchedByFile(file: UploadRecord['files'][number], recordType: Exclude<RecordFilterType, 'all' | 'text'>) {
  const mime = String(file.type || '').toLowerCase();
  const ext = getFileExtLower(file.name || '');

  const matchesImage = mime.startsWith('image/') || Boolean(file.thumbnail) || IMAGE_FILE_EXTS.has(ext);
  const matchesDocument = isDocumentMime(mime) || DOCUMENT_FILE_EXTS.has(ext);
  const matchesArchive = isArchiveMime(mime) || ARCHIVE_FILE_EXTS.has(ext);
  const matchesAudio = mime.startsWith('audio/') || AUDIO_FILE_EXTS.has(ext);

  if (recordType === 'image') return matchesImage;
  if (recordType === 'document') return matchesDocument;
  if (recordType === 'archive') return matchesArchive;
  if (recordType === 'audio') return matchesAudio;

  return false;
}

function isRecordMatchedByFilter(
  record: UploadRecord,
  recordType: RecordFilterType,
  dateRange: { from: number; to: number } | null,
) {
  if (dateRange) {
    if (record.ctime < dateRange.from) return false;
    if (record.ctime >= dateRange.to) return false;
  }

  if (recordType === 'all') return true;
  if (recordType === 'text') return Boolean(record.message && record.message.trim());

  const files = record.files || [];
  if (!files.length) return false;
  return files.some((file) => isTypeMatchedByFile(file, recordType));
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
