import { Suspense } from 'react';
import { createClient } from '@supabase/supabase-js';
import BidCard from './components/BidCard';

// Initialize the Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// 1. Separate the async database call into its own component
async function ListingFetcher() {
  const { data: listing, error } = await supabase
    .from('listings')
    .select('*')
    .limit(1)
    .single();

  if (error || !listing) {
    return <div className="p-10 text-white font-bold">No motorcycles found in the database yet.</div>;
  }

  return <BidCard listing={listing} />;
}

// 2. Wrap the fetcher in a Suspense boundary on the main page
export default function Home() {
  return (
    <main className="min-h-screen bg-[#6b2a1a] p-4 md:p-10 flex items-center justify-center font-sans">
      <Suspense fallback={<div className="text-white text-xl animate-pulse">Loading auction data...</div>}>
        <ListingFetcher />
      </Suspense>
    </main>
  );
}