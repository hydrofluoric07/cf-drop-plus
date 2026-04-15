import { atom } from "jotai";
import { store } from ".";
import { invokeUploadAPI } from "../actions/upload";
import { clearFiles, inputFilesAtom, inputTextAtom } from "./input";
import { passwordAtom } from "./auth";

export const isUploadingAtom = atom(false);
export const uploadingProgressAtom = atom(0);
export const uploadingErrorAtom = atom<string | null>(null);

export function startUpload() {
  if (store.get(isUploadingAtom)) return; // uploading

  const text = store.get(inputTextAtom);
  const files = store.get(inputFilesAtom);
  if (!text && !files.length) {
    store.set(uploadingErrorAtom, 'error.noContent');
    return; // nothing to upload
  }

  store.set(isUploadingAtom, true);
  store.set(uploadingErrorAtom, null);

  // upload in foreground
  return invokeUploadAPI({
    text: text,
    files: files,
    password: store.get(passwordAtom),
    onProgress(percent) {
      store.set(uploadingProgressAtom, percent);
    },
  }).then(
    () => handleUploadEnd(),
    error => handleUploadEnd(error),
  );
}

function handleUploadEnd(error?: any) {
  store.set(isUploadingAtom, false);
  window.dispatchEvent(new Event('records-updated'));
  if (error) {
    console.error(error);
    const message = error instanceof Error
      ? error.message
      : String(error || 'error.unknown');
    store.set(uploadingErrorAtom, message || 'error.unknown');
  } else {
    store.set(inputTextAtom, '');
    clearFiles();
    store.set(uploadingProgressAtom, 0);
  }
}
