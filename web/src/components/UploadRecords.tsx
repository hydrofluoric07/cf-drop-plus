import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import useSWRInfinite from 'swr/infinite';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/zh-cn';

import type { UploadRecord } from '../../../src/database';
import { fetchAPI } from '../store/auth';
import { PopoverConfirm } from './PopoverConfirm';
import { useLocale, useT } from '../store/locale';
import { tError } from '../i18n';

dayjs.extend(relativeTime);

export const UploadRecords = memo(() => {
  const [locale] = useLocale();
  const t = useT();
  const [previewImage, setPreviewImage] = useState<{ src: string; name: string } | null>(null);

  // all records. newest first
  const { data, error, isLoading, mutate } = useSWRInfinite(
    (_, page?: UploadRecord[]) => (page ? String(page?.at(-1)?.id ?? '') : 'init'),
    (beforeId) =>
      fetchAPI('/api/list?beforeId=' + beforeId).then((res) => res.json() as Promise<UploadRecord[]>),
  );

  useEffect(() => {
    dayjs.locale(locale === 'zh-CN' ? 'zh-cn' : 'en');
  }, [locale]);

  useEffect(() => {
    const refresh = () => {
      mutate();
    };
    window.addEventListener('records-updated', refresh);
    return () => window.removeEventListener('records-updated', refresh);
  }, [mutate]);

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
      <div className="records-list">
        {error && (
          <div className="records-error">
            {t('common.errorWithMessage', { message: tError(locale, error.message) })}
          </div>
        )}
        {!error && !isLoading && (!data || !data.some((it) => it.length)) && (
          <div className="records-empty">{t('records.empty')}</div>
        )}
        {data?.map((page, i) => (
          <div key={i} className="records-page">
            {page.map((record) => (
              <UploadRecordItem key={record.id} record={record} onPreviewImage={openImagePreview} />
            ))}
          </div>
        ))}
      </div>
      {previewOverlay}
    </>
  );
});

const UploadRecordItem = memo((props: { record: UploadRecord; onPreviewImage: (src: string, name: string) => void }) => {
  const t = useT();
  const files = useMemo(() => props.record.files || [], [props.record.files]);

  const actionLink = 'record-action';

  const meta = <div className="record-meta">
    <span>
      <i className="i-lucide-user mr-1"></i>
      {props.record.uploader}
    </span>
    <span title={dayjs(props.record.ctime).format('YYYY-MM-DD HH:mm:ss')}>
      <i className="i-lucide-clock mr-1"></i>
      {dayjs(props.record.ctime).fromNow()}
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
                return (
                  <div key={file.path} className="record-file-item">
                    <a
                      href={link}
                      target={canPreviewImage ? undefined : '_blank'}
                      rel={canPreviewImage ? undefined : 'noreferrer'}
                      title={file.name}
                      className="record-file"
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
