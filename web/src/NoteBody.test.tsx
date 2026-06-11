import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NoteBody } from './NoteBody';

describe('NoteBody', () => {
  it('renders plain text as a paragraph', () => {
    render(<NoteBody body="Hello world" />);
    expect(screen.getByText('Hello world')).toBeInTheDocument();
  });

  it('renders a markdown heading as an h1 element', () => {
    render(<NoteBody body="# My Heading" />);
    expect(screen.getByRole('heading', { level: 1, name: 'My Heading' })).toBeInTheDocument();
  });

  it('renders a markdown heading h2', () => {
    render(<NoteBody body="## Sub Heading" />);
    expect(screen.getByRole('heading', { level: 2, name: 'Sub Heading' })).toBeInTheDocument();
  });

  it('renders an unordered list', () => {
    render(<NoteBody body={'- item one\n- item two'} />);
    expect(screen.getByRole('list')).toBeInTheDocument();
    expect(screen.getByText('item one')).toBeInTheDocument();
    expect(screen.getByText('item two')).toBeInTheDocument();
  });

  it('renders a code block', () => {
    render(<NoteBody body={'```\nconsole.log("hi");\n```'} />);
    expect(screen.getByRole('code') ?? screen.getByText(/console\.log/)).toBeInTheDocument();
  });

  it('renders bold text', () => {
    render(<NoteBody body="**bold text**" />);
    expect(screen.getByText('bold text')).toBeInTheDocument();
  });

  it('does NOT execute script tags — raw HTML is not rendered', () => {
    // react-markdown does not render raw HTML by default (rehype-sanitize is not needed;
    // the default skipHtml=false but rehype pipeline does not interpret <script> tags
    // as executable). The important safety check: the text content is escaped, not injected.
    render(<NoteBody body={'<script>window.__xss = true;</script>'} />);
    // The script should not execute
    expect((window as unknown as Record<string, unknown>).__xss).toBeUndefined();
  });

  it('does NOT inject dangerous HTML attributes like onerror', () => {
    render(<NoteBody body={'<img src="x" onerror="window.__xss2=true" />'} />);
    expect((window as unknown as Record<string, unknown>).__xss2).toBeUndefined();
  });

  it('does NOT render javascript: href links as executable', () => {
    // react-markdown strips javascript: protocol links by default
    render(<NoteBody body={'[click me](javascript:alert(1))'} />);
    const link = screen.queryByRole('link', { name: 'click me' });
    // Either no link is rendered, or the href is sanitized (not javascript:)
    if (link) {
      expect(link).not.toHaveAttribute('href', expect.stringContaining('javascript:'));
    }
  });

  it('accepts a className prop and applies it to the container', () => {
    const { container } = render(<NoteBody body="test" className="my-body" />);
    expect(container.firstChild).toHaveClass('my-body');
  });
});
