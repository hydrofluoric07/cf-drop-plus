import { memo, useCallback, useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { createPortal } from 'react-dom';
import { useT } from '../store/locale';

const CONFIRM_MENU_WIDTH = 108;
const CONFIRM_MENU_ESTIMATED_HEIGHT = 80;
const CONFIRM_MENU_GAP = 6;
const CONFIRM_MENU_VIEWPORT_PADDING = 8;

interface ConfirmMenuPosition {
  top: number;
  left: number;
}

export const PopoverConfirm = memo(({ children, onConfirm }: { children: React.ReactNode, onConfirm: () => void }) => {
  const [visible, setVisible] = useState(false);
  const [menuPosition, setMenuPosition] = useState<ConfirmMenuPosition | null>(null);
  const t = useT();
  const triggerRef = useRef<HTMLDivElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  const resolveMenuPosition = useCallback((triggerRect: DOMRect) => {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let left = triggerRect.right - CONFIRM_MENU_WIDTH;
    left = Math.max(
      CONFIRM_MENU_VIEWPORT_PADDING,
      Math.min(left, viewportWidth - CONFIRM_MENU_WIDTH - CONFIRM_MENU_VIEWPORT_PADDING),
    );

    let top = triggerRect.bottom + CONFIRM_MENU_GAP;
    top = Math.max(
      CONFIRM_MENU_VIEWPORT_PADDING,
      Math.min(top, viewportHeight - CONFIRM_MENU_ESTIMATED_HEIGHT - CONFIRM_MENU_VIEWPORT_PADDING),
    );

    return { top, left };
  }, []);

  useEffect(() => {
    if (!visible) return;

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (popRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      setVisible(false);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setVisible(false);
      }
    };

    const onViewportChange = () => {
      setVisible(false);
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', onViewportChange);
    window.addEventListener('scroll', onViewportChange, true);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', onViewportChange);
      window.removeEventListener('scroll', onViewportChange, true);
    };
  }, [visible]);

  const handleToggle = useCallback((event: ReactMouseEvent<HTMLDivElement>) => {
    if (visible) {
      setVisible(false);
      return;
    }

    const triggerRect = event.currentTarget.getBoundingClientRect();
    setMenuPosition(resolveMenuPosition(triggerRect));
    setVisible(true);
  }, [resolveMenuPosition, visible]);

  const overlay = visible && menuPosition && typeof document !== 'undefined'
    ? createPortal(
      <div
        ref={popRef}
        className="confirm-pop"
        style={{ top: `${menuPosition.top}px`, left: `${menuPosition.left}px` }}
      >
        <button
          type="button"
          className="confirm-pop-item is-danger"
          onClick={() => {
            setVisible(false);
            onConfirm();
          }}
        >
          {t('common.yes')}
        </button>
        <button type="button" className="confirm-pop-item" onClick={() => setVisible(false)}>{t('common.no')}</button>
      </div>,
      document.body,
    )
    : null;

  return (
    <>
      <div ref={triggerRef} className="relative inline-flex" onClick={handleToggle}>{children}</div>
      {overlay}
    </>
  );
});
