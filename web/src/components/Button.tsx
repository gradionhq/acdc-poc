import type { ButtonHTMLAttributes } from 'react';
import styles from './Button.module.css';

export type ButtonVariant = 'primary' | 'secondary' | 'danger';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

/**
 * Token-based Button component.
 * Renders a <button> with one of three design-system variants:
 *   • primary   – blue fill, used for affirmative / submit actions
 *   • secondary – gray fill, used for neutral / cancel actions
 *   • danger    – red fill, used for destructive actions
 */
export function Button({ variant = 'primary', className, ...rest }: ButtonProps) {
  const variantClass = styles[variant];
  const combined = [styles.btn, variantClass, className].filter(Boolean).join(' ');
  return <button className={combined} {...rest} />;
}
