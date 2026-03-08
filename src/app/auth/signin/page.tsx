'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabase } from '@/lib/supabase';
import { Utensils, Loader2 } from 'lucide-react';

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);

    const sb = getSupabase();
    if (!sb) {
      setError('Auth is not configured. Set Supabase env vars.');
      setLoading(false);
      return;
    }

    if (isSignUp) {
      const { error: signUpError } = await sb.auth.signUp({
        email,
        password,
      });
      if (signUpError) {
        setError(signUpError.message);
      } else {
        setSuccessMsg('Account created! You can now sign in.');
        setIsSignUp(false);
        setPassword('');
      }
    } else {
      const { error: signInError } = await sb.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError) {
        setError(signInError.message);
      } else {
        router.push('/');
      }
    }
    setLoading(false);
  };

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-sm w-full">
        <div className="text-center mb-8">
          <Utensils className="w-12 h-12 text-berkeley-gold mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Oski&apos;s Forkast</h1>
          <p className="text-slate-400 text-sm">
            {isSignUp ? 'Create an account to sync ratings across devices' : 'Sign in to save your ratings across devices'}
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-900/30 border border-red-800 text-red-300 text-sm">
            {error}
          </div>
        )}

        {successMsg && (
          <div className="mb-4 p-3 rounded-lg bg-green-900/30 border border-green-800 text-green-300 text-sm">
            {successMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg bg-[#111827] border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-berkeley-gold transition-colors"
              placeholder="you@berkeley.edu"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-300 mb-1">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg bg-[#111827] border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-berkeley-gold transition-colors"
              placeholder={isSignUp ? 'At least 6 characters' : 'Your password'}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-berkeley-gold text-berkeley-blue font-semibold px-6 py-2.5 rounded-lg hover:bg-berkeley-lightgold transition-colors disabled:opacity-50"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {isSignUp ? 'Create Account' : 'Sign In'}
          </button>
        </form>

        <div className="mt-4 text-center">
          <button
            onClick={() => { setIsSignUp(!isSignUp); setError(''); setSuccessMsg(''); }}
            className="text-sm text-berkeley-gold hover:text-berkeley-lightgold transition-colors"
          >
            {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
          </button>
        </div>

        <div className="mt-4 text-center">
          <a href="/" className="text-sm text-slate-500 hover:text-slate-300 transition-colors">
            Continue without signing in →
          </a>
        </div>

        <p className="mt-6 text-xs text-slate-600 text-center">
          Without an account, your ratings are saved only in this browser.
          Sign in to sync across all your devices.
        </p>
      </div>
    </main>
  );
}
