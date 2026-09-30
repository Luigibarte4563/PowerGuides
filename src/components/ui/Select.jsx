import { forwardRef, useId } from 'react';
import { ChevronDown, Loader2 } from 'lucide-react';
import clsx from 'clsx';
import { CONTROL_CLASS } from './Input';
import { Field } from './Input';

/**
 * Select fed by cached reference data (`GET /api/reference/get.php`).
 * `options` accepts `[{ id, name }]`, `[{ value, label }]` or plain strings.
 */
export const Select = forwardRef(function Select(
  {
    label,
    hint,
    error,
    required,
    options = [],
    placeholder,
    loading = false,
    className,
    id,
    wrapperClassName,
    children,
    ...rest
  },
  ref
) {
  const generatedId = useId();
  const selectId = id || generatedId;

  const normalised = options.map((option) => {
    if (option === null || option === undefined) return null;
    if (typeof option === 'string' || typeof option === 'number') {
      return { value: String(option), label: String(option) };
    }
    const value = option.value ?? option.id;
    const text = option.label ?? option.name;
    if (value === undefined || value === null || !text) return null;
    return { value: String(value), label: String(text), disabled: Boolean(option.disabled) };
  }).filter(Boolean);

  return (
    <Field
      label={label}
      htmlFor={selectId}
      hint={hint}
      error={error}
      required={required}
      className={wrapperClassName}
    >
      <div className="relative">
        <select
          ref={ref}
          id={selectId}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error && selectId ? `${selectId}-error` : hint && selectId ? `${selectId}-hint` : undefined}
          className={clsx(CONTROL_CLASS, 'appearance-none pr-10', error && 'border-danger-500', className)}
          disabled={loading || rest.disabled}
          {...rest}
        >
          {placeholder !== undefined ? <option value="">{placeholder}</option> : null}
          {normalised.map((option) => (
            <option key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </option>
          ))}
          {children}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-navy-400"
          aria-hidden="true"
        />
        {loading ? (
          <Loader2
            className="pointer-events-none absolute right-9 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-navy-400"
            aria-hidden="true"
          />
        ) : null}
      </div>
    </Field>
  );
});

export default Select;
