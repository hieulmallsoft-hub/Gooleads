import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LoginPage } from './LoginPage';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('LoginPage', () => {
  it('requires email and password', async () => {
    const onAuthenticated = vi.fn();
    render(<LoginPage onAuthenticated={onAuthenticated} />);
    expect(screen.getByLabelText(/email/i)).toBeRequired();
    expect(screen.getByLabelText(/^mật khẩu$/i)).toBeRequired();
    expect(onAuthenticated).not.toHaveBeenCalled();
  });

  it('submits credentials and returns the authenticated user', async () => {
    const user = { id: 'u1', email: 'admin@example.com' };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ user }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    ));
    const onAuthenticated = vi.fn();
    render(<LoginPage onAuthenticated={onAuthenticated} />);
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'admin@example.com' } });
    fireEvent.change(screen.getByLabelText(/^mật khẩu$/i), { target: { value: 'Strong@123' } });
    fireEvent.click(screen.getByRole('button', { name: /đăng nhập/i }));
    await waitFor(() => expect(onAuthenticated).toHaveBeenCalledWith(user));
  });

  it('shows the API error when login fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: 'Invalid email or password' }), {
        status: 401,
        headers: { 'content-type': 'application/json' },
      }),
    ));
    render(<LoginPage onAuthenticated={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'bad@example.com' } });
    fireEvent.change(screen.getByLabelText(/^mật khẩu$/i), { target: { value: 'Wrong@123' } });
    fireEvent.click(screen.getByRole('button', { name: /đăng nhập/i }));
    expect(await screen.findByText(/invalid email or password/i)).toBeInTheDocument();
  });
});
