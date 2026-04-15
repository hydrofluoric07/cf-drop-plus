import { Hono } from "hono";
// import { parseMultipartRequest } from '@mjackson/multipart-parser';
import {
  createUploadRecord,
  deleteRecord,
  listUploadRecords,
  getUploadRecordBySlug,
  migrateTables,
  purgeRecordsBeforeId,
  RecordFileItem,
} from "./database";
import { H } from "hono/types";
import { createSeekableTarball } from "./stream-tarball";
import { generateContentRangeHeader } from "./file";

type Bindings = {
  ASSETS: { fetch: typeof fetch };
  DB: D1Database;
  MY_BUCKET: R2Bucket;
  PASSWORD: string;
};

const app = new Hono<{ Bindings: Bindings }>();

const authWithPassword: H<{ Bindings: Bindings }> = async (c, next) => {
  if (c.env.PASSWORD && c.req.header("x-password") !== c.env.PASSWORD) {
    c.status(401);
    return c.json({ error: "Password required" });
  }

  return await next();
};

app.get("/api/list", authWithPassword, async (c) => {
  await migrateTables(c.env.DB);

  const beforeId = +c.req.query("beforeId")!;
  const list = await listUploadRecords(c.env.DB, { beforeId });
  return c.json(list);

  // const r = await createUploadRecord(c.env.DB, {
  //   uploader: 'yon',
  //   size: 0,
  //   files: '',
  //   message: '',
  // })
  // return c.json(r)
});

const timingMiddleware: H = async (c, next) => {
  const start = Date.now();
  const resp = await next();
  console.log(`[${c.req.method}] ${c.req.url} ${Date.now() - start}ms`);
  return resp;
};

app.post("/api/upload", timingMiddleware, authWithPassword, async (c) => {
  const reqContentType = String(c.req.header('Content-Type'));
  const uploader = c.req.header("x-uploader") || "unknown";
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

const RE_ASSET_SUFFIX = /\.(jpg|png|gif|avif|mp4|mov|txt|html|js|css|json|ya?ml)/;
app.get("/api/download/:slug/:index", async (c) => {
  const slug = c.req.param("slug");
  const index = c.req.param("index");
  const record = await getUploadRecordBySlug(c.env.DB, slug);
  if (!record) {
    return c.status(404);
  }

  const filePath = record.files[+index]?.path;
  if (!filePath) {
    return c.status(404);
  }

  const r = await c.env.MY_BUCKET.get(filePath, {
    range: c.req.raw.headers
  });

  if (!r) {
    c.status(404);
    return c.json({ error: "File not found" });
  }

  const basename = filePath.split("/").pop()!.replace(/\?.*/, "");
  const headers = new Headers();

  r.writeHttpMetadata(headers);
  if (r.range && c.req.header('Range')) {
    c.status(206);
    headers.set("content-range", generateContentRangeHeader(r.range, r.size));
  }
  headers.set("accept-ranges", "bytes");

  if (!RE_ASSET_SUFFIX.test(basename)) headers.set("content-disposition", `attachment; filename="${basename}"`);
  headers.forEach((value, key) => c.header(key, value));
  return c.body(r.body)
});

app.post("/api/delete", authWithPassword, async (c) => {
  const body = await c.req.json();
  const id = +body.id;
  await deleteRecord(c.env.DB, id, (paths) => c.env.MY_BUCKET.delete(paths));
  return c.json({ ok: true });
});

app.post("/api/purge", authWithPassword, async (c) => {
  const beforeId = 9999999;
  await purgeRecordsBeforeId(c.env.DB, beforeId, (paths) =>
    c.env.MY_BUCKET.delete(paths)
  );
  return c.json({ ok: true });
});

export default app;
