import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAuthStore } from '../state/auth.store';
import type { User } from '../api/auth.api';

// Mock the API module
vi.mock('../api/auth.api', () => ({
  loginApi: vi.fn(),
}));

import { loginApi } from '../api/auth.api';

const mockLoginApi = loginApi as ReturnType<typeof vi.fn>;

describe('useAuthStore', () => {
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
  });

  it('initial state is unauthenticated', () => {
    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.token).toBeNull();
    expect(state.user).toBeNull();
  });

  it('login sets token and user on success', async () => {
    const mockUser: User = { id: 1, name: 'Admin', email: 'admin@test.com', role: 'ADMIN', status: 'active' };
    const mockToken = 'mock-jwt-token';
    mockLoginApi.mockResolvedValueOnce({ token: mockToken, user: mockUser });

    await useAuthStore.getState().login('admin@test.com', 'password123');

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.token).toBe(mockToken);
    expect(state.user).toEqual(mockUser);
    expect(localStorage.getItem('token')).toBe(mockToken);
  });

  it('login sets error on failure', async () => {
    mockLoginApi.mockRejectedValueOnce(new Error('Invalid credentials'));

    await expect(useAuthStore.getState().login('bad@email.com', 'wrong')).rejects.toThrow();

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.error).toBe('Invalid credentials');
  });

  it('logout clears token and user', async () => {
    useAuthStore.setState({
      token: 'some-token',
      user: { id: 1, name: 'Admin', email: 'admin@test.com', role: 'ADMIN', status: 'active' },
      isAuthenticated: true,
    });
    localStorage.setItem('token', 'some-token');
    localStorage.setItem('user', JSON.stringify({ id: 1 }));

    useAuthStore.getState().logout();

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.token).toBeNull();
    expect(state.user).toBeNull();
    expect(localStorage.getItem('token')).toBeNull();
  });

  it('hydrate restores session from localStorage', () => {
    const storedUser: User = { id: 2, name: 'Staff', email: 'staff@test.com', role: 'STAFF', status: 'active' };
    localStorage.setItem('token', 'stored-token');
    localStorage.setItem('user', JSON.stringify(storedUser));

    useAuthStore.getState().hydrate();

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.token).toBe('stored-token');
    expect(state.user?.email).toBe('staff@test.com');
  });

  it('hydrate ignores corrupt localStorage data', () => {
    localStorage.setItem('token', 'stored-token');
    localStorage.setItem('user', 'invalid-json{{{');

    useAuthStore.getState().hydrate();

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
  });
});
