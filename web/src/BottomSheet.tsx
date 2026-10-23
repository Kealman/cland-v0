import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { Shortcut } from './keymap.ts';
import s from './BottomSheet.module.css';

/** Shared phone modal: the native dialog owns focus/inertness, the viewport owns geometry. */
export function BottomSheet({ label, header, children, close, fullHeight = false }: { label: string; header: ReactNode; children: ReactNode; close: () => void; fullHeight?: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useLayoutEffect(() => {
    const node = dialog.current!;
    const previous = document.activeElement;
    const viewport = window.visualViewport;
    const resize = () => {
      node.style.top = `${viewport?.offsetTop ?? 0}px`;
      node.style.height = `${viewport?.height ?? window.innerHeight}px`;
      node.style.left = `${viewport?.offsetLeft ?? 0}px`;
      node.style.width = `${viewport?.width ?? window.innerWidth}px`;
    };
    resize();
    node.showModal();
    node.focus();
    viewport?.addEventListener('resize', resize);
    viewport?.addEventListener('scroll', resize);
    window.addEventListener('resize', resize);
    return () => {
      viewport?.removeEventListener('resize', resize);
      viewport?.removeEventListener('scroll', resize);
      window.removeEventListener('resize', resize);
      node.close();
      if (previous instanceof HTMLElement && previous.isConnected && previous.getClientRects().length) previous.focus();
    };
  }, []);
  return createPortal(<dialog ref={dialog} tabIndex={-1} aria-label={label} data-bottom-sheet data-key-context="sheet" className={s.overlay} onCancel={event => event.preventDefault()} onClick={event => { if (event.target === event.currentTarget) close(); }}>
    <section className={s.sheet} data-full-height={fullHeight || undefined}>
      <header className={s.header}>{header}<button type="button" data-sheet-close aria-label="Close sheet" onClick={close}>×</button></header>
      <div className={s.content}>{children}</div>
    </section>
  </dialog>, document.body);
}

/** Called by Shell's sole physical-key dispatcher. */
export function runBottomSheetShortcut(action: Shortcut): boolean {
  const sheet = document.querySelector<HTMLDialogElement>('[data-bottom-sheet][open]');
  if (!sheet) return false;
  if (action === 'sheet-close') sheet.querySelector<HTMLButtonElement>('[data-sheet-close]')?.click();
  return true;
}
