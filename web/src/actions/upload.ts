import type { FileStoreItem } from "../database/files";

/**
 * The actual upload logic, it invokes API /api/upload
 * 
 * can be used in either client or service worker.
 */
export async function invokeUploadAPI(opts: {
  text: string,
  files: FileStoreItem[],
  password: string,
  onProgress(percent: number): void,
}) {
  const { text, files, password, onProgress } = opts;
  const uploader = 'yon'; // TODO: change it
  const fileInfosStr = JSON.stringify(files.map(f => ({
    thumbnail: f.thumbnail,
    size: f.blob.size,
    type: f.blob.type,
    name: f.name,
  })))

  const body = new FormData();
  body.append('message', text);
  body.append('fileInfos', fileInfosStr);
  files.forEach((file) => body.append('files', file.blob));

  // (not works -- upload progress is not supported on http/1.1)
  // const bodyStream = getFormDataStream(body, (sent, total) => onProgress(sent / total * 100));
  // const res = await fetch('/api/upload', {
  //   method: 'POST',
  //   headers: {
  //     'x-uploader': uploader,
  //     'x-password': password,
  //     'content-type': `multipart/form-data; boundary=${bodyStream.boundary}`,
  //     'content-length': String(bodyStream.size),
  //   },
  //   body: bodyStream.stream,
  //   duplex: 'half',
  // });
  // const resText = await res.text();

  return new Promise<void>((resolve, reject) => {
    // ---- xhr way ----

    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/upload');
    xhr.setRequestHeader('x-uploader', uploader);
    xhr.setRequestHeader('x-password', password);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        const percentComplete = (e.loaded / e.total) * 100;
        onProgress(percentComplete);
      }
    };

    xhr.onload = () => {
      console.log('upload response', xhr.responseText);

      if (xhr.status === 200) {
        onProgress(100);
        resolve(JSON.parse(xhr.responseText));
        return;
      }

      reject(new Error('error.uploadFailed'));
    };

    xhr.onerror = (e) => {
      console.error('upload error', e);
      reject(new Error('error.uploadFailed'));
    };

    xhr.send(body);
  });
}
