import { memo, useEffect, useRef, useState } from 'react';
import { useT } from '../store/locale';

export const PopoverConfirm = memo(({ children, onConfirm }: { children: React.ReactNode, onConfirm: () => void }) => {
  const [visible, setVisible] = useState(false);
  const t = useT();
  const confirmBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const el = visible && confirmBtnRef.current;
    if (!el) return;

    const onBlur = () => {
      setVisible(false);
    };
    el.addEventListener('blur', onBlur);
    el.focus();

    return () => el.removeEventListener('blur', onBlur);
  }, [visible]);

  return (
    <div className="relative inline-flex">
      <div onClick={() => setVisible(true)}>{children}</div>

      {
        visible && (<div className="confirm-pop">
          <button className="btn btn-ghost" onClick={() => setVisible(false)}>{t('common.no')}</button>
          <button className="btn btn-danger" onClick={onConfirm} ref={confirmBtnRef}>{t('common.yes')}</button>
        </div>)
      }
    </div>
  );
});
