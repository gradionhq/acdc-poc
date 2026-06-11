import type { RefObject, FormEvent } from 'react';
import { Button } from './Button';
import { NOTE_COLORS, type NoteColor } from '../api';
import { countWords, countChars } from '../wordCount';
import styles from '../App.module.css';

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
  return (
    <form onSubmit={onSubmit} className={styles.form}>
      <div className={`${styles.card} ${styles.fieldGroup}`}>
        <h2 className={styles.formTitle}>New note</h2>
        <label className={styles.fieldLabel}>
          Title
          <input
            ref={newNoteTitleRef}
            className={styles.input}
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
          />
        </label>
        <label className={styles.fieldLabel}>
          Body
          <textarea
            className={styles.textarea}
            value={body}
            onChange={(e) => onBodyChange(e.target.value)}
          />
        </label>
        <p aria-live="polite" className={styles.wordCount}>
          {countWords(body)} {countWords(body) === 1 ? 'word' : 'words'}, {countChars(body)}{' '}
          {countChars(body) === 1 ? 'character' : 'characters'}
        </p>
        <label className={styles.fieldLabel}>
          Tags
          <input
            className={styles.input}
            aria-label="Tags"
            placeholder="comma-separated tags"
            value={tagsInput}
            onChange={(e) => onTagsInputChange(e.target.value)}
          />
        </label>
        <fieldset className={styles.fieldLabel}>
          <legend>Color</legend>
          <div className={styles.colorPicker}>
            {NOTE_COLORS.map((c) => {
              const swatchKey = `swatch-${c}` as keyof typeof styles;
              const swatchCls = [
                styles.colorSwatch,
                styles[swatchKey],
                color === c ? styles.colorSwatchSelected : '',
              ].join(' ');
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
