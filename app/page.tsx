import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import Link from 'next/link'
import { Suspense } from 'react'
import AuctionCard from './components/AuctionCard'

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

  // Fetch listings AND their associated bid amounts
  const { data: listings, error } = await supabase
    .from('listings')
    .select('*, bids(amount)')
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
        <AuctionCard key={bike.id} bike={bike} />
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