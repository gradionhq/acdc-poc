import { useRef, type RefObject, type FormEvent, type KeyboardEvent } from 'react';
import { PenLine } from 'lucide-react';
import { Button } from './Button';
import { NOTE_COLORS, type NoteColor } from '../api';
import { countWords, countChars } from '../wordCount';
import { TagSuggestionsInput } from './TagSuggestionsInput';
import { MarkdownToolbar, shortcutAction } from './MarkdownToolbar';
import { applyMarkdown } from '../markdownFormat';
import { NOTE_TEMPLATES, templateSeed, type TemplateSeed } from '../noteTemplates';
import styles from './NoteComposer.module.css';

export interface NoteComposerProps {
  title: string;
  onTitleChange: (value: string) => void;
  body: string;
  onBodyChange: (value: string) => void;
  tagsInput: string;
  onTagsInputChange: (value: string) => void;
  /** Existing tag names used to power the autocomplete suggestion list. */
  tagSuggestions?: string[];
  color: NoteColor;
  onColorChange: (color: NoteColor) => void;
  onSubmit: (e: FormEvent) => void;
  newNoteTitleRef: RefObject<HTMLInputElement>;
  /**
   * Called when the user picks a built-in template. Receives the seed values
   * (title/body/tagsInput/color) the composer fields should be set to. When
   * omitted, the template picker is hidden.
   */
  onApplyTemplate?: (seed: TemplateSeed) => void;
  /**
   * When true the composer is hosted inside a modal dialog that already
   * supplies the panel chrome and "New note" heading, so the form drops its
   * own card surface and internal heading to avoid visual/heading duplication.
   */
  embedded?: boolean;
}

export function NoteComposer({
  title,
  onTitleChange,
  body,
  onBodyChange,
  tagsInput,
  onTagsInputChange,
  tagSuggestions = [],
  color,
  onColorChange,
  onSubmit,
  newNoteTitleRef,
  onApplyTemplate,
  embedded = false,
}: NoteComposerProps) {
  const words = countWords(body);
  const chars = countChars(body);

  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const formClass = embedded ? styles.formEmbedded : styles.form;
  const groupClass = embedded ? styles.fieldGroup : `${styles.card} ${styles.fieldGroup}`;

  function handleBodyKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    const action = shortcutAction(e);
    if (!action) return;
    e.preventDefault();
    const textarea = e.currentTarget;
    const result = applyMarkdown(action, {
      value: textarea.value,
      selectionStart: textarea.selectionStart,
      selectionEnd: textarea.selectionEnd,
    });
    onBodyChange(result.value);
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(result.selectionStart, result.selectionEnd);
    });
  }

  return (
    <form onSubmit={onSubmit} aria-label="New note" className={formClass}>
      <div className={groupClass}>
        {!embedded && (
          <div className={styles.formHeader}>
            <PenLine size={16} className={styles.formTitleIcon} aria-hidden="true" />
            <h2 className={styles.formTitle}>New note</h2>
          </div>
        )}

        {onApplyTemplate && (
          <fieldset className={styles.templateFieldset}>
            <legend className={styles.templateLegend}>Start from a template</legend>
            <div className={styles.templatePicker}>
              {NOTE_TEMPLATES.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  className={styles.templateButton}
                  onClick={() => onApplyTemplate(templateSeed(template))}
                >
                  {template.label}
                </button>
              ))}
            </div>
          </fieldset>
        )}

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
          <MarkdownToolbar textareaRef={bodyRef} onChange={onBodyChange} />
          <textarea
            id="composer-body"
            ref={bodyRef}
            className={styles.textarea}
            value={body}
            placeholder="Write your note…"
            onChange={(e) => onBodyChange(e.target.value)}
            onKeyDown={handleBodyKeyDown}
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
          <TagSuggestionsInput
            id="composer-tags"
            ariaLabel="Tags"
            value={tagsInput}
            onChange={onTagsInputChange}
            suggestions={tagSuggestions}
          />
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
