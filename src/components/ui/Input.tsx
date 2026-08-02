// 📁 src/components/ui/Input.tsx
// Champ de formulaire unique pour toute l'application.
// Remplace les ~200 champs codés à la main dans les features.

import { InputHTMLAttributes, TextareaHTMLAttributes, forwardRef, useState, ReactNode } from 'react';
import { Eye, EyeOff, AlertCircle } from 'lucide-react';
import { cn } from '@/utils/helpers';
import { useBranding } from '@/hooks/useBranding';

// ============================================================
// TYPES
// ============================================================

interface BaseFieldProps {
  label?: string;
  error?: string;
  helper?: string;
  required?: boolean;
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
  containerClassName?: string;
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement>, BaseFieldProps {
  as?: 'input';
}

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement>, BaseFieldProps {
  as: 'textarea';
  rows?: number;
}

type FieldProps = InputProps | TextareaProps;

// ============================================================
// SOUS-COMPOSANT : LABEL
// ============================================================

const FieldLabel = ({
  label,
  required,
  htmlFor,
  color,
}: {
  label: string;
  required?: boolean;
  htmlFor?: string;
  color: string;
}) => (
  <label
    htmlFor={htmlFor}
    className="block text-[11px] font-semibold mb-1"
    style={{ color }}
  >
    {label}
    {required && <span className="ml-0.5 text-red-400">*</span>}
  </label>
);

// ============================================================
// COMPOSANT PRINCIPAL
// ============================================================

export const Input = forwardRef<HTMLInputElement | HTMLTextAreaElement, FieldProps>((
  {
    label,
    error,
    helper,
    required,
    iconLeft,
    iconRight,
    containerClassName,
    className,
    ...props
  },
  ref
) => {
  const brand = useBranding();
  const colors = brand.colors;

  const isTextarea = (props as TextareaProps).as === 'textarea';
  const isPassword = (props as InputProps).type === 'password';
  const [showPassword, setShowPassword] = useState(false);

  const id = (props as InputProps).id || label?.toLowerCase().replace(/\s+/g, '-');

  const baseInputStyle = {
    color: colors.text,
    borderColor: error ? '#EF4444' : colors.border,
    backgroundColor: colors.surface,
    outline: 'none',
  };

  const focusRingStyle = {
    '--tw-ring-color': error ? '#EF4444' : colors.primary,
  } as React.CSSProperties;

  const inputClasses = cn(
    'w-full text-xs border rounded-xl transition-all duration-200',
    'placeholder:text-current placeholder:opacity-30',
    'focus:ring-2 focus:ring-offset-0',
    iconLeft ? 'pl-9' : 'pl-3',
    (iconRight || isPassword) ? 'pr-9' : 'pr-3',
    isTextarea ? 'py-2.5 min-h-[80px] resize-y' : 'h-10',
    error && 'border-red-400 focus:ring-red-400/30',
    className
  );

  const renderInput = () => {
    if (isTextarea) {
      const { as: _, iconLeft: _l, iconRight: _r, containerClassName: _c, error: _e, helper: _h, label: _lb, required: _req, ...textareaProps } = props as TextareaProps;
      return (
        <textarea
          ref={ref as React.Ref<HTMLTextAreaElement>}
          id={id}
          className={inputClasses}
          style={{ ...baseInputStyle, ...focusRingStyle }}
          {...textareaProps}
        />
      );
    }

    const inputType = isPassword ? (showPassword ? 'text' : 'password') : (props as InputProps).type;
    const { as: _, iconLeft: _l, iconRight: _r, containerClassName: _c, error: _e, helper: _h, label: _lb, required: _req, ...inputProps } = props as InputProps;

    return (
      <input
        ref={ref as React.Ref<HTMLInputElement>}
        id={id}
        type={inputType}
        className={inputClasses}
        style={{ ...baseInputStyle, ...focusRingStyle }}
        {...inputProps}
      />
    );
  };

  return (
    <div className={cn('w-full', containerClassName)}>
      {label && (
        <FieldLabel
          label={label}
          required={required}
          htmlFor={id}
          color={colors.text}
        />
      )}

      <div className="relative">
        {/* Icône gauche */}
        {iconLeft && (
          <span
            className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
            style={{ color: error ? '#EF4444' : colors.textLight }}
          >
            {iconLeft}
          </span>
        )}

        {renderInput()}

        {/* Icône droite ou toggle password */}
        {isPassword ? (
          <button
            type="button"
            onClick={() => setShowPassword(v => !v)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-md transition-opacity hover:opacity-70"
            style={{ color: colors.textLight }}
            tabIndex={-1}
          >
            {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        ) : iconRight ? (
          <span
            className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
            style={{ color: colors.textLight }}
          >
            {iconRight}
          </span>
        ) : null}
      </div>

      {/* Message d'erreur */}
      {error && (
        <p className="mt-1 text-[10px] font-medium flex items-center gap-1 text-red-500">
          <AlertCircle size={10} />
          {error}
        </p>
      )}

      {/* Texte d'aide */}
      {helper && !error && (
        <p className="mt-1 text-[10px]" style={{ color: colors.textLight }}>
          {helper}
        </p>
      )}
    </div>
  );
});

Input.displayName = 'Input';

// ============================================================
// TEXTAREA — raccourci
// ============================================================

export const Textarea = forwardRef<HTMLTextAreaElement, Omit<TextareaProps, 'as'>>((props, ref) => (
  <Input as="textarea" ref={ref as any} {...props} />
));

Textarea.displayName = 'Textarea';

export default Input;
