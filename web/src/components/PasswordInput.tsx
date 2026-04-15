import { useAtom } from 'jotai';
import { useCallback, useState } from 'react';
import { passwordAtom, passwordInvalidAtom, fetchAPI } from '../store/auth';
import { useT } from '../store/locale';

export const PasswordInput = () => {
  const [visible, setVisible] = useAtom(passwordInvalidAtom);
  const [password, setPassword] = useAtom(passwordAtom);
  const t = useT();

  const [validating, setValidating] = useState(false);
  const handleSubmit = useCallback((e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setValidating(true);
    fetchAPI('/api/list')
      .then(() => {
        window.dispatchEvent(new Event('records-updated'));
        setVisible(false);
        setValidating(false);
      })
      .catch(() => {
        setValidating(false);
      });
  }, []);

  return (
    !!visible && (
      <div className="password-mask">
        <form className="password-card" onSubmit={handleSubmit}>
          <h2 className="password-title">{t('password.title')}</h2>
          <p className="password-caption">{t('password.caption')}</p>

          <div className="password-field">
            <label className="password-label">{t('password.label')}</label>
            <input
              type="password"
              className="password-input"
              placeholder={t('password.placeholder')}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
            />
          </div>

          <div>
            <button className="btn btn-primary" type="submit" disabled={validating}>
              {validating ? t('password.validating') : t('password.ok')}
            </button>
          </div>
        </form>
      </div>
    )
  );
};
