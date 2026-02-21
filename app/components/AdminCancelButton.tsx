'use client';
import { useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';

export default function AdminCancelButton({ listingId }: { listingId: string }) {
  const router = useRouter();
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  
  const [loading, setLoading] = useState(false);

  const handleCancel = async () => {
    const confirmed = window.confirm("Are you sure? This will permanently delete the auction, all its bids, and its discussion thread.");
    if (!confirmed) return;

    setLoading(true);
    const { error } = await supabase
      .from('listings')
      .delete()
      .eq('id', listingId);

    if (error) {
      alert(`Failed to cancel listing: ${error.message}`);
    } else {
      router.refresh(); // Instantly updates the dashboard
    }
    setLoading(false);
  };

  return (
    <button 
      onClick={handleCancel}
      disabled={loading}
      className="bg-red-500/20 text-red-400 hover:bg-red-500 hover:text-white border border-red-500/30 text-xs font-bold px-3 py-2 rounded-lg transition-colors disabled:opacity-50"
    >
      {loading ? '...' : 'CANCEL'}
    </button>
  );
}