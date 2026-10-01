import React from 'react';
import { useStaffAuthStore } from '../state/auth';
import { loginStaff } from '../api/auth.api';
import { LoginForm } from '../components/LoginForm';

export const Login: React.FC = () => {
  const { loading, error, setUser, setLoading, setError } = useStaffAuthStore();

  const handleLogin = async (staffId: string, pin: string) => {
    setLoading(true);
    try {
      const user = await loginStaff(staffId, pin);
      setUser(user);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Invalid credentials. Please verify Staff ID and PIN.';
      setError(message);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '24px',
        maxWidth: '400px',
        margin: '0 auto',
        height: '100%',
      }}
    >
      <div style={{ textAlign: 'center', marginBottom: '28px' }}>
        <div
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
            fontSize: '22px',
            fontWeight: 700,
            marginBottom: '12px',
          }}
        >
          ET
        </div>
        <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: '#f8fafc' }}>
          Staff Field Portal
        </h1>
        <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#94a3b8' }}>
          Authorized Transit Drivers & Mobile Operators Only
        </p>
      </div>

      <LoginForm onSubmit={handleLogin} isLoading={loading} error={error} />
    </div>
  );
};
