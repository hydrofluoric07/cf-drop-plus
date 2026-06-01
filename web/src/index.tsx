import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'jotai';
import { store } from './store';
import App from './App';
import 'uno.css';
import { ensureLocaleReady } from './store/locale';
import { ensureThemeReady } from './store/theme';
import { ensureBackgroundReady } from './store/background';

const rootEl = document.getElementById('root');
if (rootEl) {
  Promise.all([ensureLocaleReady(), ensureThemeReady(), ensureBackgroundReady()]).finally(() => {
    void import('./sw-client');
    const root = ReactDOM.createRoot(rootEl);
    root.render(
      <React.StrictMode>
        <Provider store={store}>
          <App />
        </Provider>
      </React.StrictMode>,
    );
  });
}
