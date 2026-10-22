import React from 'react';

export interface BadgeProps {
  label: React.ReactNode;
  status?: string | undefined;
  size?: 'sm' | 'md' | 'lg' | undefined;
  style?: React.CSSProperties | undefined;
  className?: string | undefined;
}

export const Badge: React.FC<BadgeProps> = ({
  label,
  status = 'default',
  size = 'md',
  style,
  className,
}) => {
  const norm = String(status).toUpperCase();

  let bg = 'rgba(56, 189, 248, 0.12)';
  let color = '#38bdf8';
  let border = 'rgba(56, 189, 248, 0.25)';

  if (
    norm.includes('CRITICAL') ||
    norm.includes('HIGH') ||
    norm.includes('FULL') ||
    norm.includes('OPEN') ||
    norm.includes('DANGER') ||
    norm.includes('ERROR')
  ) {
    bg = 'rgba(239, 68, 68, 0.15)';
    color = '#f87171';
    border = 'rgba(239, 68, 68, 0.35)';
  } else if (
    norm.includes('MEDIUM') ||
    norm.includes('ACKNOWLEDGED') ||
    norm.includes('FEW_SEATS') ||
    norm.includes('STANDING') ||
    norm.includes('PENDING') ||
    norm.includes('WARN')
  ) {
    bg = 'rgba(245, 158, 11, 0.15)';
    color = '#fbbf24';
    border = 'rgba(245, 158, 11, 0.35)';
  } else if (
    norm.includes('LOW') ||
    norm.includes('RESOLVED') ||
    norm.includes('MANY_SEATS') ||
    norm.includes('EMPTY') ||
    norm.includes('CONFIRMED') ||
    norm.includes('SUCCESS')
  ) {
    bg = 'rgba(16, 185, 129, 0.15)';
    color = '#34d399';
    border = 'rgba(16, 185, 129, 0.35)';
  }

  const padding =
    size === 'sm' ? '2px 6px' : size === 'lg' ? '6px 14px' : '3px 8px';
  const fontSize =
    size === 'sm' ? '11px' : size === 'lg' ? '13px' : '12px';

  return (
    <span
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding,
        fontSize,
        fontWeight: 600,
        borderRadius: '9999px',
        backgroundColor: bg,
        color,
        border: `1px solid ${border}`,
        lineHeight: 1.2,
        letterSpacing: '0.01em',
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      {label}
    </span>
  );
};

export default Badge;
