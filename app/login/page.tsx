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
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      alert(error.message);
    } else {
      // Redirect back to the auction page upon successful secure login
      window.location.href = '/'; 
    }
    setLoading(false);
  };

  return (
    <main className="min-h-screen bg-[#6b2a1a] flex items-center justify-center font-sans p-4">
      <form onSubmit={handleLogin} className="bg-black/80 p-8 rounded-2xl border border-white/10 max-w-md w-full text-white">
        <h1 className="text-3xl font-extrabold mb-6">Garage Login</h1>
        
        <label className="block text-sm font-bold text-white/50 mb-2 uppercase tracking-wide">Email</label>
        <input 
          type="email" 
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full bg-white/5 border border-white/10 rounded-xl p-3 mb-4 focus:outline-none focus:border-[#ff5a20] transition-colors"
          required
        />

        <label className="block text-sm font-bold text-white/50 mb-2 uppercase tracking-wide">Password</label>
        <input 
          type="password" 
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full bg-white/5 border border-white/10 rounded-xl p-3 mb-8 focus:outline-none focus:border-[#ff5a20] transition-colors"
          required
        />

        <button 
          type="submit" 
          disabled={loading}
          className="w-full bg-[#ff5a20] hover:bg-[#ff4500] disabled:opacity-50 text-white font-bold py-3 rounded-xl shadow-lg transition-colors"
        >
          {loading ? 'AUTHENTICATING...' : 'SIGN IN'}
        </button>
      </form>
    </main>
  );
}