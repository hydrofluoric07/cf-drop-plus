import { memo, useEffect, useRef, useState } from 'react';
import { useConsistCallback } from '../utils/useConsistCallback';
import { createThumbnail } from '../utils/createThumbnail';
import { getFilesFromDataTransfer } from '../utils/fileEntry';
import { FileStoreItem } from '../database/files';
import { addFiles, clearFiles, inputFilesAtom, inputTextAtom, removeFile } from '../store/input';
import { useAtom } from 'jotai';
import { startUpload } from '../store/uploading';

export const ContentInput = memo(() => {
  const [files] = useAtom(inputFilesAtom)
  const [text, setText] = useAtom(inputTextAtom);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  const [isDragOver, setIsDragOver] = useState(false);
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      // Handle pasted files
      getFilesFromDataTransfer(e.clipboardData).then((droppedFiles) => addFiles(droppedFiles));

      // Handle pasted text
      const pastedText = e.clipboardData?.getData('text/plain');
      if (pastedText) {
        const textarea = textAreaRef.current;
        if (textarea) {
          textarea.focus();
          const selectionStart = textarea.selectionStart;
          const selectionEnd = textarea.selectionEnd;
          const oldText = textarea.value;
          const newText = oldText.slice(0, selectionStart) + pastedText + oldText.slice(selectionEnd);
          setText(newText);

          setTimeout(() => {
            textarea.selectionStart = selectionStart + pastedText.length;
            textarea.selectionEnd = selectionStart + pastedText.length;
          }, 0);
        } else {
          setText(pastedText);
        }
      }

      e.preventDefault();
      e.stopPropagation();
    };

    const handleDragOver = (e: DragEvent) => {
      if (!e.dataTransfer?.types.some((type) => type === 'Files')) return;

      e.preventDefault();
      e.stopPropagation();

      setIsDragOver(true);
    };

    window.addEventListener('paste', handlePaste, true);
    window.addEventListener('dragover', handleDragOver, true);

    return () => {
      window.removeEventListener('paste', handlePaste, true);
      window.removeEventListener('dragover', handleDragOver, true);
    };
  }, []);

  useEffect(() => {
    if (!isDragOver) {
      document.body.style.pointerEvents = 'auto';
      return;
    }

    document.body.style.pointerEvents = 'none';

    const handleDragLeave = () => {
      setIsDragOver(false);
    };

    const handleDrop = (e: DragEvent) => {
      setIsDragOver(false);
      e.preventDefault();
      e.stopPropagation();

      getFilesFromDataTransfer(e.dataTransfer).then((droppedFiles) => addFiles(droppedFiles));
    };

    window.addEventListener('drop', handleDrop, true);
    window.addEventListener('dragleave', handleDragLeave, true);

    return () => {
      window.removeEventListener('drop', handleDrop, true);
      window.removeEventListener('dragleave', handleDragLeave, true);
    };
  }, [isDragOver]);

  const handleTextChange = useConsistCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
  });

  const openFilePicker = useConsistCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.click();
    input.onchange = (e: any) => {
      const files = Array.from(e.target.files) as File[];
      addFiles(files).then(() => { input.value = '' });
    };
  });

  const handleRemoveFile = useConsistCallback((id: number) => {
    removeFile(id);
  });

  const handleSend = useConsistCallback(() => {
    startUpload();
  });
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !e.isComposing) {
        startUpload();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [startUpload]);

  const doClear = useConsistCallback(() => {
    setText('');
    clearFiles();
  });

  return (
    <div
      tabIndex={-1}
      className="composer"
      onKeyDown={(e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
          handleSend();
        }
      }}
    >
      <div className="composer-input-row">
        <textarea
          ref={textAreaRef}
          value={text}
          onChange={handleTextChange}
          className="composer-textarea"
          placeholder="Type or paste text / files here..."
        />
      </div>

      <div className="composer-toolbar">
        <div className="composer-toolbar-left">
          <button className="btn btn-ghost composer-tool-btn" onClick={openFilePicker} key="addFileBtn">
            <i className="i-lucide-folder-plus"></i>
            Add file
          </button>

          <button onClick={doClear} className="btn btn-ghost composer-tool-btn" key="clearBtn">
            <i className="i-lucide-eraser"></i>
            Clear
          </button>
        </div>

        <div className="composer-toolbar-right">
          <button className="btn btn-primary composer-send composer-tool-btn" onClick={handleSend} disabled={!text && !files.length}>
            <i className="i-lucide-send"></i>
            <span>Send</span>
          </button>
        </div>
      </div>

      {!!files.length && <div className="composer-files">
        {files.map((file) => <AttachedFileItem
          key={file.id}
          file={file}
          removeFile={handleRemoveFile}
        />)}
      </div>}

      {!!isDragOver && (
        <div className="drop-mask">
          <div className="drop-mask-card animate-slide-in-up animate-duration-200">
            <i className="i-lucide-upload text-[42px]" />
            <div>Drop files to add</div>
          </div>
        </div>
      )}
    </div>
  );
});

declare global {
  interface File {
    thumbnail?: string;
  }
}

function AttachedFileItem({ file, removeFile }: { file: FileStoreItem; removeFile: (id: number) => void; }) {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    const url = URL.createObjectURL(file.blob);
    setUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  return <div className="file-pill">
    {file.thumbnail ? (
      <img src={file.thumbnail} className="file-pill-thumb" />
    ) : (
      <i className="i-lucide-file text-[18px] text-gray" />
    )}
    <a
      download={file.name}
      href={url}
      title={file.name}
      className="file-pill-link">{file.name}</a>
    <button
      onClick={() => removeFile(file.id)}
      className="file-pill-remove"
    >
      <i className="i-lucide-x"></i>
    </button>
  </div>;
}

export async function addThumbnail(file: File) {
  if (!file.type.startsWith('image/')) return false;
  if (file.thumbnail) return false; // already has thumbnail

  const url = URL.createObjectURL(file);
  try {
    file.thumbnail = await createThumbnail(url);
  } finally {
    URL.revokeObjectURL(url);
  }

  return true;
}
