import { Suspense } from 'react';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import Link from 'next/link';
import AuctionCard from '../components/AuctionCard';

// 1. The Server Component that handles the data fetching and filtering
async function BrowseContent({ searchParamsPromise }: { searchParamsPromise: Promise<{ [key: string]: string | undefined }> }) {
  const searchParams = await searchParamsPromise;
  
  // Extract URL parameters
  const q = typeof searchParams.q === 'string' ? searchParams.q.trim() : '';
  const make = searchParams.make || '';
  const titleStatus = searchParams.title_status || '';
  const maxMileage = searchParams.max_mileage || '';
  const sort = searchParams.sort || 'ending_soon';

  // THE MAGIC FLAG: True if the user came from the navbar search
  const isSearchActive = !!q;

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

  const now = new Date().toISOString();

  // 2. Build the dynamic Supabase query
  let query = supabase
    .from('listings')
    .select('*, bids(amount)')
    .gt('ends_at', now); // Only show active auctions

  // Apply Filters
  if (q) {
    query = query.or(`make.ilike.%${q}%,model.ilike.%${q}%`);
  }
  if (make) {
    query = query.ilike('make', make);
  }
  if (titleStatus) {
    query = query.eq('title_status', titleStatus);
  }
  if (maxMileage) {
    query = query.lte('mileage', Number(maxMileage));
  }

  // Apply Sorting
  if (sort === 'newest') {
    query = query.order('created_at', { ascending: false });
  } else if (sort === 'lowest_mileage') {
    query = query.order('mileage', { ascending: true });
  } else {
    query = query.order('ends_at', { ascending: true }); // Default: Ending Soonest
  }

  const { data: listings, error } = await query;

  if (error) {
    return <div className="text-red-400 font-bold p-10 text-center">Failed to load marketplace data.</div>;
  }

  return (
    <div className="flex flex-col lg:flex-row gap-8 w-full max-w-7xl mx-auto">
      
      {/* LEFT COLUMN: The Filter Engine 
          - Normally DOM order 1.
          - If searching: order-2 on mobile (pushes to bottom), lg:order-1 on desktop (keeps it on the left).
      */}
      <aside className={`w-full lg:w-80 flex-shrink-0 ${isSearchActive ? 'order-2 lg:order-1' : ''}`}>
        <form action="/browse" method="GET" className="bg-black/40 border border-white/10 rounded-3xl p-6 backdrop-blur-sm sticky top-24">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-extrabold text-white tracking-tight">Filters</h2>
            <Link href="/browse" className="text-white/40 hover:text-white text-xs font-bold uppercase tracking-widest transition-colors">
              Reset
            </Link>
          </div>

          <div className="space-y-6">
            {/* Search Bar */}
            <div>
              <label className="block text-[10px] font-bold text-white/50 uppercase tracking-wider mb-2">Search</label>
              <input name="q" type="text" defaultValue={q} placeholder="e.g. Panigale, R1..." className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-[#ff5a20] transition-colors" />
            </div>

            {/* Make Dropdown */}
            <div>
              <label className="block text-[10px] font-bold text-white/50 uppercase tracking-wider mb-2">Make</label>
              <select name="make" defaultValue={make} className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-[#ff5a20] transition-colors appearance-none">
                <option value="" className="bg-black">All Makes</option>
                <option value="Ducati" className="bg-black">Ducati</option>
                <option value="Yamaha" className="bg-black">Yamaha</option>
                <option value="Honda" className="bg-black">Honda</option>
                <option value="BMW" className="bg-black">BMW</option>
                <option value="Kawasaki" className="bg-black">Kawasaki</option>
                <option value="Suzuki" className="bg-black">Suzuki</option>
                <option value="Harley-Davidson" className="bg-black">Harley-Davidson</option>
                <option value="Triumph" className="bg-black">Triumph</option>
              </select>
            </div>

            {/* Title Status */}
            <div>
              <label className="block text-[10px] font-bold text-white/50 uppercase tracking-wider mb-2">Title Status</label>
              <select name="title_status" defaultValue={titleStatus} className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-[#ff5a20] transition-colors appearance-none">
                <option value="" className="bg-black">Any Title</option>
                <option value="Clean" className="bg-black">Clean Only</option>
                <option value="Rebuilt" className="bg-black">Rebuilt</option>
                <option value="Salvage" className="bg-black">Salvage</option>
              </select>
            </div>

            {/* Max Mileage */}
            <div>
              <label className="block text-[10px] font-bold text-white/50 uppercase tracking-wider mb-2">Max Mileage</label>
              <input name="max_mileage" type="number" step="1000" min="0" defaultValue={maxMileage} placeholder="Any" className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-[#ff5a20] transition-colors" />
            </div>

            {/* Sort Order */}
            <div>
              <label className="block text-[10px] font-bold text-white/50 uppercase tracking-wider mb-2">Sort By</label>
              <select name="sort" defaultValue={sort} className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-[#ff5a20] transition-colors appearance-none">
                <option value="ending_soon" className="bg-black">Ending Soonest</option>
                <option value="newest" className="bg-black">Newly Listed</option>
                <option value="lowest_mileage" className="bg-black">Lowest Mileage</option>
              </select>
            </div>

            {/* Submit Button */}
            <button type="submit" className="w-full bg-[#ff5a20] hover:bg-[#ff4500] text-white font-extrabold py-3 rounded-xl shadow-lg transition-colors text-sm tracking-wide mt-4">
              APPLY FILTERS
            </button>
          </div>
        </form>
      </aside>

      {/* RIGHT COLUMN: The Results Grid 
          - Normally DOM order 2.
          - If searching: order-1 on mobile (pulls to top), lg:order-2 on desktop (keeps it on the right).
      */}
      <div className={`flex-1 ${isSearchActive ? 'order-1 lg:order-2' : ''}`}>
        <div className="mb-6 flex justify-between items-end border-b border-white/10 pb-4">
          <div>
            {/* Dynamic Header */}
            <h1 className="text-3xl font-extrabold text-white tracking-tight">
              {isSearchActive ? `Search Results for "${q}"` : "Active Marketplace"}
            </h1>
            <p className="text-white/50 font-bold uppercase tracking-widest text-xs mt-1">
              {listings?.length || 0} {listings?.length === 1 ? 'Motorcycle' : 'Motorcycles'} Found
            </p>
          </div>
        </div>

        {listings && listings.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {listings.map(bike => (
              <AuctionCard key={bike.id} bike={bike} />
            ))}
          </div>
        ) : (
          <div className="bg-white/5 border border-white/10 rounded-3xl p-16 text-center mt-4">
            <span className="text-4xl mb-4 block">🏍️</span>
            <h3 className="text-2xl font-extrabold text-white mb-2">No Matches Found</h3>
            <p className="text-white/50 font-semibold mb-6">Try adjusting your filters or clearing your search query.</p>
            <Link href="/browse" className="bg-white/10 hover:bg-white/20 text-white font-bold py-2 px-6 rounded-lg transition-colors text-sm">
              Clear All Filters
            </Link>
          </div>
        )}
      </div>

    </div>
  );
}

// 3. The top-level page component with Next 15 Suspense
export default function BrowsePage({ searchParams }: { searchParams: Promise<{ [key: string]: string | undefined }> }) {
  return (
    <main className="min-h-screen bg-[#6b2a1a] p-4 md:p-10 font-sans">
      <Suspense fallback={
        <div className="flex justify-center items-center pt-20">
          <div className="text-[#ff5a20] animate-pulse text-xl font-bold tracking-widest uppercase">Scanning Ledger...</div>
        </div>
      }>
        <BrowseContent searchParamsPromise={searchParams} />
      </Suspense>
    </main>
  );
}