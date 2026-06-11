import { Button } from './Button';
import styles from './Pagination.module.css';

export interface PaginationProps {
  page: number;
  totalPages: number;
  onPrev: () => void;
  onNext: () => void;
}

export function Pagination({ page, totalPages, onPrev, onNext }: PaginationProps) {
  return (
    <nav aria-label="Pagination" className={styles.pagination}>
      <Button variant="secondary" onClick={onPrev} disabled={page <= 1} aria-label="Previous page">
        Previous
      </Button>
      <span className={styles.pageInfo}>
        Page {page} of {totalPages}
      </span>
      <Button
        variant="secondary"
        onClick={onNext}
        disabled={page >= totalPages}
        aria-label="Next page"
      >
        Next
      </Button>
    </nav>
  );
}
