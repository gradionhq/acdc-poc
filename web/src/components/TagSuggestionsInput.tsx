/**
 * TagSuggestionsInput — accessible combobox that combines a free-text tags
 * input with a filtered suggestion list sourced from existing tags.
 *
 * The current text after the last comma (the "active segment") is compared
 * case-insensitively against the provided suggestions.  Selecting a suggestion
 * replaces the active segment with the chosen tag and appends a comma+space so
 * the user can keep typing the next tag.
 *
 * Keyboard contract (ARIA combobox pattern):
 *  ArrowDown  — open list / move focus down
 *  ArrowUp    — move focus up
 *  Enter      — confirm highlighted suggestion (or let the form submit if none)
 *  Escape     — close the suggestion list
 *  Click      — select a suggestion with the mouse
 */
import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { Tag } from 'lucide-react';
import styles from './NoteComposer.module.css';
import dropdownStyles from './TagSuggestionsInput.module.css';

export interface TagSuggestionsInputProps {
  /** Controlled value (the full comma-separated string). */
  value: string;
  /** Called whenever the value changes. */
  onChange: (value: string) => void;
  /** Pool of existing tag names to filter suggestions from. */
  suggestions: string[];
  /** id forwarded to the underlying <input> (must match the <label htmlFor>). */
  id: string;
  /** aria-label for the <input> element. */
  ariaLabel?: string;
  /** Placeholder text for the <input>. */
  placeholder?: string;
}

/** Return the text segment the user is currently typing (text after last comma). */
function activeSegment(value: string): string {
  const parts = value.split(',');
  return parts[parts.length - 1].trimStart();
}

/** Replace the last segment of a comma-separated value with a new tag. */
function replaceLastSegment(value: string, tag: string): string {
  const parts = value.split(',');
  parts[parts.length - 1] = tag;
  return parts.join(', ');
}

export function TagSuggestionsInput({
  value,
  onChange,
  suggestions,
  id,
  ariaLabel = 'Tags',
  placeholder = 'comma-separated tags',
}: TagSuggestionsInputProps) {
  const listboxId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  // Tags already entered (all segments except the active one) — used to exclude
  // already-chosen tags from the suggestion list.
  const alreadyChosen = value
    .split(',')
    .slice(0, -1)
    .map((t) => t.trim().toLowerCase());

  const segment = activeSegment(value);

  const filtered =
    segment.trim() === ''
      ? []
      : suggestions.filter(
          (s) =>
            s.toLowerCase().includes(segment.toLowerCase()) &&
            !alreadyChosen.includes(s.toLowerCase()),
        );

  const isOpen = open && filtered.length > 0;

  // Reset active index whenever the filtered list changes.
  useEffect(() => {
    setActiveIndex(-1);
  }, [filtered.length]);

  const closeList = useCallback(() => {
    setOpen(false);
    setActiveIndex(-1);
  }, []);

  function selectSuggestion(tag: string) {
    const next = replaceLastSegment(value, tag) + ', ';
    onChange(next);
    closeList();
    inputRef.current?.focus();
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!isOpen) {
      if (e.key === 'ArrowDown' && filtered.length > 0) {
        setOpen(true);
        setActiveIndex(0);
        e.preventDefault();
      }
      return;
    }
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActiveIndex((i) => (i < filtered.length - 1 ? i + 1 : i));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveIndex((i) => (i > 0 ? i - 1 : 0));
        break;
      case 'Enter':
        if (activeIndex >= 0) {
          e.preventDefault();
          selectSuggestion(filtered[activeIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        closeList();
        break;
      default:
        break;
    }
  }

  // Close on outside click.
  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      const target = e.target as Node;
      if (!inputRef.current?.contains(target) && !listRef.current?.contains(target)) {
        closeList();
      }
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [closeList]);

  const activeOptionId = activeIndex >= 0 ? `${listboxId}-opt-${activeIndex}` : undefined;

  return (
    <div className={styles.tagsWrapper}>
      <Tag size={14} className={styles.tagsIcon} aria-hidden="true" />
      <input
        ref={inputRef}
        id={id}
        role="combobox"
        aria-label={ariaLabel}
        aria-autocomplete="list"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        aria-activedescendant={activeOptionId}
        className={`${styles.input} ${styles.tagsInput}`}
        placeholder={placeholder}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onKeyDown={handleKeyDown}
        onFocus={() => {
          if (filtered.length > 0) setOpen(true);
        }}
        autoComplete="off"
      />
      {isOpen && (
        <ul
          ref={listRef}
          id={listboxId}
          role="listbox"
          aria-label="Tag suggestions"
          className={dropdownStyles.dropdown}
        >
          {filtered.map((tag, i) => (
            <li
              key={tag}
              id={`${listboxId}-opt-${i}`}
              role="option"
              aria-selected={i === activeIndex}
              className={[
                dropdownStyles.option,
                i === activeIndex ? dropdownStyles.optionActive : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onPointerDown={(e) => {
                // Prevent blur on the input before the click registers.
                e.preventDefault();
                selectSuggestion(tag);
              }}
            >
              {tag}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
