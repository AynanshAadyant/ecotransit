import React from 'react';

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | undefined;
  size?: 'sm' | 'md' | 'lg' | undefined;
  isLoading?: boolean | undefined;
  children?: React.ReactNode | undefined;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  children,
  disabled,
  style,
  ...rest
}) => {
  let bg = '#10b981';
  let color = '#ffffff';
  let border = 'transparent';
  switch (variant) {
    case 'primary':
      bg = '#10b981';
      color = '#ffffff';
      border = 'transparent';
      break;
    case 'secondary':
      bg = 'rgba(255, 255, 255, 0.08)';
      color = '#f8fafc';
      border = '1px solid rgba(255, 255, 255, 0.16)';
      break;
    case 'ghost':
      bg = 'transparent';
      color = '#94a3b8';
      border = 'transparent';
      break;
    case 'danger':
      bg = '#ef4444';
      color = '#ffffff';
      border = 'transparent';
      break;
    case 'success':
      bg = '#10b981';
      color = '#ffffff';
      border = 'transparent';
      break;
  }

  const padding =
    size === 'sm' ? '5px 10px' : size === 'lg' ? '12px 20px' : '8px 16px';
  const fontSize =
    size === 'sm' ? '12px' : size === 'lg' ? '15px' : '13px';

  return (
    <button
      disabled={disabled || isLoading}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        padding,
        fontSize,
        fontWeight: 600,
        borderRadius: '8px',
        backgroundColor: bg,
        color,
        border,
        cursor: disabled || isLoading ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'all 0.15s ease',
        outline: 'none',
        ...style,
      }}
      {...rest}
    >
      {isLoading && (
        <span
          style={{
            display: 'inline-block',
            width: '12px',
            height: '12px',
            border: '2px solid rgba(255, 255, 255, 0.4)',
            borderTopColor: '#ffffff',
            borderRadius: '50%',
            animation: 'spin 0.7s linear infinite',
          }}
        />
      )}
      {children}
    </button>
  );
};

export default Button;
