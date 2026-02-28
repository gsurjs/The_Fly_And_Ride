import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import Link from 'next/link';
import LiveTimer from './LiveTimer'; // You need a tiny Client component for the live countdown (see Step 2b below)

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
    .limit(4); // Limit to 4 prominent cards for the homepage top row

  if (!featuredListings || featuredListings.length === 0) {
    return null; // Don't show the banner if nothing is featured
  }

  return (
    <section className="w-full max-w-screen-2xl mx-auto px-4 md:px-10 mt-10 mb-16">
      <div className="flex items-center gap-3 mb-6">
        <span className="text-[#ff5a20] animate-pulse text-2xl">🔥</span>
        <h2 className="text-2xl font-black text-white tracking-tight uppercase">Featured Auctions</h2>
      </div>
      
      {/* 4-Column Grid: Large cinematic cards on desktop, horizontal scroll on mobile */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 overflow-x-auto pb-4 custom-scrollbar lg:overflow-visible lg:pb-0">
        {featuredListings.map((bike: any) => {
          
          const highestBid = bike.bids && bike.bids.length > 0 
            ? Math.max(...bike.bids.map((b: any) => b.amount)) 
            : 0;

          return (
            <Link key={bike.id} href={`/listing/${bike.id}`} className="group block h-full flex-shrink-0 w-[80vw] sm:w-auto lg:w-full">
              <div className="relative rounded-3xl overflow-hidden h-[300px] sm:h-[350px] lg:h-[400px] bg-black border border-white/10 group-hover:border-[#ff5a20]/30 transition-all duration-300 shadow-2xl hover:shadow-[#ff5a20]/10 hover:-translate-y-1">
                {/* 1. Cinematic Background Image */}
                <img 
                  src={bike.image_url} 
                  alt={`${bike.make} ${bike.model}`} 
                  className="w-full h-full object-cover opacity-90 group-hover:scale-105 group-hover:opacity-100 transition-all duration-700" 
                />
                
                {/* 2. Heavy Gradient Overlay for text visibility (Top and Bottom) */}
                <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-black/70 to-transparent"></div>
                <div className="absolute bottom-0 left-0 w-full h-2/3 bg-gradient-to-t from-black/95 via-black/30 to-transparent"></div>

                {/* 3. Top Floating Info (Title Status & Reserve) */}
                <div className="absolute top-4 left-4 flex gap-2">
                   <div className={`backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase shadow-lg border ${!bike.reserve_price || bike.reserve_price === 0 ? 'bg-green-500/90 text-white border-green-400/50' : 'bg-black/60 text-white/80 border-white/20'}`}>
                    {!bike.reserve_price || bike.reserve_price === 0 ? 'No Reserve' : 'Reserve'}
                  </div>
                  <div className={`backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase shadow-lg border ${bike.title_status === 'Clean' ? 'bg-black/60 text-green-400 border-green-400/20' : 'bg-black/60 text-yellow-400 border-yellow-400/20'}`}>
                    {bike.title_status} Title
                  </div>
                </div>

                {/* 4. The Data Grid (Bottom Glass Box) */}
                <div className="absolute bottom-4 left-4 right-4 bg-black/40 backdrop-blur-xl border border-white/5 p-5 rounded-2xl flex flex-col gap-4 shadow-2xl z-10">
                  <div className="border-b border-white/5 pb-3">
                    <p className="text-[#ff5a20] text-sm font-extrabold uppercase tracking-widest mb-1">{bike.year}</p>
                    <h3 className="text-3xl font-black text-white tracking-tight group-hover:text-[#ff5a20] transition-colors line-clamp-1">{bike.make} {bike.model}</h3>
                  </div>

                  <div className="flex justify-between items-center text-white">
                    <div className="border-r border-white/5 pr-4 flex-1">
                      <p className="text-[10px] text-white/50 uppercase font-bold tracking-wider mb-1">Ends In</p>
                      {/* Live Client Timer */}
                      <div className="font-bold text-lg tabular-nums">
                        <LiveTimer endsAt={bike.ends_at} />
                      </div>
                    </div>
                    
                    <div className="flex-1 pl-4 text-right">
                      <p className="text-[10px] text-white/50 uppercase font-bold tracking-wider mb-1">Current Bid</p>
                      <p className="text-2xl font-black text-[#ff5a20]">
                        ${highestBid.toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>

              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}