import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import BidCard from '../../components/BidCard'; 
import CommentsSection from '../../components/CommentsSection'; // 1. Imported the new Q&A component
import { Suspense } from 'react';
import ReviewSeller from '../../components/ReviewSeller';
import SellerBadge from '../../components/SellerBadge';

interface PageProps {
  params: Promise<{ id: string }>;
}

// 1. Accept the raw Promise as a prop
async function ListingContent({ paramsPromise }: { paramsPromise: Promise<{ id: string }> }) {
  // 2. Safely await the dynamic parameter INSIDE the Suspense boundary
  const { id } = await paramsPromise;
  
  const cookieStore = await cookies();
  
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll() { /* Ignored in server components */ },
      },
    }
  );

  const { data: listing, error } = await supabase
    .from('listings')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !listing) {
    notFound(); 
  }

  // Securely tell Supabase to tick the database counter up by 1
  await supabase.rpc('increment_listing_views', { listing_id: id });

  // Optimistically update the local object so this user's view is reflected instantly on their screen
  listing.views = (listing.views || 0) + 1;

  // 3. Stack the BidCard and the new CommentsSection vertically
  return (
    <div className="w-full flex flex-col items-center gap-6">
      <ReviewSeller 
        listingId={listing.id} 
        sellerId={listing.seller_id} 
        endDate={listing.ends_at} 
      />
      <BidCard listing={listing} />
      <SellerBadge sellerId={listing.seller_id} />
      <CommentsSection listingId={listing.id} sellerId={listing.seller_id} />
    </div>
  );
}

// 4. Keep the top-level page completely synchronous
export default function ListingPage({ params }: PageProps) {
  return (
    <main className="min-h-screen bg-black p-4 md:p-10 flex flex-col items-center font-sans">
      <Suspense fallback={<div className="text-white text-xl animate-pulse font-bold tracking-widest uppercase mt-20">Fetching Motorcycle Data...</div>}>
        {/* Pass the Promise directly into the shielded component */}
        <ListingContent paramsPromise={params} />
      </Suspense>
    </main>
  );
}