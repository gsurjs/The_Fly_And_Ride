'use client';
import { useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';

export default function AdminBanButton({ userId, isBanned }: { userId: string, isBanned: boolean }) {
  const router = useRouter();
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  
  const [loading, setLoading] = useState(false);

  const handleToggleBan = async () => {
    const action = isBanned ? "UNBAN" : "BAN";
    const confirmed = window.confirm(`Are you sure you want to ${action} this user?`);
    if (!confirmed) return;

    setLoading(true);
    const { error } = await supabase
      .from('profiles')
      .update({ is_banned: !isBanned })
      .eq('id', userId);

    if (error) {
      alert(`Failed to ${action} user: ${error.message}`);
    } else {
      router.refresh(); 
    }
    setLoading(false);
  };

  return (
    <button 
      onClick={handleToggleBan}
      disabled={loading}
      className={`${isBanned ? 'bg-white/10 text-white/50 hover:bg-white/20' : 'bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/20'} text-xs font-bold px-3 py-2 rounded-lg transition-colors disabled:opacity-50`}
    >
      {loading ? '...' : isBanned ? 'UNBAN' : 'BAN USER'}
    </button>
  );
}