'use client';
import { useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';

interface DeleteProps {
  listingId: string;
  imageUrl: string;
  endsAt: string;
}

export default function DeleteListingButton({ listingId, imageUrl, endsAt }: DeleteProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const router = useRouter();
  
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // 1. Time Check: Prevent deletion if the auction is already over
  const hasEnded = new Date(endsAt) <= new Date();

  const handleDelete = async () => {
    if (hasEnded) {
      alert("This auction has already ended. It cannot be deleted.");
      return;
    }

    const confirmed = window.confirm("Are you sure you want to delete this motorcycle from the platform? This cannot be undone.");
    if (!confirmed) return;

    setIsDeleting(true);

    try {
      // 2. Cost-Saving Step: Extract the filename and delete the image from the bucket FIRST
      if (imageUrl && imageUrl.includes('/motorcycles/')) {
        const fileName = imageUrl.split('/motorcycles/').pop();
        if (fileName) {
          await supabase.storage.from('motorcycles').remove([fileName]);
        }
      }

      // 3. Delete the actual row from PostgreSQL
      const { error } = await supabase
        .from('listings')
        .delete()
        .eq('id', listingId);

      if (error) {
        throw error;
      }

      // 4. Force Next.js to re-fetch the server components and update the Dashboard UI
      router.refresh();
      
    } catch (error: any) {
      console.error("Deletion Error:", error);
      alert(`Failed to delete listing: ${error.message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  // If the auction has ended, we don't even render the button
  if (hasEnded) return null;

  return (
    <button 
      onClick={handleDelete}
      disabled={isDeleting}
      className="text-red-500 text-[10px] font-extrabold uppercase tracking-widest hover:text-red-400 transition-colors disabled:opacity-50"
    >
      {isDeleting ? 'REMOVING...' : 'DELETE LISTING'}
    </button>
  );
}