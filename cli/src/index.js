import { basename, extname, resolve } from 'node:path';
import { homedir } from 'node:os';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';

const DEFAULT_CONFIG_DIR = resolve(homedir(), '.config', 'cfdrop');
const DEFAULT_CONFIG_FILE = resolve(DEFAULT_CONFIG_DIR, 'config.json');
const USER_AGENT = 'cfdrop-cli/0.1.0';

const MIME_BY_EXT = new Map([
  ['.txt', 'text/plain'],
  ['.md', 'text/markdown'],
  ['.json', 'application/json'],
  ['.yaml', 'application/yaml'],
  ['.yml', 'application/yaml'],
  ['.pdf', 'application/pdf'],
  ['.zip', 'application/zip'],
  ['.gz', 'application/gzip'],
  ['.tar', 'application/x-tar'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.gif', 'image/gif'],
  ['.webp', 'image/webp'],
  ['.avif', 'image/avif'],
  ['.mp4', 'video/mp4'],
  ['.mov', 'video/quicktime'],
  ['.mp3', 'audio/mpeg'],
  ['.wav', 'audio/wav'],
  ['.ogg', 'audio/ogg'],
]);

main().catch((err) => {
  console.error(`错误: ${formatError(err)}`);
  process.exitCode = 1;
});

async function main() {
  const argv = process.argv.slice(2);
  if (argv.length === 0 || isHelpFlag(argv[0])) {
    printHelp();
    return;
  }

  const command = argv[0];
  const { options, positionals } = parseArgs(argv.slice(1));
  const config = await loadConfig();

  if (command === 'login') {
    await runLogin(options, config);
    return;
  }
  if (command === 'upload') {
    await runUpload(options, positionals, config);
    return;
  }
  if (command === 'list') {
    await runList(options, config);
    return;
  }
  if (command === 'download') {
    await runDownload(options, config);
    return;
  }
  if (command === 'delete') {
    await runDelete(options, config);
    return;
  }

  throw new Error(`未知命令: ${command}`);
}

function printHelp() {
  console.log(`cfdrop - cf-drop 命令行工具

用法:
  cfdrop login --server <url> --password <pwd>
  cfdrop upload [--message <text>] [--password <pwd>] [--server <url>] [files...]
  cfdrop list [--page <n>] [--type <type>] [--date-from <ms>] [--date-to <ms>] [--json]
  cfdrop download --slug <slug> [--index <n> | --tarball] [--out <path>] [--server <url>]
  cfdrop delete --id <id> [--server <url>] [--password <pwd>]

配置优先级:
  命令参数 > 环境变量(CFDROP_SERVER/CFDROP_PASSWORD) > 本地配置文件
`);
}

async function runLogin(options, config) {
  const server = normalizeServer(options.server || process.env.CFDROP_SERVER || config.server);
  const password = String(options.password || process.env.CFDROP_PASSWORD || '');
  if (!server) throw new Error('缺少 server，请使用 --server 或 CFDROP_SERVER');
  if (!password) throw new Error('缺少 password，请使用 --password 或 CFDROP_PASSWORD');

  await ensureAuth(server, password);
  await saveConfig({
    ...config,
    server,
    password,
  });
  console.log(`登录成功，已保存配置: ${DEFAULT_CONFIG_FILE}`);
}

async function runUpload(options, positionals, config) {
  const server = requireServer(options, config);
  const password = requirePassword(options, config);
  const message = String(options.message || '');
  const filePaths = positionals.map((path) => resolve(path));

  if (!message && filePaths.length === 0) {
    throw new Error('upload 至少需要 message 或文件');
  }

  const fileInfos = [];
  const files = [];
  for (const filePath of filePaths) {
    const st = await stat(filePath);
    if (!st.isFile()) throw new Error(`不是普通文件: ${filePath}`);

    const data = await readFile(filePath);
    const name = basename(filePath);
    const type = guessMimeType(name);
    const fileBlob = new Blob([data], { type });
    files.push({ blob: fileBlob, name });
    fileInfos.push({
      thumbnail: '',
      size: st.size,
      type,
      name,
    });
  }

  const body = new FormData();
  body.append('message', message);
  body.append('fileInfos', JSON.stringify(fileInfos));
  for (const file of files) {
    body.append('files', file.blob, file.name);
  }

  const res = await apiFetch(`${server}/api/upload`, {
    method: 'POST',
    headers: {
      'x-password': password,
      'x-uploader': 'linux',
    },
    body,
  });

  const payload = await res.json();
  const record = payload?.record;
  if (!record) throw new Error('上传成功但返回体缺少 record');
  console.log(`上传成功: id=${record.id} slug=${record.slug}`);
}

async function runList(options, config) {
  const server = requireServer(options, config);
  const password = requirePassword(options, config);
  const page = toPositiveInt(options.page || '1', 'page');
  const recordType = String(options.type || 'all');
  const dateFrom = options['date-from'];
  const dateTo = options['date-to'];
  const outputJson = hasTruthyFlag(options.json);

  const commonParams = new URLSearchParams();
  if (recordType) commonParams.set('recordType', recordType);
  if (dateFrom) commonParams.set('dateFrom', String(dateFrom));
  if (dateTo) commonParams.set('dateTo', String(dateTo));

  let beforeId;
  let records = [];
  for (let i = 0; i < page; i++) {
    const params = new URLSearchParams(commonParams);
    if (beforeId) params.set('beforeId', String(beforeId));
    const listUrl = `${server}/api/list${params.toString() ? `?${params}` : ''}`;
    const res = await apiFetch(listUrl, {
      headers: {
        'x-password': password,
      },
    });
    records = await res.json();
    if (!Array.isArray(records)) throw new Error('列表返回格式无效');
    if (records.length === 0) break;
    beforeId = records[records.length - 1]?.id;
  }

  if (outputJson) {
    console.log(JSON.stringify(records, null, 2));
    return;
  }

  if (!records.length) {
    console.log('无记录');
    return;
  }

  for (const record of records) {
    const fileCount = Array.isArray(record.files) ? record.files.length : 0;
    const size = Number(record.size || 0);
    const msg = String(record.message || '').replace(/\s+/g, ' ').slice(0, 80);
    console.log(`[${record.id}] slug=${record.slug} files=${fileCount} size=${size} uploader=${record.uploader}`);
    if (msg) console.log(`  message: ${msg}`);
  }
}

async function runDownload(options, config) {
  const slug = String(options.slug || '');
  if (!slug) throw new Error('缺少 --slug');

  const isTarball = hasTruthyFlag(options.tarball);
  const indexRaw = options.index;
  if (!isTarball && indexRaw === undefined) {
    throw new Error('download 需要 --index 或 --tarball');
  }
  if (isTarball && indexRaw !== undefined) {
    throw new Error('--index 与 --tarball 不能同时使用');
  }

  const server = requireServer(options, config);
  const outPath = resolve(String(options.out || '.'));
  const url = isTarball
    ? `${server}/api/download/${encodeURIComponent(slug)}/tarball`
    : `${server}/api/download/${encodeURIComponent(slug)}/${encodeURIComponent(String(indexRaw))}`;

  const res = await apiFetch(url, {});
  const cd = res.headers.get('content-disposition');
  const fallbackName = isTarball ? `${slug}.tar` : `${slug}-${indexRaw}`;
  const filename = parseFilenameFromContentDisposition(cd) || fallbackName;
  const outputFile = resolve(outPath, filename);

  await mkdir(resolve(outPath), { recursive: true });
  await pipeResponseToFile(res, outputFile);
  console.log(`下载完成: ${outputFile}`);
}

async function runDelete(options, config) {
  const server = requireServer(options, config);
  const password = requirePassword(options, config);
  const id = toPositiveInt(options.id, 'id');

  const res = await apiFetch(`${server}/api/delete`, {
    method: 'POST',
    headers: {
      'x-password': password,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ id }),
  });
  const payload = await res.json();
  if (!payload?.ok) throw new Error('删除失败');
  console.log(`删除成功: id=${id}`);
}

