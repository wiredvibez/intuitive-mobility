'use client';

import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string | null;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className = '', ...props }, ref) => {
    return (
      <div className="space-y-1.5">
        {label && (
          <label className="block text-sm font-medium text-fg-muted">
            {label}
          </label>
        )}
        <input
          ref={ref}
          className={`
            w-full rounded-xl bg-bg-elevated border border-border
            px-4 py-3 text-sm text-foreground placeholder:text-fg-subtle
            focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent
            transition-colors
            ${error ? 'border-danger focus:ring-danger/50' : ''}
            ${className}
          `}
          {...props}
        />
        {error && (
          <p className="text-xs text-danger pl-1">{error}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string | null;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, className = '', ...props }, ref) => {
    return (
      <div className="space-y-1.5">
        {label && (
          <label className="block text-sm font-medium text-fg-muted">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          className={`
            w-full rounded-xl bg-bg-elevated border border-border
            px-4 py-3 text-sm text-foreground placeholder:text-fg-subtle
            focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent
            transition-colors resize-none
            ${error ? 'border-danger focus:ring-danger/50' : ''}
            ${className}
          `}
          rows={3}
          {...props}
        />
        {error && (
          <p className="text-xs text-danger pl-1">{error}</p>
        )}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';
