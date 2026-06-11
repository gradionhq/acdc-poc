import { useEffect, useState } from 'react';
import { deleteTag, listTags, renameTag, type TagStat } from './api';
import { Button } from './components/Button';
import styles from './TagManager.module.css';

interface Props {
  /** Called after any rename or delete so the parent can re-fetch notes. */
  onChanged: () => void;
}

export function TagManager({ onChanged }: Props) {
  const [tags, setTags] = useState<TagStat[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** tag → rename input value while the rename row is open */
  const [renamingTag, setRenamingTag] = useState<string | null>(null);
  const [renameInput, setRenameInput] = useState('');

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

  async function handleDelete(tag: string) {
    if (!window.confirm(`Delete tag "${tag}" from all notes?`)) return;
    setError(null);
    try {
      await deleteTag(tag);
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
          {tags.map(({ tag, count }) => (
            <li key={tag} className={styles.tagRow}>
              {renamingTag === tag ? (
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
              ) : (
                <>
                  <span className={styles.tagName} data-tag={tag}>
                    {tag}
                  </span>
                  <span
                    className={styles.tagCount}
                    aria-label={`${count} note${count === 1 ? '' : 's'}`}
                  >
                    {count} {count === 1 ? 'note' : 'notes'}
                  </span>
                  <Button
                    variant="secondary"
                    aria-label={`Rename tag ${tag}`}
                    onClick={() => startRename(tag)}
                  >
                    Rename
                  </Button>
                  <Button
                    variant="danger"
                    aria-label={`Delete tag ${tag}`}
                    onClick={() => void handleDelete(tag)}
                  >
                    Delete
                  </Button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
