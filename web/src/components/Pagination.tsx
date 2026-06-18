import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './Button';
import styles from './Pagination.module.css';

export interface PaginationProps {
  page: number;
  totalPages: number;
  onPrev: () => void;
  onNext: () => void;
  /**
   * Whether a next page exists, as reported by the server. When omitted the
   * component falls back to comparing the current page against totalPages.
   */
  hasNext?: boolean;
}

export function Pagination({ page, totalPages, onPrev, onNext, hasNext }: PaginationProps) {
  const nextDisabled = hasNext === undefined ? page >= totalPages : !hasNext;
  return (
    <nav aria-label="Pagination" className={styles.pagination}>
      <Button variant="secondary" onClick={onPrev} disabled={page <= 1} aria-label="Previous page">
        <ChevronLeft size={16} aria-hidden="true" className={styles.chevron} />
        <span>Previous</span>
      </Button>
      <span className={styles.pageInfo}>
        Page {page} of {totalPages}
      </span>
      <Button variant="secondary" onClick={onNext} disabled={nextDisabled} aria-label="Next page">
        <span>Next</span>
        <ChevronRight size={16} aria-hidden="true" className={styles.chevron} />
      </Button>
    </nav>
  );
}
