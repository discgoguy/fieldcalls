import { useState, useEffect } from 'react';
import { supabase } from '@/api/supabaseClient';
import posthog from '@/lib/posthog';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [magicSent, setMagicSent] = useState(false);
  const [mode, setMode] = useState('password');
  const [isInviteMode, setIsInviteMode] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes('type=invite') || hash.includes('type=recovery') || hash.includes('access_token')) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) setIsInviteMode(true);
      });
    }
  }, []);

  const handleSetPassword = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) { setError('Passwords do not match'); return; }
    if (newPassword.length < 8) { setError('Password must be at least 8 characters'); return; }
    setLoading(true); setError(null);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) { setError(error.message); setLoading(false); }
    else window.location.href = '/';
  };

  const handlePasswordLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { setError(error.message); setLoading(false); }
    else {
      posthog.capture('user logged in', { login_method: 'password' });
      window.location.href = '/';
    }
  };

  const handleMagicLink = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } });
    if (error) { setError(error.message); setLoading(false); }
    else {
      posthog.capture('user logged in with magic link', { login_method: 'magic_link' });
      setMagicSent(true);
      setLoading(false);
    }
  };

  if (isInviteMode) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="w-full max-w-sm bg-white rounded-xl shadow-sm border border-slate-200 p-8">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-semibold text-slate-800">FieldCalls</h1>
            <p className="text-slate-500 text-sm mt-1">Create your password to get started</p>
          </div>
          {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}
          <form onSubmit={handleSetPassword} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">New Password</label>
              <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required minLength={8}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Confirm Password</label>
              <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" />
            </div>
            <button type="submit" disabled={loading}
              className="w-full py-2 px-4 bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-slate-700 disabled:opacity-50">
              {loading ? 'Setting up your account...' : 'Set Password & Continue →'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-sm bg-white rounded-xl shadow-sm border border-slate-200 p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold text-slate-800">A52</h1>
          <p className="text-slate-500 text-sm mt-1">Sign in to your account</p>
        </div>

        {magicSent ? (
          <div className="text-center space-y-2">
            <div className="text-4xl">📬</div>
            <p className="font-medium text-slate-800">Check your email</p>
            <p className="text-sm text-slate-500">We sent a login link to <strong>{email}</strong></p>
          </div>
        ) : (
          <>
            {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}

            {mode === 'password' ? (
              <form onSubmit={handlePasswordLogin} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
                  <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" />
                </div>
                <button type="submit" disabled={loading}
                  className="w-full py-2 px-4 bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-slate-700 disabled:opacity-50">
                  {loading ? 'Signing in...' : 'Sign in'}
                </button>
                <button type="button" onClick={() => setMode('magic')}
                  className="w-full text-sm text-slate-500 hover:text-slate-700">
                  Sign in with magic link instead
                </button>
              </form>
            ) : (
              <form onSubmit={handleMagicLink} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" />
                </div>
                <button type="submit" disabled={loading}
                  className="w-full py-2 px-4 bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-slate-700 disabled:opacity-50">
                  {loading ? 'Sending...' : 'Send magic link'}
                </button>
                <button type="button" onClick={() => setMode('password')}
                  className="w-full text-sm text-slate-500 hover:text-slate-700">
                  Sign in with password instead
                </button>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
}
