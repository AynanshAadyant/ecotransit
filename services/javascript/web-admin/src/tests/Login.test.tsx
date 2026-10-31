import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Login from '../pages/Login';
import { useAuthStore } from '../state/auth.store';

// Mock react-router navigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock the auth API
vi.mock('../api/auth.api', () => ({
  loginApi: vi.fn(),
}));

import { loginApi } from '../api/auth.api';
const mockLoginApi = loginApi as ReturnType<typeof vi.fn>;

describe('Login page', () => {
  beforeEach(() => {
    localStorage.clear();
    useAuthStore.setState({
      token: null,
      user: null,
      isAuthenticated: false,
      error: null,
      loading: false,
    });
    vi.clearAllMocks();
    mockNavigate.mockReset();
  });

  const renderLogin = () =>
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );

  it('renders the login form with email and password fields', () => {
    renderLogin();
    expect(screen.getByLabelText(/operator.*email/i)).toBeTruthy();
    expect(screen.getByPlaceholderText(/••••••••/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeTruthy();
  });

  it('renders demo credential buttons', () => {
    renderLogin();
    expect(screen.getByText(/admin operator/i)).toBeTruthy();
    expect(screen.getByText(/staff \/ driver/i)).toBeTruthy();
  });

  it('fills demo admin credentials when Admin Operator is clicked', () => {
    renderLogin();
    const adminBtn = screen.getByText(/admin operator/i);
    fireEvent.click(adminBtn);
    const emailInput = screen.getByLabelText(/operator.*email/i) as HTMLInputElement;
    expect(emailInput.value).toBe('admin@ecotransit.org');
  });

  it('fills demo staff credentials when Staff / Driver is clicked', () => {
    renderLogin();
    const staffBtn = screen.getByText(/staff \/ driver/i);
    fireEvent.click(staffBtn);
    const emailInput = screen.getByLabelText(/operator.*email/i) as HTMLInputElement;
    expect(emailInput.value).toBe('driver1@ecotransit.org');
  });

  it('navigates to /admin/dashboard on admin login success', async () => {
    mockLoginApi.mockResolvedValueOnce({
      token: 'tok',
      user: { id: 1, name: 'Admin', email: 'admin@ecotransit.org', role: 'ADMIN', status: 'active' },
    });

    renderLogin();
    fireEvent.change(screen.getByLabelText(/operator.*email/i), {
      target: { value: 'admin@ecotransit.org' },
    });
    fireEvent.change(screen.getByPlaceholderText(/••••••••/i), {
      target: { value: 'Admin@123' },
    });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/admin/dashboard');
    });
  });

  it('navigates to /staff/dashboard on staff login success', async () => {
    mockLoginApi.mockResolvedValueOnce({
      token: 'tok',
      user: { id: 2, name: 'Driver', email: 'driver1@ecotransit.org', role: 'STAFF', status: 'active' },
    });

    renderLogin();
    fireEvent.change(screen.getByLabelText(/operator.*email/i), {
      target: { value: 'driver1@ecotransit.org' },
    });
    fireEvent.change(screen.getByPlaceholderText(/••••••••/i), {
      target: { value: 'Staff@123' },
    });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/staff/dashboard');
    });
  });

  it('shows error banner on login failure', async () => {
    mockLoginApi.mockRejectedValueOnce(new Error('Invalid credentials'));

    renderLogin();
    fireEvent.change(screen.getByLabelText(/operator.*email/i), {
      target: { value: 'bad@ecotransit.org' },
    });
    fireEvent.change(screen.getByPlaceholderText(/••••••••/i), {
      target: { value: 'wrongpass' },
    });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText('Invalid credentials')).toBeTruthy();
    });
  });
});
