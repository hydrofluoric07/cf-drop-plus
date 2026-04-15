import { useAtom } from 'jotai';
import { useCallback, useState } from 'react';
import { passwordAtom, passwordInvalidAtom, fetchAPI } from '../store/auth';

export const PasswordInput = () => {
  const [visible, setVisible] = useAtom(passwordInvalidAtom);
  const [password, setPassword] = useAtom(passwordAtom);

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
          <h2 className="password-title">Password required</h2>
          <p className="password-caption">Enter the shared key to unlock upload history and files.</p>

          <div className="password-field">
            <label className="password-label">Password</label>
            <input
              type="password"
              className="password-input"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
            />
          </div>

          <div>
            <button className="btn btn-primary" type="submit" disabled={validating}>
              {validating ? 'Validating...' : 'OK'}
            </button>
          </div>
        </form>
      </div>
    )
  );
};
