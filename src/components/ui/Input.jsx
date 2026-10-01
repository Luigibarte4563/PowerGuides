import { forwardRef, useId, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import clsx from 'clsx';

const CONTROL_BASE =
  'w-full rounded-control border border-navy-200 bg-white px-3.5 py-2.5 text-sm text-navy-900 shadow-sm transition placeholder:text-navy-300 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/40 disabled:cursor-not-allowed disabled:bg-navy-50 disabled:text-navy-400 dark:border-navy-600 dark:bg-navy-900 dark:text-navy-100 dark:placeholder:text-navy-500 dark:disabled:bg-navy-800 dark:disabled:text-navy-500';
const CONTROL_ERROR = 'border-danger-500 focus:border-danger-500 focus:ring-danger-500/40 dark:border-danger-500/60';

/** Field wrapper: label, hint, error message and required marker. */
export function Field({ label, htmlFor, hint, error, required, children, className }) {
  return (
    <div className={clsx('space-y-1.5', className)}>
      {label ? (
        <label htmlFor={htmlFor} className="block text-sm font-semibold text-navy-800 dark:text-navy-100">
          {label}
          {required ? (
            <span className="ml-0.5 text-danger-600 dark:text-danger-200" aria-hidden="true">
              *
            </span>
          ) : null}
        </label>
      ) : null}
      {children}
      {error ? (
        <p id={htmlFor ? `${htmlFor}-error` : undefined} className="text-xs font-medium text-danger-600 dark:text-danger-200" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={htmlFor ? `${htmlFor}-hint` : undefined} className="text-xs text-navy-400 dark:text-navy-400">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export const Input = forwardRef(function Input(
  { label, hint, error, required, className, id, wrapperClassName, ...rest },
  ref
) {
  const generatedId = useId();
  const inputId = id || generatedId;

  return (
    <Field
      label={label}
      htmlFor={inputId}
      hint={hint}
      error={error}
      required={required}
      className={wrapperClassName}
    >
      <input
        ref={ref}
        id={inputId}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={error && inputId ? `${inputId}-error` : hint && inputId ? `${inputId}-hint` : undefined}
        className={clsx(CONTROL_BASE, error && CONTROL_ERROR, className)}
        {...rest}
      />
    </Field>
  );
});

export const Textarea = forwardRef(function Textarea(
  { label, hint, error, required, className, id, rows = 4, wrapperClassName, ...rest },
  ref
) {
  const generatedId = useId();
  const inputId = id || generatedId;

  return (
    <Field
      label={label}
      htmlFor={inputId}
      hint={hint}
      error={error}
      required={required}
      className={wrapperClassName}
    >
      <textarea
        ref={ref}
        id={inputId}
        rows={rows}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={error && inputId ? `${inputId}-error` : hint && inputId ? `${inputId}-hint` : undefined}
        className={clsx(CONTROL_BASE, 'resize-y', error && CONTROL_ERROR, className)}
        {...rest}
      />
    </Field>
  );
});

/** Password field with a show/hide toggle. */
export const PasswordInput = forwardRef(function PasswordInput(
  { label, hint, error, required, className, id, wrapperClassName, ...rest },
  ref
) {
  const generatedId = useId();
  const inputId = id || generatedId;
  const [visible, setVisible] = useState(false);

  return (
    <Field
      label={label}
      htmlFor={inputId}
      hint={hint}
      error={error}
      required={required}
      className={wrapperClassName}
    >
      <div className="relative">
        <input
          ref={ref}
          id={inputId}
          type={visible ? 'text' : 'password'}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error && inputId ? `${inputId}-error` : hint && inputId ? `${inputId}-hint` : undefined}
          className={clsx(CONTROL_BASE, 'pr-11', error && CONTROL_ERROR, className)}
          {...rest}
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-control text-navy-400 transition hover:text-navy-700 dark:hover:text-navy-100"
          aria-label={visible ? 'Hide password' : 'Show password'}
          aria-pressed={visible}
        >
          {visible ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
        </button>
      </div>
    </Field>
  );
});

export const CONTROL_CLASS = CONTROL_BASE;
