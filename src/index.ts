import { Hono } from "hono";
// import { parseMultipartRequest } from '@mjackson/multipart-parser';
import {
  countUploadRecords,
  countSharedUploadRecords,
  createShareRecord,
  createUploadRecord,
  deleteRecord,
  deleteRecordFile,
  deleteShareRecord,
  getSharedUploadRecord,
  listUploadRecords,
  listSharedUploadRecords,
  getUploadRecordBySlug,
  migrateTables,
  purgeRecordsBeforeId,
  RecordFileItem,
  RecordFilterType,
  recordFilterTypes,
} from "./database";
import { H } from "hono/types";
import { createSeekableTarball } from "./stream-tarball";
import { generateContentRangeHeader } from "./file";

type Bindings = {
  ASSETS: { fetch: typeof fetch };
  DB: D1Database;
  MY_BUCKET: R2Bucket;
  PASSWORD: string;
  AUTH_TIMING_DEBUG?: string;
};

const uploaderDeviceTypes = ['windows', 'macos', 'linux', 'ios', 'android', 'ipados', 'unknown'] as const;
type UploaderDeviceType = (typeof uploaderDeviceTypes)[number];

const app = new Hono<{ Bindings: Bindings }>();
const FILE_DOWNLOAD_CACHE_CONTROL = "public, max-age=120, s-maxage=600, stale-while-revalidate=300";
const RANGE_DOWNLOAD_CACHE_CONTROL = "no-store";
const PROTECTED_ROUTE_CACHE_CONTROL = "no-store";
const AUTH_FAIL_WINDOW_MS = 10 * 60 * 1000;
const AUTH_FAIL_BLOCK_THRESHOLD = 5;
const AUTH_FAIL_BLOCK_STEPS_MS = [60 * 1000, 5 * 60 * 1000, 15 * 60 * 1000, 60 * 60 * 1000] as const;
let migrationReadyPromise: Promise<void> | null = null;

interface AuthGuardRow {
  key_hash: string;
  fail_count: number;
  first_fail_at: number;
  blocked_until: number;
  updated_at: number;
}

function timingSafeEqualString(left: string, right: string) {
  const encoder = new TextEncoder();
  const leftBytes = encoder.encode(left);
  const rightBytes = encoder.encode(right);
  const maxLength = Math.max(leftBytes.length, rightBytes.length);

  let diff = leftBytes.length ^ rightBytes.length;
  for (let index = 0; index < maxLength; index++) {
    diff |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0);
  }
  return diff === 0;
}

async function sha256Hex(input: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest), (item) => item.toString(16).padStart(2, "0")).join("");
}

async function buildAuthGuardKeyHash(c: { req: { header: (name: string) => string | undefined } }) {
  const forwarded = String(c.req.header("x-forwarded-for") || "");
  const forwardedIp = forwarded.split(",")[0]?.trim();
  const ip = String(c.req.header("cf-connecting-ip") || forwardedIp || "unknown");
  const ua = String(c.req.header("user-agent") || "unknown");
  return sha256Hex(`${ip}|${ua}`);
}

async function getAuthGuard(db: D1Database, keyHash: string) {
  const row = await db.prepare(
    "SELECT key_hash, fail_count, first_fail_at, blocked_until, updated_at FROM auth_guard WHERE key_hash = ?"
  ).bind(keyHash).first<AuthGuardRow>();
  if (!row) return null;

  return {
    keyHash: String(row.key_hash),
    failCount: Number(row.fail_count || 0),
    firstFailAt: Number(row.first_fail_at || 0),
    blockedUntil: Number(row.blocked_until || 0),
    updatedAt: Number(row.updated_at || 0),
  };
}

function resolveBlockDurationMs(failCount: number) {
  if (failCount < AUTH_FAIL_BLOCK_THRESHOLD) return 0;
  const level = Math.min(failCount - AUTH_FAIL_BLOCK_THRESHOLD, AUTH_FAIL_BLOCK_STEPS_MS.length - 1);
  return AUTH_FAIL_BLOCK_STEPS_MS[level];
}

