'use client';

import { motion } from 'motion/react';
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Spinner } from './Spinner';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  loading?: boolean;
  icon?: ReactNode;
  fullWidth?: boolean;
}

const variantStyles: Record<Variant, string> = {
  primary:
    'bg-accent text-white font-semibold hover:bg-accent-hover active:bg-accent-hover',
  secondary:
    'bg-bg-elevated text-foreground border border-border hover:bg-bg-card',
  ghost: 'text-fg-muted hover:text-foreground hover:bg-bg-elevated',
  danger: 'bg-danger/10 text-danger border border-danger/20 hover:bg-danger/20',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      loading = false,
      icon,
      fullWidth = false,
      children,
      className = '',
      disabled,
      ...props
    },
    ref
  ) => {
    return (
      <motion.button
        ref={ref}
        whileTap={{ scale: 0.97 }}
        transition={{ duration: 0.1 }}
        disabled={disabled || loading}
        className={`
          relative inline-flex items-center justify-center gap-2
          rounded-xl px-5 py-3 text-sm
          transition-colors duration-150
          disabled:opacity-50 disabled:cursor-not-allowed
          ${variantStyles[variant]}
          ${fullWidth ? 'w-full' : ''}
          ${className}
        `}
        {...(props as React.ComponentProps<typeof motion.button>)}
      >
        {loading ? (
          <Spinner size={18} />
        ) : (
          <>
            {icon && <span className="shrink-0">{icon}</span>}
            {children}
          </>
        )}
      </motion.button>
    );
  }
);

Button.displayName = 'Button';
