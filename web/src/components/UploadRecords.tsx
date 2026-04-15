import { memo, useEffect, useMemo } from 'react';
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

  // all records. newest first
  const { data, error, isLoading, isValidating, mutate, size, setSize } = useSWRInfinite(
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

  return (
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
            <UploadRecordItem key={record.id} record={record} />
          ))}
        </div>
      ))}
      <button onClick={() => setSize(size + 1)} disabled={isValidating} className="records-more">
        {isValidating && <i className="i-lucide-loader-circle animate-spin"></i>}
        {t('records.loadMore')}
      </button>
    </div>
  );
});

const UploadRecordItem = memo((props: { record: UploadRecord }) => {
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
      <a className={actionLink} onClick={(e) => (e.preventDefault(), copyToClipboard(props.record.message))} href='#' role='button'>
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
      <div className="record-main withScrollbar">
        {meta}
        {!!props.record.message && <pre className="record-message">{props.record.message}</pre>}
        {files.length > 0 && (
          <div className="record-files">
            {files.map((file, index) => {
              const link = `/api/download/${props.record.slug}/${index}`;
              return (
                <div key={file.path}>
                  <a
                    href={link}
                    target="_blank"
                    rel="noreferrer"
                    title={file.name}
                    className="record-file"
                  >
                    {file.thumbnail ? (
                      <>
                        <img src={file.thumbnail} className="record-file-thumb" />
                        <div className="min-w-0">
                          <div className="record-file-name">{file.name}</div>
                          <div className="record-file-size">{toReadableSize(file.size)}</div>
                        </div>
                      </>
                    ) : (
                      <>
                        <i className="i-lucide-file text-[18px]"></i>
                        <span className="record-file-name">{file.name}</span>
                        <span className="record-file-size">{toReadableSize(file.size)}</span>
                      </>
                    )}
                  </a>
                </div>
              );
            })}
          </div>
        )}
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

function copyToClipboard(text: string) {
  try {
    navigator.clipboard.writeText(text);
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
