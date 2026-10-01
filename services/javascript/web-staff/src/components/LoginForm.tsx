import React, { useState } from 'react';
import { Button } from '@ecotransit/ui';

interface LoginFormProps {
  onSubmit: (staffId: string, pin: string) => void;
  isLoading: boolean;
  error: string | null;
}

export const LoginForm: React.FC<LoginFormProps> = ({ onSubmit, isLoading, error }) => {
  const [staffId, setStaffId] = useState('');
  const [pin, setPin] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffId.trim() || !pin.trim()) return;
    onSubmit(staffId, pin);
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div>
        <label style={{ display: 'block', fontSize: '13px', color: '#94a3b8', marginBottom: '6px' }}>
          Operator Staff ID
        </label>
        <input
          type="text"
          value={staffId}
          onChange={(e) => setStaffId(e.target.value)}
          placeholder="e.g. OP-704"
          autoComplete="username"
          required
          style={{
            width: '100%',
            padding: '12px 14px',
            borderRadius: '8px',
            background: '#0f172a',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            color: '#f8fafc',
            fontSize: '15px',
            boxSizing: 'border-box',
            outline: 'none',
          }}
        />
      </div>

      <div>
        <label style={{ display: 'block', fontSize: '13px', color: '#94a3b8', marginBottom: '6px' }}>
          Security PIN
        </label>
        <input
          type="password"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          placeholder="••••"
          maxLength={6}
          autoComplete="current-password"
          required
          style={{
            width: '100%',
            padding: '12px 14px',
            borderRadius: '8px',
            background: '#0f172a',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            color: '#f8fafc',
            fontSize: '15px',
            letterSpacing: '0.2em',
            boxSizing: 'border-box',
            outline: 'none',
          }}
        />
      </div>

      {error && (
        <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#f87171', padding: '10px', borderRadius: '6px', fontSize: '13px' }}>
          {error}
        </div>
      )}

      <Button type="submit" variant="primary" size="lg" isLoading={isLoading} style={{ marginTop: '8px' }}>
        {isLoading ? 'Verifying Credentials...' : 'Sign In to Duty'}
      </Button>
    </form>
  );
};
