export async function migrateTables(db: D1Database) {
  await db.exec(
    `
    CREATE TABLE IF NOT EXISTS upload_record (
      id INTEGER PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      uploader TEXT NOT NULL,
      ctime TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      size INTEGER DEFAULT 0,
      files TEXT DEFAULT '',
      message TEXT DEFAULT ''
    )
  `.replace(/\n/g, "")
  );

  await db.exec(
    `
    CREATE TABLE IF NOT EXISTS auth_guard (
      key_hash TEXT PRIMARY KEY,
      fail_count INTEGER NOT NULL DEFAULT 0,
      first_fail_at INTEGER NOT NULL,
      blocked_until INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL
    )
  `.replace(/\n/g, "")
  );

  await db.exec(
    `
    CREATE TABLE IF NOT EXISTS share_record (
      slug TEXT PRIMARY KEY,
      record_slug TEXT NOT NULL,
      ctime TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `.replace(/\n/g, "")
  );

  await db.exec(
    `
    DELETE FROM share_record
    WHERE slug NOT IN (
      SELECT keep_slug
      FROM (
        SELECT (
          SELECT s2.slug
          FROM share_record s2
          WHERE s2.record_slug = s1.record_slug
          ORDER BY s2.ctime ASC, s2.slug ASC
          LIMIT 1
        ) AS keep_slug
        FROM share_record s1
        GROUP BY s1.record_slug
      )
    )
  `.replace(/\n/g, "")
  );
}

export interface UploadRecord {
  id: number;
  slug: string;
  uploader: string;
  ctime: number;
  size: number;
  files: RecordFileItem[];
  message: string;
}

export interface RecordFileItem {
  name: string;
  size: number;
  path: string;
  thumbnail?: string;
  type?: string;
}

export interface ShareRecord {
  slug: string;
  recordSlug: string;
  ctime: number;
}

export interface SharedUploadRecord {
  record: UploadRecord;
  share: ShareRecord;
}

export const recordFilterTypes = ['all', 'text', 'image', 'document', 'archive', 'audio'] as const;
export type RecordFilterType = (typeof recordFilterTypes)[number];

interface ListUploadRecordsOptions {
  beforeId?: number;
  recordType?: RecordFilterType;
  dateFrom?: number;
  dateTo?: number;
  limit?: number;
}

interface CountUploadRecordsOptions {
  recordType?: RecordFilterType;
  dateFrom?: number;
  dateTo?: number;
}

interface ListShareRecordsOptions {
  beforeCtime?: number;
  beforeSlug?: string;
  limit?: number;
}

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

