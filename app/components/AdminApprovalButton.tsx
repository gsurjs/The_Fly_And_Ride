'use client';
import { useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';

export default function AdminApproveButton({ listingId }: { listingId: string }) {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const handleApprove = async () => {
    setIsLoading(true);
    
    const { error } = await supabase
      .from('listings')
      .update({ status: 'active' })
      .eq('id', listingId);

    if (error) {
      alert(`Approval failed: ${error.message}`);
      setIsLoading(false);
    } else {
      router.refresh(); // Refresh the admin dashboard to remove it from the queue
    }
  };

  return (
    <button
      onClick={handleApprove}
      disabled={isLoading}
      className="bg-green-500/20 text-green-400 hover:bg-green-500 hover:text-white border border-green-500/50 text-xs font-bold px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
    >
      {isLoading ? 'APPROVING...' : '✓ APPROVE & PUBLISH'}
    </button>
  );
}