function requireServer(options, config) {
  const value = options.server || process.env.CFDROP_SERVER || config.server;
  const server = normalizeServer(value);
  if (!server) throw new Error('缺少 server，请先 cfdrop login 或传 --server');
  return server;
}

function requirePassword(options, config) {
  const password = String(options.password || process.env.CFDROP_PASSWORD || config.password || '');
  if (!password) throw new Error('缺少 password，请先 cfdrop login 或传 --password');
  return password;
}

async function ensureAuth(server, password) {
  await apiFetch(`${server}/api/list/count`, {
    headers: {
      'x-password': password,
    },
  });
}

async function apiFetch(url, init) {
  const headers = new Headers(init?.headers || {});
  headers.set('user-agent', USER_AGENT);
  const res = await fetch(url, {
    ...init,
    headers,
  });

  if (res.status === 429) {
    const retryAfter = res.headers.get('Retry-After');
    if (retryAfter) {
      throw new Error(`请求过于频繁，请在 ${retryAfter} 秒后重试`);
    }
    throw new Error('请求过于频繁，请稍后重试');
  }
  if (res.status === 401) {
    throw new Error('鉴权失败，请检查密码');
  }
  if (!res.ok) {
    const text = await safeReadText(res);
    throw new Error(`请求失败(${res.status}): ${text || res.statusText}`);
  }
  return res;
}

