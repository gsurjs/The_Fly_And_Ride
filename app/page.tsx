import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import Link from 'next/link'
import { Suspense } from 'react'

async function AuctionFeed() {
  const cookieStore = await cookies()
  
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll() { /* Ignored in server components */ },
      },
    }
  )

  // Fetch all listings, newest first
  const { data: listings, error } = await supabase
    .from('listings')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    return <div className="text-red-400 font-bold p-10 text-center">Failed to load auction feed.</div>
  }

  if (!listings || listings.length === 0) {
    return (
      <div className="w-full flex flex-col items-center justify-center py-20 text-center">
        <h2 className="text-3xl font-extrabold text-white mb-4">No Active Auctions</h2>
        <p className="text-white/50 mb-8">Be the first to list a motorcycle on FLY&RIDE.</p>
        <Link href="/create" className="bg-[#ff5a20] hover:bg-[#ff4500] text-white font-bold py-3 px-8 rounded-full transition-colors">
          START SELLING
        </Link>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {listings.map((bike: any) => (
        <Link href={`/listing/${bike.id}`} key={bike.id} className="group block">
          <div className="bg-black/40 border border-white/10 rounded-2xl overflow-hidden hover:border-white/30 transition-all duration-300 flex flex-col h-full hover:-translate-y-1 hover:shadow-2xl hover:shadow-black/50">
            
            {/* Image Section */}
            <div className="h-56 bg-black relative overflow-hidden">
              <img 
                src={bike.image_url || "https://images.unsplash.com/photo-1558981403-c5f9899a28bc?q=80&w=800"} 
                alt={`${bike.make} ${bike.model}`}
                className="object-cover w-full h-full opacity-80 group-hover:scale-105 group-hover:opacity-100 transition-all duration-700"
              />
              <div className="absolute bottom-0 left-0 w-full h-1/2 bg-gradient-to-t from-black/80 to-transparent"></div>
              
              {/* Floating Badges */}
              <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold text-white border border-white/10">
                {bike.location}
              </div>
            </div>
            
            {/* Details Section */}
            <div className="p-5 flex-grow flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <p className="text-[#ff5a20] text-xs font-extrabold uppercase tracking-widest">{bike.year}</p>
                  <p className="text-white/50 text-xs font-bold uppercase tracking-widest">{bike.mileage.toLocaleString()} mi</p>
                </div>
                <h4 className="text-2xl font-extrabold text-white mb-4 tracking-tight group-hover:text-[#ff5a20] transition-colors">
                  {bike.make} {bike.model}
                </h4>
              </div>
              
              <div className="flex justify-between items-end pt-4 border-t border-white/10">
                <div>
                  <p className="text-[10px] text-white/50 uppercase font-bold tracking-wider mb-1">Title</p>
                  <p className={`text-sm font-semibold ${bike.title_status === 'Clean' ? 'text-green-400' : 'text-yellow-400'}`}>
                    {bike.title_status}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-white/50 uppercase font-bold tracking-wider mb-1">Current Bid</p>
                  <p className="text-lg font-extrabold text-white">
                    {/* Placeholder for actual highest bid logic */}
                    ${(bike.reserve_price * 0.8).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>

          </div>
        </Link>
      ))}
    </div>
  )
}

export default function Home() {
  return (
    <main className="min-h-screen bg-[#6b2a1a] pb-20 font-sans">
      {/* Hero Header */}
      <div className="w-full bg-black/80 border-b border-white/10 pt-20 pb-16 px-4 md:px-10 text-center mb-12">
        <h1 className="text-5xl md:text-7xl font-extrabold text-white tracking-tighter mb-6">
          The Premier <span className="text-[#ff5a20]">Motorcycle</span> Exchange
        </h1>
        <p className="text-white/60 text-lg md:text-xl max-w-2xl mx-auto font-medium tracking-wide">
          Discover, bid on, and win exclusive two-wheeled machinery from verified sellers across the nation.
        </p>
      </div>

      {/* Grid Container */}
      <div className="max-w-7xl mx-auto px-4 md:px-10">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-2xl font-extrabold text-white tracking-tight">Live Auctions</h2>
          <div className="text-white/50 text-sm font-bold uppercase tracking-widest flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
            Real-Time Updates
          </div>
        </div>
        
        <Suspense fallback={
          <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-96 bg-black/20 animate-pulse rounded-2xl border border-white/5"></div>
            ))}
          </div>
        }>
          <AuctionFeed />
        </Suspense>
      </div>
    </main>
  )
}