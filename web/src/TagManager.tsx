import { useEffect, useState } from 'react';
import {
  deleteTag,
  listTags,
  mergeTag,
  renameTag,
  setTagColor,
  TAG_COLORS,
  type TagColor,
  type TagStat,
} from './api';
import { Button } from './components/Button';
import { TagChip } from './components/TagChip';
import { ConfirmDialog } from './ConfirmDialog';
import styles from './TagManager.module.css';

interface Props {
  /** Called after any rename, merge or delete so the parent can re-fetch notes. */
  onChanged: () => void;
}

/** A confirmation the user must accept before a destructive change is applied. */
type PendingConfirm = { kind: 'delete'; tag: string } | { kind: 'merge'; from: string; to: string };

export function TagManager({ onChanged }: Props) {
  const [tags, setTags] = useState<TagStat[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** tag → rename input value while the rename row is open */
  const [renamingTag, setRenamingTag] = useState<string | null>(null);
  const [renameInput, setRenameInput] = useState('');

  /** tag → chosen merge target while the merge row is open */
  const [mergingTag, setMergingTag] = useState<string | null>(null);
  const [mergeTarget, setMergeTarget] = useState('');

  /** A destructive action awaiting confirmation, or null when none is pending. */
  const [pending, setPending] = useState<PendingConfirm | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setTags(await listTags());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function startRename(tag: string) {
    setRenamingTag(tag);
    setRenameInput(tag);
    setMergingTag(null);
    setError(null);
  }

  function cancelRename() {
    setRenamingTag(null);
    setRenameInput('');
    setError(null);
  }

  async function commitRename(from: string) {
    const to = renameInput.trim();
    if (!to) return;
    setError(null);
    try {
      await renameTag(from, to);
      setRenamingTag(null);
      setRenameInput('');
      await load();
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  function startMerge(tag: string) {
    setMergingTag(tag);
    setMergeTarget('');
    setRenamingTag(null);
    setError(null);
  }

  function cancelMerge() {
    setMergingTag(null);
    setMergeTarget('');
    setError(null);
  }

  function requestMerge(from: string) {
    const to = mergeTarget.trim();
    if (!to) return;
    setPending({ kind: 'merge', from, to });
  }

  async function handleColorChange(tag: string, color: TagColor) {
    setError(null);
    try {
      await setTagColor(tag, color);
      await load();
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  function requestDelete(tag: string) {
    setPending({ kind: 'delete', tag });
  }

  async function confirmPending() {
    const action = pending;
    setPending(null);
    if (!action) return;
    setError(null);
    try {
      if (action.kind === 'delete') {
        await deleteTag(action.tag);
      } else {
        await mergeTag(action.from, action.to);
        setMergingTag(null);
        setMergeTarget('');
      }
      await load();
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <section aria-label="Tag manager" className={styles.panel}>
      <h2 className={styles.heading}>Manage tags</h2>
      {error && (
        <p role="alert" className={styles.alert}>
          {error}
        </p>
      )}
      {loading && <p className={styles.loading}>Loading…</p>}
      {!loading && tags.length === 0 && <p className={styles.empty}>No tags in use yet.</p>}
      {tags.length > 0 && (
        <ul className={styles.tagList} aria-label="Tag list">
          {tags.map(({ tag, count, color }) => (
            <li key={tag} className={styles.tagRow}>
              {renamingTag === tag && (
                <>
                  <input
                    aria-label={`Rename ${tag}`}
                    className={styles.renameInput}
                    value={renameInput}
                    onChange={(e) => setRenameInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void commitRename(tag);
                      if (e.key === 'Escape') cancelRename();
                    }}
                    autoFocus
                  />
                  <Button variant="primary" onClick={() => void commitRename(tag)}>
                    Save
                  </Button>
                  <Button variant="secondary" onClick={cancelRename}>
                    Cancel
                  </Button>
                </>
              )}
              {mergingTag === tag && (
                <>
                  <TagChip tag={tag} color={color} className={styles.tagName} />
                  <span className={styles.mergeInto}>into</span>
                  <select
                    aria-label={`Merge ${tag} into`}
                    className={styles.mergeSelect}
                    value={mergeTarget}
                    onChange={(e) => setMergeTarget(e.target.value)}
                    autoFocus
                  >
                    <option value="">Select a tag…</option>
                    {tags
                      .filter((t) => t.tag !== tag)
                      .map((t) => (
                        <option key={t.tag} value={t.tag}>
                          {t.tag}
                        </option>
                      ))}
                  </select>
                  <Button
                    variant="primary"
                    disabled={!mergeTarget}
                    onClick={() => requestMerge(tag)}
                  >
                    Merge
                  </Button>
                  <Button variant="secondary" onClick={cancelMerge}>
                    Cancel
                  </Button>
                </>
              )}
              {renamingTag !== tag && mergingTag !== tag && (
                <>
                  <TagChip tag={tag} color={color} className={styles.tagName} />
                  <span
                    className={styles.tagCount}
                    aria-label={`${count} note${count === 1 ? '' : 's'}`}
                  >
                    {count} {count === 1 ? 'note' : 'notes'}
                  </span>
                  <fieldset className={styles.colorPicker}>
                    <legend className={styles.srOnly}>Color for {tag}</legend>
                    {TAG_COLORS.map((c) => {
                      const swatchKey = `swatch-${c}` as keyof typeof styles;
                      const cls = [
                        styles.colorSwatch,
                        styles[swatchKey],
                        color === c ? styles.colorSwatchSelected : '',
                      ].join(' ');
                      return (
                        <button
                          key={c}
                          type="button"
                          aria-label={`Set ${tag} color ${c}`}
                          aria-pressed={color === c}
                          className={cls}
                          onClick={() => void handleColorChange(tag, c)}
                        />
                      );
                    })}
                  </fieldset>
                  <Button
                    variant="secondary"
                    aria-label={`Rename tag ${tag}`}
                    onClick={() => startRename(tag)}
                  >
                    Rename
                  </Button>
                  <Button
                    variant="secondary"
                    aria-label={`Merge tag ${tag}`}
                    disabled={tags.length < 2}
                    onClick={() => startMerge(tag)}
                  >
                    Merge
                  </Button>
                  <Button
                    variant="danger"
                    aria-label={`Delete tag ${tag}`}
                    onClick={() => requestDelete(tag)}
                  >
                    Delete
                  </Button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      {pending?.kind === 'delete' && (
        <ConfirmDialog
          title="Delete tag"
          message={`Delete tag "${pending.tag}" from all notes? This cannot be undone.`}
          confirmLabel="Delete"
          onConfirm={() => void confirmPending()}
          onCancel={() => setPending(null)}
        />
      )}
      {pending?.kind === 'merge' && (
        <ConfirmDialog
          title="Merge tags"
          message={`Merge "${pending.from}" into "${pending.to}"? Every note tagged "${pending.from}" will be tagged "${pending.to}" instead.`}
          confirmLabel="Merge"
          onConfirm={() => void confirmPending()}
          onCancel={() => setPending(null)}
        />
      )}
    </section>
  );
}
