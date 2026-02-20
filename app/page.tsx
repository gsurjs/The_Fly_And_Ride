import { createClient } from '@supabase/supabase-js';
import BidCard from './components/BidCard';

// Initialize the Supabase client for Server-Side fetching
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function Home() {
  // Fetch the first available listing 
  const { data: listing, error } = await supabase
    .from('listings')
    .select('*')
    .limit(1)
    .single();

  if (error || !listing) {
    return <div className="p-10 text-white">Listing not found.</div>;
  }

  return (
    // The rich, dark reddish-brown background
    <main className="min-h-screen bg-[#6b2a1a] p-4 md:p-10 flex items-center justify-center font-sans">
      <BidCard listing={listing} />
    </main>
  );
}