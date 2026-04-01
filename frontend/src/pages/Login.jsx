import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../lib/firebase';

export default function Login() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
      navigate('/');
    } catch (err) {
      setError(err.message.replace('Firebase: ', '').replace(/\(.*\)\.?/, '').trim());
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-slate-900">
      {/* Animated background orbs */}
      <div className="absolute top-0 -left-4 w-96 h-96 bg-purple-600 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-pulse" />
      <div className="absolute top-0 -right-4 w-96 h-96 bg-cyan-500 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-pulse" style={{animationDelay: '2s'}} />
      <div className="absolute -bottom-8 left-20 w-96 h-96 bg-indigo-600 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-pulse" style={{animationDelay: '4s'}} />

      <div className="relative z-10 w-full max-w-md px-6 animate-fade-in-up">
        {/* Logo + Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-2xl mb-4 animate-pulse-glow">
            <span className="text-4xl">🔍</span>
          </div>
          <h1 className="text-4xl font-black text-white mb-2 tracking-tight">
            InspectAI
          </h1>
          <p className="text-slate-400 text-sm font-medium">
            🤖 AI-Powered Defect Detection Platform
          </p>
        </div>

        {/* Glass card */}
        <div className="glass rounded-3xl p-8 shadow-2xl card-shine">
          <h2 className="text-xl font-bold text-white mb-1">
            {isLogin ? '👋 Welcome back!' : '🚀 Join InspectAI'}
          </h2>
          <p className="text-slate-400 text-sm mb-6">
            {isLogin ? 'Sign in to view your inspections' : 'Create your free account to get started'}
          </p>

          <form className="space-y-4" onSubmit={handleSubmit}>
            {error && (
              <div className="flex items-center gap-2 bg-red-500/20 border border-red-500/40 text-red-300 text-sm px-4 py-3 rounded-xl">
                ⚠️ {error}
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="text-slate-400 text-xs font-semibold uppercase tracking-widest mb-1 block">📧 Email</label>
                <input
                  type="email"
                  required
                  className="w-full bg-white/10 border border-white/20 text-white placeholder-slate-500 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div>
                <label className="text-slate-400 text-xs font-semibold uppercase tracking-widest mb-1 block">🔒 Password</label>
                <input
                  type="password"
                  required
                  className="w-full bg-white/10 border border-white/20 text-white placeholder-slate-500 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-6 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl font-semibold text-sm hover:from-indigo-600 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-transparent transition-all duration-200 shadow-lg hover:shadow-indigo-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  {isLogin ? 'Signing In...' : 'Creating Account...'}
                </span>
              ) : (
                isLogin ? '✨ Sign In' : '🚀 Create Account'
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => { setIsLogin(!isLogin); setError(''); }}
              className="text-indigo-400 hover:text-indigo-300 text-sm font-medium transition-colors"
            >
              {isLogin ? "Don't have an account? Sign up →" : "Already have an account? Sign in →"}
            </button>
          </div>
        </div>

        {/* Bottom badges */}
        <div className="flex justify-center gap-4 mt-6">
          {['🔐 Secure Auth', '⚡ Real-time AI', '📊 Analytics'].map(badge => (
            <span key={badge} className="text-xs text-slate-500 font-medium">{badge}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
