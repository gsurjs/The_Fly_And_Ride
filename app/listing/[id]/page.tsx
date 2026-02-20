import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import BidCard from '../../components/BidCard'; 
import { Suspense } from 'react';

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

  return <BidCard listing={listing} />;
}

// 3. Keep the top-level page completely synchronous
export default function ListingPage({ params }: PageProps) {
  return (
    <main className="min-h-screen bg-black p-4 md:p-10 flex items-center justify-center font-sans">
      <Suspense fallback={<div className="text-white text-xl animate-pulse font-bold tracking-widest uppercase">Fetching Motorcycle Data...</div>}>
        {/* Pass the Promise directly into the shielded component */}
        <ListingContent paramsPromise={params} />
      </Suspense>
    </main>
  );
}