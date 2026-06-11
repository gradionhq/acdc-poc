import ReactMarkdown from 'react-markdown';
import styles from './NoteBody.module.css';

export interface NoteBodyProps {
  /** Raw Markdown source for the note body. */
  body: string;
  /** Optional CSS class applied to the wrapping div. */
  className?: string;
}

/**
 * Renders a note body as formatted Markdown.
 *
 * Safety: react-markdown converts Markdown to a React element tree without
 * using dangerouslySetInnerHTML, so untrusted HTML in the source is NOT
 * executed. Raw HTML passthrough is disabled by the library's default
 * (disallowedElements / skipHtml behaviour). javascript: protocol links are
 * also blocked by react-markdown's built-in URL sanitiser.
 *
 * The `markdown` CSS-module class restores standard list styling so that the
 * global `list-style: none` reset in theme.css does not strip the implicit
 * ARIA list/listitem roles from rendered Markdown lists.
 */
export function NoteBody({ body, className }: NoteBodyProps) {
  return (
    <div className={[styles.markdown, className].filter(Boolean).join(' ')}>
      <ReactMarkdown>{body}</ReactMarkdown>
    </div>
  );
}