async function safeReadText(res) {
  try {
    return await res.text();
  } catch {
    return '';
  }
}

function parseArgs(argv) {
  const options = {};
  const positionals = [];

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith('--')) {
      positionals.push(token);
      continue;
    }

    const eqIndex = token.indexOf('=');
    if (eqIndex > 2) {
      const key = token.slice(2, eqIndex);
      const value = token.slice(eqIndex + 1);
      options[key] = value;
      continue;
    }

    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      options[key] = true;
      continue;
    }

    options[key] = next;
    i += 1;
  }

  return { options, positionals };
}

function hasTruthyFlag(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.toLowerCase();
    return normalized === '1' || normalized === 'true' || normalized === 'yes';
  }
  return false;
}

function guessMimeType(filename) {
  const ext = extname(filename).toLowerCase();
  return MIME_BY_EXT.get(ext) || 'application/octet-stream';
}

function normalizeServer(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  try {
    const url = new URL(raw);
    return url.toString().replace(/\/+$/, '');
  } catch {
    return '';
  }
}

function isHelpFlag(token) {
  return token === '--help' || token === '-h' || token === 'help';
}

function toPositiveInt(value, field) {
  const num = Number(value);
  if (!Number.isInteger(num) || num <= 0) {
    throw new Error(`${field} 必须是正整数`);
  }
  return num;
}

function parseFilenameFromContentDisposition(disposition) {
  if (!disposition) return '';

  const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1]);
    } catch {
      // noop
    }
  }

  const asciiMatch = disposition.match(/filename="([^"]+)"/i);
  if (asciiMatch?.[1]) {
    return asciiMatch[1];
  }
  return '';
}

async function pipeResponseToFile(res, outputFile) {
  if (!res.body) throw new Error('响应体为空');
  await new Promise((resolvePromise, rejectPromise) => {
    const writer = createWriteStream(outputFile);
    const reader = res.body.getReader();

    const pump = async () => {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (!writer.write(value)) {
            await new Promise((resume) => writer.once('drain', resume));
          }
        }
        writer.end();
      } catch (err) {
        writer.destroy(err);
      }
    };

    writer.on('finish', resolvePromise);
    writer.on('error', rejectPromise);
    void pump();
  });
}

async function loadConfig() {
  try {
    const raw = await readFile(DEFAULT_CONFIG_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      server: String(parsed.server || ''),
      password: String(parsed.password || ''),
    };
  } catch {
    return { server: '', password: '' };
  }
}

async function saveConfig(config) {
  await mkdir(DEFAULT_CONFIG_DIR, { recursive: true, mode: 0o700 });
  const content = JSON.stringify(config, null, 2);
  await writeFile(DEFAULT_CONFIG_FILE, `${content}\n`, { mode: 0o600 });
}

function formatError(err) {
  if (err instanceof Error) return err.message;
  return String(err);
}
