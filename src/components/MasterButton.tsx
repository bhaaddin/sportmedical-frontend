/* ══════════════════════════════════════════════════════════════
   MASTER BUTTONS — PrimaryButton / DangerButton / GhostButton
   Features: loading state, disabled state, data-tooltip, icon support
   ══════════════════════════════════════════════════════════════ */
import { type ButtonHTMLAttributes, type ReactNode, forwardRef } from 'react';

type ButtonVariant = 'primary' | 'danger' | 'ghost' | 'success';
type ButtonSize = 'sm' | 'md' | 'lg';

interface MasterButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'style'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: ReactNode;
  iconPosition?: 'left' | 'right';
  tooltip?: string;
  fullWidth?: boolean;
}

const sizeMap: Record<ButtonSize, { padding: string; fontSize: string; minHeight: string; iconSize: number }> = {
  sm: { padding: '6px 12px', fontSize: 'var(--font-size-xs)', minHeight: '32px', iconSize: 16 },
  md: { padding: '8px 16px', fontSize: 'var(--font-size-sm)', minHeight: '36px', iconSize: 18 },
  lg: { padding: '10px 20px', fontSize: 'var(--font-size-base)', minHeight: '42px', iconSize: 20 },
};

const variantClassMap: Record<ButtonVariant, string> = {
  primary: 'btn--primary',
  danger: 'btn--danger',
  ghost: 'btn--ghost',
  success: 'btn--success',
};

const MasterButton = forwardRef<HTMLButtonElement, MasterButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      icon,
      iconPosition = 'left',
      tooltip,
      fullWidth = false,
      disabled,
      children,
      className = '',
      ...rest
    },
    ref,
  ) => {
    const s = sizeMap[size];
    const isDisabled = disabled || loading;

    return (
      <button
        ref={ref}
        className={`btn ${variantClassMap[variant]} ${fullWidth ? 'w-full' : ''} ${className}`}
        style={{
          padding: s.padding,
          fontSize: s.fontSize,
          minHeight: s.minHeight,
          opacity: isDisabled ? 0.5 : 1,
          cursor: isDisabled ? 'not-allowed' : 'pointer',
          pointerEvents: isDisabled ? 'none' : 'auto',
        }}
        disabled={isDisabled}
        data-tooltip={tooltip}
        aria-disabled={isDisabled}
        aria-busy={loading}
        {...rest}
      >
        {loading ? (
          <span className="btn__spinner" aria-hidden="true" />
        ) : (
          icon && iconPosition === 'left' && (
            <span style={{ display: 'flex', fontSize: s.iconSize }} aria-hidden="true">
              {icon}
            </span>
          )
        )}
        {children && <span>{children}</span>}
        {!loading && icon && iconPosition === 'right' && (
          <span style={{ display: 'flex', fontSize: s.iconSize }} aria-hidden="true">
            {icon}
          </span>
        )}
      </button>
    );
  },
);

MasterButton.displayName = 'MasterButton';

/* ── Named exports for quick usage ── */
export function PrimaryButton(props: Omit<MasterButtonProps, 'variant'>) {
  return <MasterButton variant="primary" {...props} />;
}

export function DangerButton(props: Omit<MasterButtonProps, 'variant'>) {
  return <MasterButton variant="danger" {...props} />;
}

export function GhostButton(props: Omit<MasterButtonProps, 'variant'>) {
  return <MasterButton variant="ghost" {...props} />;
}

export function SuccessButton(props: Omit<MasterButtonProps, 'variant'>) {
  return <MasterButton variant="success" {...props} />;
}

export default MasterButton;