function getFileExtLower(name: string) {
  const dotIndex = name.lastIndexOf('.');
  if (dotIndex <= 0 || dotIndex >= name.length - 1) return '';
  return name.slice(dotIndex + 1).toLowerCase();
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

function isTypeMatchedByFile(file: RecordFileItem, recordType: Exclude<RecordFilterType, 'all' | 'text'>) {
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

function isRecordMatched(record: UploadRecord, opts: ListUploadRecordsOptions) {
  if (typeof opts.dateFrom === 'number' && Number.isFinite(opts.dateFrom) && record.ctime < opts.dateFrom) {
    return false;
  }
  if (typeof opts.dateTo === 'number' && Number.isFinite(opts.dateTo) && record.ctime >= opts.dateTo) {
    return false;
  }

  const recordType = opts.recordType || 'all';
  if (recordType === 'all') return true;
  if (recordType === 'text') return Boolean(record.message && record.message.trim());

  const files = record.files || [];
  if (!files.length) return false;
  return files.some((file) => isTypeMatchedByFile(file, recordType));
}

function fromDB(data: any): UploadRecord {
  let files: RecordFileItem[] = [];
  try {
    files = JSON.parse(data.files);
  } catch {}

  return {
    id: data.id,
    slug: data.slug,
    uploader: data.uploader,
    ctime: +new Date(data.ctime),
    size: data.size,
    files,
    message: data.message,
  };
}

function toDB(record: UploadRecord) {
  return {
    id: record.id,
    slug: record.slug,
    uploader: record.uploader,
    ctime: new Date(+record.ctime),
    size: record.size,
    files: JSON.stringify(
      Array.from(
        record.files || [],
        (item) =>
          item && {
            name: String(item.name),
            size: +item.size,
            path: String(item.path || ""),
            thumbnail: String(item.thumbnail || ""),
            type: String(item.type || ""),
          }
      ).filter(Boolean)
    ),
    message: record.message,
  };
}

/**
 * get latest 20 records. in descending order (newest first)
 *
 * to fetch older records, pass `beforeId` option (which is last id of prev page)
 */
export async function listUploadRecords(
  db: D1Database,
  opts: ListUploadRecordsOptions = {}
) {
  const matchedRecords: UploadRecord[] = [];
  const limit = Number.isInteger(opts.limit) && opts.limit! > 0 ? Math.min(opts.limit!, 100) : 20;
  const pageSize = Math.max(limit, 40);

  let cursor = opts.beforeId && Number.isInteger(opts.beforeId) && opts.beforeId > 0 ? opts.beforeId : undefined;
  while (matchedRecords.length < limit) {
    let sql = "SELECT * FROM upload_record";
    if (cursor) {
      sql += ` WHERE id < ${cursor}`;
    }
    sql += ` ORDER BY id DESC LIMIT ${pageSize}`;

    const rows = await db.prepare(sql).all();
    const page = (rows.results as any[]).map(fromDB);
    if (!page.length) break;

    for (const record of page) {
      if (!isRecordMatched(record, opts)) continue;
      matchedRecords.push(record);
      if (matchedRecords.length >= limit) break;
    }

    if (page.length < pageSize) break;
    cursor = page[page.length - 1].id;
  }

  return matchedRecords.slice(0, limit);
}

export async function countUploadRecords(
  db: D1Database,
  opts: CountUploadRecordsOptions = {}
) {
  const hasTypeFilter = opts.recordType && opts.recordType !== 'all';
  const hasDateFilter = Number.isFinite(opts.dateFrom) || Number.isFinite(opts.dateTo);
  if (!hasTypeFilter && !hasDateFilter) {
    const row = await db.prepare("SELECT COUNT(*) AS total FROM upload_record").first<{ total: number }>();
    return Number(row?.total || 0);
  }

  const pageSize = 120;
  let total = 0;
  let cursor: number | undefined;

  while (true) {
    let sql = "SELECT * FROM upload_record";
    if (cursor) {
      sql += ` WHERE id < ${cursor}`;
    }
    sql += ` ORDER BY id DESC LIMIT ${pageSize}`;

    const rows = await db.prepare(sql).all();
    const page = (rows.results as any[]).map(fromDB);
    if (!page.length) break;

    for (const record of page) {
      if (isRecordMatched(record, opts)) total++;
    }

    if (page.length < pageSize) break;
    cursor = page[page.length - 1].id;
  }

  return total;
}

export async function getUploadRecord(db: D1Database, id: number) {
  const record = await db
    .prepare(`SELECT * FROM upload_record WHERE id = ?`)
    .bind(id)
    .first<UploadRecord>();
  if (!record) return null;
  return fromDB(record);
}

export async function getUploadRecordBySlug(db: D1Database, slug: string) {
  const record = await db
    .prepare(`SELECT * FROM upload_record WHERE slug = ?`)
    .bind(slug)
    .first<UploadRecord>();
  if (!record) return null;
  return fromDB(record);
}

function shareRecordFromDB(data: any): ShareRecord {
  return {
    slug: String(data.slug),
    recordSlug: String(data.record_slug),
    ctime: +new Date(data.ctime),
  };
}

export async function getShareRecordByRecordSlug(db: D1Database, recordSlug: string) {
  const row = await db
    .prepare("SELECT slug, record_slug, ctime FROM share_record WHERE record_slug = ? ORDER BY ctime ASC, slug ASC LIMIT 1")
    .bind(recordSlug)
    .first<any>();
  if (!row) return null;
  return shareRecordFromDB(row);
}

export async function createShareRecord(db: D1Database, recordSlug: string) {
  const existing = await getShareRecordByRecordSlug(db, recordSlug);
  if (existing) return existing;

  const slug = randomId();
  await db
    .prepare("INSERT INTO share_record (slug, record_slug) VALUES (?, ?)")
    .bind(slug, recordSlug)
    .run();

  return await getShareRecordByRecordSlug(db, recordSlug) || {
    slug,
    recordSlug,
    ctime: +new Date(),
  };
}

export async function deleteShareRecord(db: D1Database, slug: string) {
  await db
    .prepare("DELETE FROM share_record WHERE slug = ?")
    .bind(slug)
    .run();
}

async function deleteShareRecordsByRecordSlug(db: D1Database, recordSlug: string) {
  await db
    .prepare("DELETE FROM share_record WHERE record_slug = ?")
    .bind(recordSlug)
    .run();
}

export async function getSharedUploadRecord(db: D1Database, slug: string): Promise<SharedUploadRecord | null> {
  const row = await db
    .prepare(
      `SELECT
        s.slug AS share_slug,
        s.record_slug AS share_record_slug,
        s.ctime AS share_ctime,
        r.id,
        r.slug,
        r.uploader,
        r.ctime,
        r.size,
        r.files,
        r.message
      FROM share_record s
      INNER JOIN upload_record r ON r.slug = s.record_slug
      WHERE s.slug = ?`
    )
    .bind(slug)
    .first<any>();
  if (!row) return null;

  return {
    share: shareRecordFromDB({
      slug: row.share_slug,
      record_slug: row.share_record_slug,
      ctime: row.share_ctime,
    }),
    record: fromDB(row),
  };
}

function sharedUploadRecordFromJoinedRow(row: any): SharedUploadRecord {
  return {
    share: shareRecordFromDB({
      slug: row.share_slug,
      record_slug: row.share_record_slug,
      ctime: row.share_ctime,
    }),
    record: fromDB(row),
  };
}

export async function listSharedUploadRecords(
  db: D1Database,
  opts: ListShareRecordsOptions = {}
) {
  const limit = Number.isInteger(opts.limit) && opts.limit! > 0 ? Math.min(opts.limit!, 100) : 20;
  let sql = `SELECT
    s.slug AS share_slug,
    s.record_slug AS share_record_slug,
    s.ctime AS share_ctime,
    r.id,
    r.slug,
    r.uploader,
    r.ctime,
    r.size,
    r.files,
    r.message
  FROM share_record s
  INNER JOIN upload_record r ON r.slug = s.record_slug`;
  const bindings: Array<string | number> = [];

  if (Number.isFinite(opts.beforeCtime) && opts.beforeSlug) {
    sql += " WHERE (s.ctime < ? OR (s.ctime = ? AND s.slug < ?))";
    const cursorDate = new Date(opts.beforeCtime!).toISOString();
    bindings.push(cursorDate, cursorDate, opts.beforeSlug);
  }

  sql += " ORDER BY s.ctime DESC, s.slug DESC LIMIT ?";
  bindings.push(limit);

  const rows = await db.prepare(sql).bind(...bindings).all<any>();
  return (rows.results || []).map(sharedUploadRecordFromJoinedRow);
}

export async function countSharedUploadRecords(db: D1Database) {
  const row = await db.prepare("SELECT COUNT(*) AS total FROM share_record").first<{ total: number }>();
  return Number(row?.total || 0);
}

export function randomId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(-4);
}

export async function createUploadRecord(
  db: D1Database,
  record: Omit<UploadRecord, "id" | "ctime" | "slug"> & { slug?: string }
) {
  const inserting = toDB(record as UploadRecord);
  const slug = inserting.slug || randomId();
  const res = await db
    .prepare(
      "INSERT INTO upload_record (slug, uploader, size, files, message) VALUES (?, ?, ?, ?, ?)"
    )
    .bind(
      slug,
      inserting.uploader,
      inserting.size,
      inserting.files,
      inserting.message
    )
    .run();
  const id = res.meta.last_row_id;
  const inserted: UploadRecord = {
    ...(record as UploadRecord),
    ctime: +new Date(),
    id,
    slug,
  };
  return { id, inserted };
}

export async function purgeRecordsBeforeId(
  db: D1Database,
  beforeId: number,
  deleteFiles: (path: string[]) => Promise<void>
) {
  // 1. fetch all ids and file
  const rows = await db
    .prepare("SELECT id, slug, files FROM upload_record WHERE id < ?")
    .bind(beforeId)
    .all<UploadRecord>();
  const ids = rows.results.map((row) => row.id);
  if (!ids.length) return;

  // 2. delete files
  for (const row of rows.results) {
    const files = fromDB(row).files;
    if (!files.length) continue;
    await deleteFiles(files.map((file) => file.path));
  }

  // 3. delete records
  const recordSlugs = rows.results.map((row) => String(row.slug));
  const slugPlaceholders = recordSlugs.map(() => "?").join(",");
  await db.prepare(`DELETE FROM share_record WHERE record_slug IN (${slugPlaceholders})`).bind(...recordSlugs).run();

  const idPlaceholders = ids.map(() => "?").join(",");
  await db.prepare(`DELETE FROM upload_record WHERE id IN (${idPlaceholders})`).bind(...ids).run();

  return;
}

export async function deleteRecord(
  db: D1Database,
  id: number,
  deleteFiles: (path: string[]) => Promise<void>
) {
  // 1. get record
  const record = await getUploadRecord(db, id);
  if (!record) return;

  // 2. delete files
  try {
    const files = record.files;
    await deleteFiles(files.map((file) => file.path));
  } catch {}

  // 3. delete record
  await deleteShareRecordsByRecordSlug(db, record.slug);
  await db.prepare(`DELETE FROM upload_record WHERE id = ?`).bind(id).run();
}

export async function deleteRecordFile(
  db: D1Database,
  id: number,
  index: number,
  deleteFiles: (path: string[]) => Promise<void>
): Promise<{ deletedRecord: boolean; record?: UploadRecord } | null> {
  const record = await getUploadRecord(db, id);
  if (!record) return null;

  const file = record.files[index];
  if (!file) return null;

  await deleteFiles([file.path]);

  const files = record.files.filter((_, itemIndex) => itemIndex !== index);
  const shouldDeleteRecord = !files.length && !String(record.message || "").trim();
  if (shouldDeleteRecord) {
    await deleteShareRecordsByRecordSlug(db, record.slug);
    await db.prepare(`DELETE FROM upload_record WHERE id = ?`).bind(id).run();
    return { deletedRecord: true };
  }

  const size = files.reduce((total, item) => total + Number(item.size || 0), 0);
  const updating = toDB({
    ...record,
    files,
    size,
  });

  await db
    .prepare("UPDATE upload_record SET files = ?, size = ? WHERE id = ?")
    .bind(updating.files, updating.size, id)
    .run();

  return {
    deletedRecord: false,
    record: {
      ...record,
      files,
      size,
    },
  };
}
