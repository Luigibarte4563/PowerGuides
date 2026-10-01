import { forwardRef } from 'react';
import { Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import clsx from 'clsx';

/**
 * Shared button. Renders a react-router `<Link>` when `to` is provided so the
 * same visual language is used for links and actions.
 *
 * Variants: primary | secondary | outline | ghost | danger | subtle | white
 * Sizes:    sm | md | lg | icon
 */
const VARIANTS = {
  primary:
    'bg-primary-500 text-navy-950 hover:bg-primary-400 active:bg-primary-600 disabled:bg-primary-200 disabled:text-navy-400 dark:disabled:bg-primary-500/30 dark:disabled:text-navy-300',
  secondary:
    'bg-navy-900 text-white hover:bg-navy-800 active:bg-navy-950 disabled:bg-navy-300 dark:bg-navy-100 dark:text-navy-900 dark:hover:bg-white dark:active:bg-navy-200 dark:disabled:bg-navy-700 dark:disabled:text-navy-500',
  outline:
    'border border-navy-200 bg-white text-navy-800 hover:border-navy-300 hover:bg-navy-50 disabled:text-navy-300 dark:border-navy-600 dark:bg-navy-800 dark:text-navy-100 dark:hover:border-navy-500 dark:hover:bg-navy-700 dark:disabled:text-navy-600',
  ghost: 'text-navy-700 hover:bg-navy-100 disabled:text-navy-300 dark:text-navy-200 dark:hover:bg-navy-800 dark:disabled:text-navy-600',
  subtle: 'bg-navy-100 text-navy-800 hover:bg-navy-200 disabled:text-navy-400 dark:bg-navy-700 dark:text-navy-100 dark:hover:bg-navy-600 dark:disabled:text-navy-500',
  danger: 'bg-danger-600 text-white hover:bg-danger-700 active:bg-danger-700 disabled:bg-danger-200 dark:disabled:bg-danger-600/40 dark:disabled:text-navy-300',
  white: 'bg-white text-navy-900 hover:bg-navy-50 active:bg-navy-100 disabled:text-navy-300 dark:bg-navy-100 dark:text-navy-900 dark:hover:bg-white dark:active:bg-navy-200 dark:disabled:bg-navy-700 dark:disabled:text-navy-500',
};

const SIZES = {
  sm: 'h-9 px-3 text-sm gap-1.5',
  md: 'h-11 px-4 text-sm gap-2',
  lg: 'h-12 px-6 text-base gap-2',
  icon: 'h-10 w-10 p-0',
  'icon-sm': 'h-8 w-8 p-0',
};

export const Button = forwardRef(function Button(
  {
    children,
    variant = 'primary',
    size = 'md',
    className,
    type = 'button',
    loading = false,
    disabled = false,
    to,
    icon: Icon,
    iconRight: IconRight,
    fullWidth = false,
    ...rest
  },
  ref
) {
  const classes = clsx(
    'inline-flex items-center justify-center rounded-control font-semibold transition-colors',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2',
    // Tailwind's default ring offset is white, which reads as a bright halo on a
    // dark surface, so it is pinned to the canvas colour per theme.
    'focus-visible:ring-offset-white dark:focus-visible:ring-offset-navy-950',
    'disabled:cursor-not-allowed',
    VARIANTS[variant] || VARIANTS.primary,
    SIZES[size] || SIZES.md,
    fullWidth && 'w-full',
    className
  );

  const content = (
    <>
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      ) : Icon ? (
        <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      ) : null}
      {children ? <span className="truncate">{children}</span> : null}
      {IconRight && !loading ? <IconRight className="h-4 w-4 shrink-0" aria-hidden="true" /> : null}
    </>
  );

  if (to && !disabled && !loading) {
    return (
      <Link ref={ref} to={to} className={classes} {...rest}>
        {content}
      </Link>
    );
  }

  return (
    <button
      ref={ref}
      type={type}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {content}
    </button>
  );
});

export default Button;
