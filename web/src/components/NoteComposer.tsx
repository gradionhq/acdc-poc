import type { RefObject, FormEvent } from 'react';
import { PenLine, Tag } from 'lucide-react';
import { Button } from './Button';
import { NOTE_COLORS, type NoteColor } from '../api';
import { countWords, countChars } from '../wordCount';
import styles from './NoteComposer.module.css';

export interface NoteComposerProps {
  title: string;
  onTitleChange: (value: string) => void;
  body: string;
  onBodyChange: (value: string) => void;
  tagsInput: string;
  onTagsInputChange: (value: string) => void;
  color: NoteColor;
  onColorChange: (color: NoteColor) => void;
  onSubmit: (e: FormEvent) => void;
  newNoteTitleRef: RefObject<HTMLInputElement>;
}

export function NoteComposer({
  title,
  onTitleChange,
  body,
  onBodyChange,
  tagsInput,
  onTagsInputChange,
  color,
  onColorChange,
  onSubmit,
  newNoteTitleRef,
}: NoteComposerProps) {
  const words = countWords(body);
  const chars = countChars(body);

  return (
    <form onSubmit={onSubmit} className={styles.form}>
      <div className={`${styles.card} ${styles.fieldGroup}`}>
        <div className={styles.formHeader}>
          <PenLine size={16} className={styles.formTitleIcon} aria-hidden="true" />
          <h2 className={styles.formTitle}>New note</h2>
        </div>

        <label className={styles.field}>
          <span className={styles.fieldLabel}>Title</span>
          <input
            ref={newNoteTitleRef}
            className={styles.input}
            value={title}
            placeholder="Note title…"
            onChange={(e) => onTitleChange(e.target.value)}
          />
        </label>

        <div className={styles.field}>
          <label className={styles.fieldLabel} htmlFor="composer-body">
            Body
          </label>
          <textarea
            id="composer-body"
            className={styles.textarea}
            value={body}
            placeholder="Write your note…"
            onChange={(e) => onBodyChange(e.target.value)}
            aria-label="Body"
          />
          <p aria-live="polite" className={styles.wordCount}>
            {words} {words === 1 ? 'word' : 'words'}, {chars}{' '}
            {chars === 1 ? 'character' : 'characters'}
          </p>
        </div>

        <div className={styles.field}>
          <label className={styles.fieldLabel} htmlFor="composer-tags">
            Tags
          </label>
          <div className={styles.tagsWrapper}>
            <Tag size={14} className={styles.tagsIcon} aria-hidden="true" />
            <input
              id="composer-tags"
              className={`${styles.input} ${styles.tagsInput}`}
              aria-label="Tags"
              placeholder="comma-separated tags"
              value={tagsInput}
              onChange={(e) => onTagsInputChange(e.target.value)}
            />
          </div>
        </div>

        <fieldset className={styles.colorFieldset}>
          <legend className={styles.colorLegend}>Color</legend>
          <div className={styles.colorPicker}>
            {NOTE_COLORS.map((c) => {
              const swatchKey = `swatch-${c}` as keyof typeof styles;
              const swatchCls = [
                styles.colorSwatch,
                styles[swatchKey],
                color === c ? styles.colorSwatchSelected : '',
              ]
                .filter(Boolean)
                .join(' ');
              return (
                <button
                  key={c}
                  type="button"
                  aria-label={`Color ${c}`}
                  aria-pressed={color === c}
                  className={swatchCls}
                  onClick={() => onColorChange(c)}
                />
              );
            })}
          </div>
        </fieldset>

        <div className={styles.formActions}>
          <Button type="submit" variant="primary">
            Add note
          </Button>
        </div>
      </div>
    </form>
  );
}
