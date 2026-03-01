'use client';
import { useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';

export default function AdminFeatureButton({ listingId, initialFeatured }: { listingId: string, initialFeatured: boolean }) {
  const [isFeatured, setIsFeatured] = useState(initialFeatured);
  const [isLoading, setIsLoading] = useState(false);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const toggleFeature = async () => {
    if (isLoading) return;
    setIsLoading(true);
    
    const newStatus = !isFeatured;
    
    const { error } = await supabase
      .from('listings')
      .update({ featured: newStatus })
      .eq('id', listingId);

    if (error) {
      alert(`Failed to update status: ${error.message}`);
    } else {
      setIsFeatured(newStatus);
    }
    
    setIsLoading(false);
  };

  return (
    <button
      onClick={toggleFeature}
      disabled={isLoading}
      className={`text-xs font-bold px-3 py-2 rounded-lg transition-colors border flex items-center gap-1 ${
        isFeatured 
          ? 'bg-[#ff5a20]/20 text-[#ff5a20] border-[#ff5a20]/50 hover:bg-[#ff5a20] hover:text-white' 
          : 'bg-white/5 text-white/50 border-white/10 hover:bg-white/20 hover:text-white'
      }`}
    >
      {isLoading ? '...' : isFeatured ? '★ UN-FEATURE' : '☆ FEATURE'}
    </button>
  );
}