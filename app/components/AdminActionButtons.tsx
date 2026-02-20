'use client';
import { useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';

export default function AdminActionButtons({ commentId }: { commentId: string }) {
  const router = useRouter();
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  
  const [loading, setLoading] = useState(false);

  // ACTION 1: The user is innocent. Delete the flag, keep the comment.
  const handleDismiss = async () => {
    setLoading(true);
    const { error } = await supabase
      .from('comment_flags')
      .delete()
      .eq('comment_id', commentId);

    if (error) {
      alert(`Failed to dismiss: ${error.message}`);
    } else {
      router.refresh(); // Instantly removes it from the Admin UI
    }
    setLoading(false);
  };

  // ACTION 2: The comment violates rules. Vaporize it entirely.
  const handleNuke = async () => {
    const confirmed = window.confirm("Are you sure? This will permanently delete the comment from the public listing.");
    if (!confirmed) return;

    setLoading(true);
    const { error } = await supabase
      .from('comments')
      .delete()
      .eq('id', commentId);

    if (error) {
      alert(`Failed to nuke comment: ${error.message}`);
    } else {
      router.refresh(); // Instantly removes it from the Admin UI
    }
    setLoading(false);
  };

  return (
    <div className="flex gap-3">
      <button 
        onClick={handleDismiss} 
        disabled={loading} 
        className="bg-white/10 hover:bg-white/20 text-white font-bold px-4 py-2 rounded-xl text-sm transition-colors disabled:opacity-50 uppercase tracking-widest"
      >
        {loading ? '...' : 'DISMISS FLAG'}
      </button>
      <button 
        onClick={handleNuke} 
        disabled={loading} 
        className="bg-red-500 hover:bg-red-600 text-white font-bold px-4 py-2 rounded-xl text-sm transition-colors shadow-lg shadow-red-500/20 disabled:opacity-50 uppercase tracking-widest"
      >
        {loading ? '...' : 'NUKE COMMENT'}
      </button>
    </div>
  );
}