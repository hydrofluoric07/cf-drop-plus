import { atom } from "jotai";
import { store } from ".";
import { invokeUploadAPI, type UploadAPIResponse } from "../actions/upload";
import { clearFiles, inputFilesAtom, inputTextAtom } from "./input";
import { passwordAtom } from "./auth";
import type { UploadRecord } from "../../../src/database";

export const isUploadingAtom = atom(false);
export const uploadingProgressAtom = atom(0);
export const uploadingErrorAtom = atom<string | null>(null);
export const RECORD_CREATED_EVENT = 'record-created';

export interface RecordCreatedEventDetail {
  record: UploadRecord;
}

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
    (response) => handleUploadEnd(undefined, response),
    error => handleUploadEnd(error),
  );
}

function handleUploadEnd(error?: any, response?: UploadAPIResponse) {
  store.set(isUploadingAtom, false);
  if (error) {
    console.error(error);
    const message = error instanceof Error
      ? error.message
      : String(error || 'error.unknown');
    store.set(uploadingErrorAtom, message || 'error.unknown');
  } else {
    const createdRecord = response?.record?.inserted;
    if (createdRecord) {
      window.dispatchEvent(new CustomEvent<RecordCreatedEventDetail>(RECORD_CREATED_EVENT, {
        detail: { record: createdRecord },
      }));
    } else {
      window.dispatchEvent(new Event('records-updated'));
    }
    store.set(inputTextAtom, '');
    clearFiles();
    store.set(uploadingProgressAtom, 0);
  }
}