async function recordAuthFailure(
  db: D1Database,
  keyHash: string,
  now: number,
  prevGuard: Awaited<ReturnType<typeof getAuthGuard>>
) {
  const hasRecentFailures = Boolean(prevGuard && now - prevGuard.firstFailAt <= AUTH_FAIL_WINDOW_MS);
  const failCount = hasRecentFailures ? prevGuard!.failCount + 1 : 1;
  const firstFailAt = hasRecentFailures ? prevGuard!.firstFailAt : now;
  const blockedUntil = (() => {
    const durationMs = resolveBlockDurationMs(failCount);
    if (!durationMs) return 0;
    return now + durationMs;
  })();

  await db.prepare(
    `INSERT INTO auth_guard (key_hash, fail_count, first_fail_at, blocked_until, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(key_hash) DO UPDATE SET
       fail_count = excluded.fail_count,
       first_fail_at = excluded.first_fail_at,
       blocked_until = excluded.blocked_until,
       updated_at = excluded.updated_at`
  ).bind(keyHash, failCount, firstFailAt, blockedUntil, now).run();

  return blockedUntil;
}

function ensureTablesMigrated(db: D1Database) {
  if (!migrationReadyPromise) {
    migrationReadyPromise = migrateTables(db).catch((err) => {
      migrationReadyPromise = null;
      throw err;
    });
  }
  return migrationReadyPromise;
}

