'use client';
import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    if (isSignUp) {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) setMessage(error.message);
      else setMessage('Success! Check your email to confirm your account.');
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setMessage(error.message);
      else window.location.href = '/dashboard'; // Send them straight to their new dashboard
    }
    setLoading(false);
  };

  return (
    <main className="min-h-screen bg-[#6b2a1a] flex items-center justify-center font-sans p-4">
      <form onSubmit={handleAuth} className="bg-black/80 p-8 rounded-2xl border border-white/10 max-w-md w-full text-white">
        <h1 className="text-3xl font-extrabold mb-6">{isSignUp ? 'Create Account' : 'Garage Login'}</h1>
        
        {message && <p className="mb-4 text-sm text-[#ff5a20] font-bold">{message}</p>}

        <label className="block text-sm font-bold text-white/50 mb-2 uppercase tracking-wide">Email</label>
        <input 
          type="email" value={email} onChange={(e) => setEmail(e.target.value)}
          className="w-full bg-white/5 border border-white/10 rounded-xl p-3 mb-4 focus:outline-none focus:border-[#ff5a20]" required
        />

        <label className="block text-sm font-bold text-white/50 mb-2 uppercase tracking-wide">Password</label>
        <input 
          type="password" value={password} onChange={(e) => setPassword(e.target.value)}
          className="w-full bg-white/5 border border-white/10 rounded-xl p-3 mb-8 focus:outline-none focus:border-[#ff5a20]" required
        />

        <button type="submit" disabled={loading} className="w-full bg-[#ff5a20] hover:bg-[#ff4500] text-white font-bold py-3 rounded-xl shadow-lg mb-4">
          {loading ? 'PROCESSING...' : (isSignUp ? 'SIGN UP' : 'SIGN IN')}
        </button>

        <p className="text-center text-sm text-white/50">
          {isSignUp ? 'Already have an account?' : 'Need an account?'}
          <button type="button" onClick={() => setIsSignUp(!isSignUp)} className="ml-2 text-white hover:underline">
            {isSignUp ? 'Log in here.' : 'Sign up here.'}
          </button>
        </p>
      </form>
    </main>
  );
}