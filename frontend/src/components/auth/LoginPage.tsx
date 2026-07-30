import { useState, useRef, useCallback, type FormEvent } from 'react';
import { LogIn, RefreshCw, Eye, EyeOff } from 'lucide-react';
import allsoftLogo from '../../assets/allsoft-logo-cropped.png';
import { apiFetch, extractApiError, parseJsonSafe } from '../../api/client';
import type { AuthMeResponse, AuthUser } from '../../types/googleAds';

type LoginPageProps = {
  onAuthenticated: (user: AuthUser) => void;
  initialError?: string;
};

export function LoginPage({ onAuthenticated, initialError = '' }: LoginPageProps) {
  const [email, setEmail] = useState('admin@allsoft.local');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isTypingPassword, setIsTypingPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(initialError);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handlePasswordChange = useCallback((value: string) => {
    setPassword(value);
    setIsTypingPassword(true);
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      setIsTypingPassword(false);
    }, 800);
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await apiFetch('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const body = await parseJsonSafe(response);
      if (!response.ok) throw new Error(extractApiError(body, 'Không thể đăng nhập'));
      onAuthenticated((body as AuthMeResponse).user);
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'Không thể đăng nhập');
    } finally {
      setLoading(false);
    }
  }

  // Eye icon: nhắm (scaleY nhỏ) qua CSS khi đang gõ, mở/đóng khi toggle
  function EyeIcon() {
    if (showPassword) return <Eye size={18} />;
    return <EyeOff size={18} />;
  }

  return (
    <main className="loginScreen">
      <div className="loginBgShapes">
        <div className="loginBgShape loginBgShape--1" />
        <div className="loginBgShape loginBgShape--2" />
        <div className="loginBgShape loginBgShape--3" />
      </div>

      <section className="loginPanel">
        <div className="loginBrand">
          <div className="loginLogoWrap">
            <img src={allsoftLogo} alt="ALLSOFT" />
          </div>
          <div className="loginBrandText">
            <strong>Trung tâm hiệu suất Google Ads</strong>
            <span>Chỉ dành cho người dùng nội bộ</span>
          </div>
        </div>

        <div className="loginDivider" />

        <form className="loginForm" onSubmit={handleSubmit}>
          <div className="loginField">
            <label htmlFor="login-email" className="loginLabel">Email</label>
            <div className="loginInputWrap">
              <input
                id="login-email"
                className="loginInput"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                required
                placeholder="you@example.com"
              />
            </div>
          </div>

          <div className="loginField">
            <label htmlFor="login-password" className="loginLabel">Mật khẩu</label>
            <div className="loginInputWrap loginInputWrap--password">
              <input
                id="login-password"
                className="loginInput"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => handlePasswordChange(event.target.value)}
                autoComplete="current-password"
                required
                placeholder="••••••••"
              />
              <button
                type="button"
                className={`loginEyeBtn ${isTypingPassword ? 'loginEyeBtn--typing' : ''}`}
                onClick={() => setShowPassword((v) => !v)}
                tabIndex={-1}
                aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              >
                <EyeIcon />
              </button>
            </div>
          </div>

          {error ? (
            <div className="loginError">
              <span className="loginErrorDot" />
              {error}
            </div>
          ) : null}

          <button className="loginSubmitBtn" type="submit" disabled={loading}>
            {loading ? <RefreshCw size={16} className="spin" /> : <LogIn size={16} />}
            <span>{loading ? 'Đang đăng nhập...' : 'Đăng nhập'}</span>
          </button>
        </form>
      </section>
    </main>
  );
}