function isAuthTimingDebugEnabled(c: { env: Bindings }) {
  const raw = String(c.env.AUTH_TIMING_DEBUG || "").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

function logAuthTiming(c: { req: { method: string; url: string } }, branch: string, startAt: number, extra?: Record<string, string | number>) {
  const elapsedMs = Date.now() - startAt;
  const pathname = new URL(c.req.url).pathname;
  const suffix = extra
    ? ` ${Object.entries(extra).map(([key, value]) => `${key}=${value}`).join(" ")}`
    : "";
  console.log(`[AUTH] ${c.req.method} ${pathname} ${elapsedMs}ms branch=${branch}${suffix}`);
}

const authWithPassword: H<{ Bindings: Bindings }> = async (c, next) => {
  const authStartAt = Date.now();
  const authTimingDebug = isAuthTimingDebugEnabled(c);
  await ensureTablesMigrated(c.env.DB);

  const expectedPassword = String(c.env.PASSWORD || "");
  const inputPassword = String(c.req.header("x-password") || "");
  if (!expectedPassword) {
    c.header("Cache-Control", PROTECTED_ROUTE_CACHE_CONTROL);
    c.status(401);
    if (authTimingDebug) logAuthTiming(c, "missing-password-config", authStartAt);
    return c.json({ error: "Unauthorized" });
  }

  if (timingSafeEqualString(inputPassword, expectedPassword)) {
    await next();
    c.header("Cache-Control", PROTECTED_ROUTE_CACHE_CONTROL);
    if (authTimingDebug) logAuthTiming(c, "success-fast-path", authStartAt);
    return;
  }

  const now = Date.now();
  const guardKeyHash = await buildAuthGuardKeyHash(c);
  const guard = await getAuthGuard(c.env.DB, guardKeyHash);
  if (guard && guard.blockedUntil > now) {
    const retryAfter = Math.max(1, Math.ceil((guard.blockedUntil - now) / 1000));
    c.header("Retry-After", String(retryAfter));
    c.header("Cache-Control", PROTECTED_ROUTE_CACHE_CONTROL);
    c.status(429);
    if (authTimingDebug) logAuthTiming(c, "blocked", authStartAt, { retryAfter });
    return c.json({ error: "Too many attempts" });
  }

  const blockedUntil = await recordAuthFailure(c.env.DB, guardKeyHash, now, guard);
  c.header("Cache-Control", PROTECTED_ROUTE_CACHE_CONTROL);
  if (blockedUntil > now) {
    const retryAfter = Math.max(1, Math.ceil((blockedUntil - now) / 1000));
    c.header("Retry-After", String(retryAfter));
    c.status(429);
    if (authTimingDebug) logAuthTiming(c, "blocked-after-failure", authStartAt, { retryAfter });
    return c.json({ error: "Too many attempts" });
  }
  c.status(401);
  if (authTimingDebug) logAuthTiming(c, "unauthorized", authStartAt);
  return c.json({ error: "Unauthorized" });
};

function parsePositiveInt(input?: string | null) {
  if (!input) return undefined;
  const parsed = Number(input);
  if (!Number.isInteger(parsed) || parsed <= 0) return undefined;
  return parsed;
}

function parseTimestamp(input?: string | null) {
  if (!input) return undefined;
  const parsed = Number(input);
  if (!Number.isFinite(parsed)) return undefined;
  return parsed;
}

function parseRecordType(input?: string | null): RecordFilterType {
  if (!input) return "all";
  const lowered = input.toLowerCase() as RecordFilterType;
  if (recordFilterTypes.includes(lowered)) return lowered;
  return "all";
}

function detectUploaderByUA(uaRaw?: string | null): UploaderDeviceType {
  const ua = String(uaRaw || '').toLowerCase();
  if (!ua) return 'unknown';

  const isIPadOS = /ipad/.test(ua) || (/macintosh/.test(ua) && /mobile/.test(ua));
  if (isIPadOS) return 'ipados';
  if (/iphone|ipod/.test(ua)) return 'ios';
  if (/android/.test(ua)) return 'android';
  if (/windows/.test(ua)) return 'windows';
  if (/macintosh|mac os x/.test(ua)) return 'macos';
  if (/linux|x11/.test(ua)) return 'linux';
  if (/mobile|tablet/.test(ua)) return 'unknown';
  return 'unknown';
}

function normalizeUploader(rawUploader?: string | null, uaRaw?: string | null): UploaderDeviceType {
  const raw = String(rawUploader || '').trim().toLowerCase();
  if (raw === 'yon') return 'unknown';
  if (!raw) return detectUploaderByUA(uaRaw);

  const exact = raw as UploaderDeviceType;
  if (uploaderDeviceTypes.includes(exact)) return exact;

  if (raw.includes('windows') || raw.includes('win')) return 'windows';
  if (raw.includes('mac') || raw.includes('osx')) return 'macos';
  if (raw.includes('linux') || raw.includes('ubuntu') || raw.includes('debian')) return 'linux';
  if (raw.includes('ipados') || raw.includes('ipad')) return 'ipados';
  if (raw.includes('ios') || raw.includes('iphone') || raw.includes('ipod')) return 'ios';
  if (raw.includes('android')) return 'android';
  if (raw.includes('desktop') || raw.includes('pc') || raw.includes('computer')) return 'unknown';

  const detected = detectUploaderByUA(uaRaw);
  return detected;
}

app.get("/api/list", authWithPassword, async (c) => {
  const beforeId = parsePositiveInt(c.req.query("beforeId"));
  const recordType = parseRecordType(c.req.query("recordType"));
  const dateFrom = parseTimestamp(c.req.query("dateFrom"));
  const dateTo = parseTimestamp(c.req.query("dateTo"));

  const list = await listUploadRecords(c.env.DB, {
    beforeId,
    recordType,
    dateFrom,
    dateTo,
    limit: 20,
  });
  return c.json(list);

  // const r = await createUploadRecord(c.env.DB, {
  //   uploader: 'yon',
  //   size: 0,
  //   files: '',
  //   message: '',
  // })
  // return c.json(r)
});

app.get("/api/list/count", authWithPassword, async (c) => {
  const recordType = parseRecordType(c.req.query("recordType"));
  const dateFrom = parseTimestamp(c.req.query("dateFrom"));
  const dateTo = parseTimestamp(c.req.query("dateTo"));
  const pageSize = 20;
  const total = await countUploadRecords(c.env.DB, { recordType, dateFrom, dateTo });
  const totalPages = Math.ceil(total / pageSize);

  return c.json({
    total,
    pageSize,
    totalPages,
  });
});

app.get("/api/share/list", authWithPassword, async (c) => {
  const beforeCtime = parseTimestamp(c.req.query("beforeCtime"));
  const beforeSlug = c.req.query("beforeSlug");
  const list = await listSharedUploadRecords(c.env.DB, {
    beforeCtime,
    beforeSlug,
    limit: 20,
  });
  return c.json(list);
});

app.get("/api/share/list/count", authWithPassword, async (c) => {
  const pageSize = 20;
  const total = await countSharedUploadRecords(c.env.DB);
  const totalPages = Math.ceil(total / pageSize);

  return c.json({
    total,
    pageSize,
    totalPages,
  });
});

app.get("/api/share/:slug", async (c) => {
  await ensureTablesMigrated(c.env.DB);
  const slug = c.req.param("slug");
  const shared = await getSharedUploadRecord(c.env.DB, slug);
  if (!shared) return c.notFound();
  return c.json(shared);
});

app.post("/api/share", authWithPassword, async (c) => {
  await ensureTablesMigrated(c.env.DB);
  const body = await c.req.json();
  const recordSlug = String(body.recordSlug || "");
  const record = await getUploadRecordBySlug(c.env.DB, recordSlug);
  if (!record) return c.notFound();
  const share = await createShareRecord(c.env.DB, record.slug);
  return c.json({ share });
});

app.post("/api/share/delete", authWithPassword, async (c) => {
  await ensureTablesMigrated(c.env.DB);
  const body = await c.req.json();
  const slug = String(body.slug || "");
  if (!slug) return c.notFound();
  await deleteShareRecord(c.env.DB, slug);
  return c.json({ ok: true });
});

const timingMiddleware: H = async (c, next) => {
  const start = Date.now();
  const resp = await next();
  console.log(`[${c.req.method}] ${c.req.url} ${Date.now() - start}ms`);
  return resp;
};

app.post("/api/upload", timingMiddleware, authWithPassword, async (c) => {
  const reqContentType = String(c.req.header('Content-Type'));
  const uploader = normalizeUploader(c.req.header("x-uploader"), c.req.header("user-agent"));
  const filePathPrefix = `cf_drop/${Date.now()}`;

  let message = '';
  let fileInfos: RecordFileItem[] = [];

  const rollbacks: (() => void)[] = [];
  const filePutPromises: Promise<void>[] = [];
  const errors: { error: Error, fileInfo: RecordFileItem }[] = [];

  try {
    if (false && reqContentType.startsWith('multipart/form-data')) {
      // stream upload -- kinda slower than native formData() parser

      /*
      const fields = parseMultipartRequest(c.req.raw);
      for await (const field of fields) {
        switch (field.name) {
          case 'message':
            message = await field.text();
            break;
          case 'fileInfos':
            initializeFileInfos(JSON.parse(await field.text()));
            break;
          case 'files': {
            const info = fileInfos[filePutPromises.length];
            if (info) {
              let stopped = false;
              let readLength = 0;
              let reader = field.body.getReader();
              const stream = new ReadableStream({
                expectedLength: info.size,
                cancel(reason) {
                  stopped = true;
                  reader.cancel(reason);
                },
                async start(controller) {
                  while (!stopped) {
                    const { done, value } = await reader.read();
                    if (done) {
                      controller.close();
                      break;
                    }

                    readLength += value.length;
                    const remaining = info.size - readLength;
                    if (remaining <= 0) {
                      controller.enqueue(remaining !== 0 ? value.subarray(0, remaining) : value);
                      controller.close();
                      reader.cancel();
                      stopped = true;
                      break;
                    }
                    controller.enqueue(value);
                  }
                }
              })
              queueNextFileToUpload(stream);
            }
            break;
          }
        }
      }
      */
    } else {
      // native formData() parser
      const body = await c.req.formData();
      message = String(body.get("message") || "");
      initializeFileInfos(JSON.parse(body.get("fileInfos")!.toString()));
      body.getAll("files").forEach((file) => {
        if (file instanceof File) queueNextFileToUpload(file);
      });
    }

    if (!fileInfos.length && !message) {
      return c.json({ error: "No files or message" });
    }

    // create record
    await Promise.all(filePutPromises);

    if (filePutPromises.length !== fileInfos.length) {
      throw new Error('Invalid fileInfos');
    }

    if (errors.length) {
      rollbacks.forEach((fn) => fn());
      c.status(500);
      return c.json({
        message: 'Failed to upload files',
        errors: errors.map(it => ({
          error: String(it.error),
          file: it.fileInfo.name,
        })),
      });
    }

    const record = await createUploadRecord(c.env.DB, {
      uploader,
      size: fileInfos.reduce((acc, file) => acc + file.size, 0),
      files: fileInfos,
      message,
    });

    return c.json({ record });
  } catch (err) {
    rollbacks.forEach((fn) => fn());
    c.status(500);
    return c.json({
      message: 'Failed to upload files',
      errors: [{ error: String(err), file: '' }],
    });
  }

  // upload files to bucket
  function queueNextFileToUpload(body: ReadableStream | Blob) {
    const index = filePutPromises.length;
    const item = fileInfos[index];
    if (!item) throw new Error('Invalid index of file');

    const { path, type } = item;
    const rollback = () => c.env.MY_BUCKET.delete(path).catch(() => { });
    rollbacks.push(rollback);

    filePutPromises.push((async () => {
      try {
        const r = await c.env.MY_BUCKET.put(path, body, {
          httpMetadata: { contentType: type },
        })
        item.size = r.size;
      } catch (e) {
        errors.push({ error: e as Error, fileInfo: item });
      }
    })());
  }

  function initializeFileInfos(tmp: any) {
    if (!Array.isArray(tmp)) throw new Error('Invalid fileInfos');

    fileInfos.length = 0;
    for (const file of tmp) {
      fileInfos.push({
        name: String(file.name),
        size: +file.size,
        thumbnail: String(file.thumbnail || ''),
        path: `${filePathPrefix}/${fileInfos.length}_${file.name}`,
        type: String(file.type || 'application/octet-stream'),
      });
    }
  }
});

app.get("/api/download/:slug/tarball", async (c) => {
  const slug = c.req.param("slug");
  const record = await getUploadRecordBySlug(c.env.DB, slug);
  if (!record) return c.status(404);

  const tarball = createSeekableTarball(record.files.map(f => ({
    mtime: record.ctime,
    name: f.name,
    size: f.size,
    read: async (iOffset, iLength) => {
      const x = await c.env.MY_BUCKET.get(f.path, { range: { offset: iOffset, length: iLength } });
      if (!x) throw new Error('File not found');

      let offset = 0;
      let length = x.size;

      if (x.range && 'offset' in x.range) {
        offset = x.range.offset!;
        length = x.range.length!;
      }

      return {
        stream: x.body,
        offset,
        length,
      };
    }
  })));

  const reqRange = c.req.header("range");
  const reader = tarball.getReader(reqRange);

  c.status(reqRange ? 206 : 200);
  c.header("Content-Type", "application/octet-stream");
  c.header("Content-Disposition", `attachment; filename="${record.slug}.tar"`);
  c.header("Accept-Ranges", "bytes");
  c.header("Content-Length", String(reader.end - reader.start + 1));
  if (reqRange) c.header("Content-Range", `${reader.start}-${reader.end}/${tarball.size}`);

  return c.body(reader.stream);
})

const RE_ASSET_SUFFIX = /\.(jpg|jpeg|png|gif|webp|avif|mp4|mov|txt|html|js|css|json|ya?ml)$/;
function buildContentDisposition(dispositionType: "inline" | "attachment", filename: string) {
  const fallbackName = "file";
  const safeFilename = String(filename || fallbackName)
    .replace(/\r|\n/g, " ")
    .replace(/[\\"]/g, "\\$&");
  const encodedFilename = encodeURIComponent(filename || fallbackName)
    .replace(/['()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
  return `${dispositionType}; filename="${safeFilename}"; filename*=UTF-8''${encodedFilename}`;
}

function buildDownloadEtag(slug: string, index: string, size: number, ctime: number) {
  return `"${slug}-${index}-${size}-${ctime}"`;
}

function isIfNoneMatchMatched(ifNoneMatch: string | undefined, etag: string) {
  if (!ifNoneMatch) return false;

  return ifNoneMatch
    .split(",")
    .map((token) => token.trim())
    .some((token) => token === "*" || token === etag || token === `W/${etag}`);
}

function resolveStaticCacheControl(pathname: string) {
  if (pathname === "/" || pathname === "/index.html" || pathname === "/settings") {
    return "no-cache";
  }
  if (pathname === "/sw.js") {
    return "no-cache";
  }
  if (pathname.startsWith("/static/")) {
    return "public, max-age=31536000, immutable";
  }
  return "";
}

app.get("/api/download/:slug/:index", async (c) => {
  const slug = c.req.param("slug");
  const index = c.req.param("index");
  const record = await getUploadRecordBySlug(c.env.DB, slug);
  if (!record) {
    return c.status(404);
  }

  const file = record.files[+index];
  const filePath = file?.path;
  if (!filePath) {
    return c.status(404);
  }
  const reqRange = c.req.header("Range");

  const basename = filePath.split("/").pop()!.replace(/\?.*/, "");
  const originalName = String(file?.name || "").replace(/\?.*/, "");
  const downloadName = (originalName || basename).split(/[\\/]/).pop() || "file";
  const lowerName = downloadName.toLowerCase();
  const etag = buildDownloadEtag(slug, index, file.size, record.ctime);

  if (!reqRange && isIfNoneMatchMatched(c.req.header("If-None-Match"), etag)) {
    const notModifiedHeaders = new Headers();
    notModifiedHeaders.set("etag", etag);
    notModifiedHeaders.set("cache-control", FILE_DOWNLOAD_CACHE_CONTROL);
    return new Response(null, {
      status: 304,
      headers: notModifiedHeaders,
    });
  }

  const cacheKey = new Request(c.req.url, { method: "GET" });
  if (!reqRange) {
    const cached = await caches.default.match(cacheKey);
    if (cached) {
      return cached;
    }
  }

  const r = reqRange
    ? await c.env.MY_BUCKET.get(filePath, { range: c.req.raw.headers })
    : await c.env.MY_BUCKET.get(filePath);

  if (!r) {
    c.status(404);
    return c.json({ error: "File not found" });
  }

  const headers = new Headers();
  r.writeHttpMetadata(headers);
  let status = 200;

  if (r.range && reqRange) {
    status = 206;
    headers.set("content-range", generateContentRangeHeader(r.range, r.size));
    headers.set("cache-control", RANGE_DOWNLOAD_CACHE_CONTROL);
  } else {
    headers.set("etag", etag);
    headers.set("cache-control", FILE_DOWNLOAD_CACHE_CONTROL);
  }
  headers.set("accept-ranges", "bytes");
  const dispositionType = RE_ASSET_SUFFIX.test(lowerName) ? "inline" : "attachment";
  headers.set("content-disposition", buildContentDisposition(dispositionType, downloadName));

  const response = new Response(r.body, {
    status,
    headers,
  });

  if (!reqRange && status === 200) {
    c.executionCtx.waitUntil(caches.default.put(cacheKey, response.clone()));
  }

  return response;
});

app.post("/api/delete", authWithPassword, async (c) => {
  const body = await c.req.json();
  const id = +body.id;
  await deleteRecord(c.env.DB, id, (paths) => c.env.MY_BUCKET.delete(paths));
  return c.json({ ok: true });
});

app.post("/api/delete-file", authWithPassword, async (c) => {
  const body = await c.req.json();
  const id = +body.id;
  const index = +body.index;
  if (!Number.isInteger(id) || id <= 0 || !Number.isInteger(index) || index < 0) {
    return c.notFound();
  }

  const result = await deleteRecordFile(c.env.DB, id, index, (paths) => c.env.MY_BUCKET.delete(paths));
  if (!result) return c.notFound();
  return c.json({ ok: true, ...result });
});

app.post("/api/purge", authWithPassword, async (c) => {
  const beforeId = 9999999;
  await purgeRecordsBeforeId(c.env.DB, beforeId, (paths) =>
    c.env.MY_BUCKET.delete(paths)
  );
  return c.json({ ok: true });
});

app.get("*", async (c) => {
  const url = new URL(c.req.url);
  if (url.pathname.startsWith("/api/")) {
    return c.notFound();
  }

  const assetResponse = await c.env.ASSETS.fetch(c.req.raw);
  const cacheControl = resolveStaticCacheControl(url.pathname);
  if (!cacheControl) {
    return assetResponse;
  }

  const headers = new Headers(assetResponse.headers);
  headers.set("Cache-Control", cacheControl);
  return new Response(assetResponse.body, {
    status: assetResponse.status,
    statusText: assetResponse.statusText,
    headers,
  });
});

export default app;
