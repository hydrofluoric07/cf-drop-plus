import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'jotai';
import { store } from './store';
import App from './App';
import 'uno.css';
import { ensureLocaleReady } from './store/locale';

const rootEl = document.getElementById('root');
if (rootEl) {
  ensureLocaleReady().finally(() => {
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
