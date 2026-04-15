import { memo, useEffect, useRef, useState } from 'react';

export const PopoverConfirm = memo(({ children, onConfirm }: { children: React.ReactNode, onConfirm: () => void }) => {
  const [visible, setVisible] = useState(false);
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
          <button className="btn btn-ghost" onClick={() => setVisible(false)}>No</button>
          <button className="btn btn-danger" onClick={onConfirm} ref={confirmBtnRef}>Yes</button>
        </div>)
      }
    </div>
  );
});
