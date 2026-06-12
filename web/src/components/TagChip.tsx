import type { TagColor } from '../api';
import styles from './TagChip.module.css';

export interface TagChipProps {
  tag: string;
  /** Assigned color, or null/undefined for the default chip style. */
  color?: TagColor | null;
  /** Optional extra class names appended to the chip. */
  className?: string;
}

/**
 * A tag chip rendered in its assigned palette color, or the default indigo
 * style when no color is set. Shared across NoteCard, FilterBar and TagManager
 * so the colored appearance stays consistent everywhere tags are shown.
 *
 * `data-tag` and `data-tag-color` are exposed for tests and e2e assertions.
 */
export function TagChip({ tag, color, className }: TagChipProps) {
  const colorClass = color ? styles[`chip-${color}` as keyof typeof styles] : '';
  const classes = [styles.chip, colorClass, className].filter(Boolean).join(' ');
  return (
    <span className={classes} data-tag={tag} data-tag-color={color ?? 'none'}>
      {tag}
    </span>
  );
}
