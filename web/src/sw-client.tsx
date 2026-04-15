import { Workbox } from 'workbox-window';
import { tRuntime } from './i18n';

let wb: Workbox | null = null;
if ('serviceWorker' in navigator) {
  wb = new Workbox('/sw.js');
  wb.addEventListener('waiting', () => {
    const toast = document.createElement('div');
    toast.className = 'bg-brand-6 text-white text-sm p-2 fixed top-0 left-0 right-0 z-50 animate-slide-in-down animate-duration-200 cursor-pointer';
    toast.innerText = tRuntime('sw.newVersion');
    document.body.appendChild(toast);
    toast.addEventListener('click', () => {
      wb!.addEventListener('controlling', () => {
        window.location.reload();
      })
      wb!.messageSkipWaiting();
    });
  });
  wb.register();
}

export function getWorkbox() {
  return wb;
}
