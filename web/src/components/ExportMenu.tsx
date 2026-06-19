import { useEffect, useRef, useState } from 'react';
import { Download } from 'lucide-react';
import type { ExportFormat } from '../noteExport';
import styles from './ExportMenu.module.css';

export interface ExportMenuProps {
  /** Whether any notes are available to export. Disables the trigger when false. */
  readonly disabled?: boolean;
  /** Invoked with the chosen format when the user picks an export option. */
  readonly onExport: (format: ExportFormat) => void;
}

const OPTIONS: ReadonlyArray<{ format: ExportFormat; label: string }> = [
  { format: 'md', label: 'Markdown (.md)' },
  { format: 'json', label: 'JSON (.json)' },
];

/**
 * Header action that opens a small menu letting the user export the current
 * notes as Markdown or JSON. Dismisses on outside-click and Escape, returning
 * focus to the trigger — mirroring the note card overflow menu.
 */
export function ExportMenu({ disabled = false, onExport }: ExportMenuProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  function close() {
    setOpen(false);
    triggerRef.current?.focus();
  }

  useEffect(() => {
    if (!open) return;

    function handleMouseDown(e: MouseEvent) {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (menuRef.current && !menuRef.current.contains(target)) {
        setOpen(false);
      }
    }

    function handleKeyDown(e: globalThis.KeyboardEvent) {
      if (e.key === 'Escape') {
        close();
      }
    }

    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  return (
    <div className={styles.wrapper}>
      <button
        ref={triggerRef}
        type="button"
        aria-label="Export notes"
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={disabled}
        className={styles.trigger}
        onClick={() => setOpen((prev) => !prev)}
      >
        <Download size={18} aria-hidden="true" />
      </button>

      {open && (
        <div ref={menuRef} role="menu" aria-label="Export format" className={styles.menu}>
          {OPTIONS.map(({ format, label }) => (
            <button
              key={format}
              type="button"
              role="menuitem"
              className={styles.menuItem}
              onClick={() => {
                onExport(format);
                close();
              }}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
