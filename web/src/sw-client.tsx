import { Workbox } from 'workbox-window';
import { tRuntime } from './i18n';
import { showGlobalMessage } from './store';

let wb: Workbox | null = null;
if ('serviceWorker' in navigator) {
  wb = new Workbox('/sw.js');
  wb.addEventListener('waiting', () => {
    showGlobalMessage({
      type: 'info',
      text: tRuntime('sw.newVersion'),
      durationMs: 5000,
      onClick: () => {
        if (!wb) return;

        wb.addEventListener('controlling', () => {
          window.location.reload();
        });
        wb.messageSkipWaiting();
      },
    });

  });
  wb.register();
}

export function getWorkbox() {
  return wb;
}
