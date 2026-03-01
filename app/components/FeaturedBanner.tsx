import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import FeaturedCarousel from './FeaturedCarousel';

export default async function FeaturedBanner() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
      },
    }
  );

  // 1. Fetch Featured Listings that haven't ended yet
  const { data: featuredListings } = await supabase
    .from('listings')
    .select('*, bids(amount)')
    .eq('featured', true)
    .gt('ends_at', new Date().toISOString()) // Only show active auctions
    .order('ends_at', { ascending: true }) // Show ending soonest first
    .limit(5); // Fetch top 5 for the carousel

  if (!featuredListings || featuredListings.length === 0) {
    return null; // Don't show the banner if nothing is featured
  }

  return (
    <section className="w-full max-w-screen-2xl mx-auto px-4 md:px-10 mt-6 mb-12">
      {/* 2. Pass the data to the interactive slideshow */}
      <FeaturedCarousel listings={featuredListings} />
    </section>
  );
}