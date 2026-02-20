import { Suspense } from 'react'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import DeleteListingButton from '../components/DeleteListingButton'

async function DashboardContent() {
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

  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    redirect('/login')
  }

  // 1. Fetching full listing data instead of just the count
  const [
    { data: profile },
    { data: userListings }, // Upgraded this fetch
    { data: watchlistedItems }, 
    { data: userBids }
  ] = await Promise.all([
    supabase.from('profiles').select('username').eq('id', user.id).single(),
    supabase.from('listings').select('*').eq('seller_id', user.id).order('created_at', { ascending: false }),
    supabase.from('watchlist').select('listing_id, listings(*)').eq('user_id', user.id),
    supabase.from('bids').select('listing_id').eq('bidder_id', user.id)
  ])

  const uniqueActiveBidsCount = new Set(userBids?.map(bid => bid.listing_id)).size || 0;
  const watchlistCount = watchlistedItems?.length || 0;
  const listingsCount = userListings?.length || 0;

  return (
    <div className="w-full max-w-7xl mx-auto">
      <h1 className="text-4xl font-bold mb-2">Welcome to your Garage</h1>
      <p className="text-white/50 mb-10">Logged in as: <span className="text-white font-bold">{profile?.username || user.email}</span></p>
      
      {/* Aggregate Numbers */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        <div className="bg-white/5 border border-white/10 p-6 rounded-2xl flex flex-col justify-between">
          <h2 className="text-xl font-bold mb-2 text-white/70">Active Bids</h2>
          <p className="text-4xl font-extrabold text-[#ff5a20]">{uniqueActiveBidsCount}</p>
        </div>
        <div className="bg-white/5 border border-white/10 p-6 rounded-2xl flex flex-col justify-between">
          <h2 className="text-xl font-bold mb-2 text-white/70">Watchlist</h2>
          <p className="text-4xl font-extrabold text-white">{watchlistCount}</p>
        </div>
        <div className="bg-white/5 border border-white/10 p-6 rounded-2xl flex flex-col justify-between">
          <h2 className="text-xl font-bold mb-2 text-white/70">Your Listings</h2>
          <p className="text-4xl font-extrabold text-white">{listingsCount}</p>
        </div>
      </div>

      {/* Active Listings Grid */}
      <div className="mb-12">
        <h3 className="text-2xl font-extrabold mb-6 tracking-tight flex items-center gap-3">
          Your Listings <span className="bg-white/10 text-white/50 text-xs px-3 py-1 rounded-full">{listingsCount}</span>
        </h3>
        {listingsCount === 0 ? (
          <div className="bg-white/5 border border-white/10 p-10 rounded-2xl text-center">
            <p className="text-white/50 font-bold tracking-wide mb-4">You have no active auctions.</p>
            <Link href="/create" className="text-[#ff5a20] hover:text-white font-bold text-sm transition-colors uppercase tracking-widest">
              + Create a Listing
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {userListings?.map((bike: any) => (
              <div key={bike.id} className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden hover:border-[#ff5a20]/50 transition-colors cursor-pointer flex flex-col group relative">
                <div className="absolute top-3 left-3 bg-[#ff5a20] text-white px-3 py-1 rounded-full text-xs font-bold z-10 shadow-lg">
                  YOUR LISTING
                </div>
                <div className="h-48 bg-black relative overflow-hidden">
                  <img 
                    src={bike.image_url || "https://images.unsplash.com/photo-1558981403-c5f9899a28bc?q=80&w=800"} 
                    alt={`${bike.make} ${bike.model}`}
                    className="object-cover w-full h-full opacity-80 group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold text-green-400 border border-white/10">
                    {bike.title_status}
                  </div>
                </div>
                <div className="p-5 flex-grow flex flex-col justify-between">
                  <div>
                    <p className="text-white/50 text-xs font-bold uppercase tracking-widest mb-1">{bike.year} • {bike.mileage.toLocaleString()} mi</p>
                    <h4 className="text-xl font-extrabold mb-4">{bike.make} {bike.model}</h4>
                  </div>
                  <div className="flex justify-between items-end">
                    <div>
                      <p className="text-[10px] text-white/50 uppercase font-bold tracking-wider mb-1">Reserve</p>
                      <p className="text-sm font-semibold">${bike.reserve_price.toLocaleString()}</p>
                    </div>
                    {/* Updated Action Container */}
                    <div className="flex items-center gap-4">
                      {/* Inject the secure delete button */}
                      <DeleteListingButton 
                        listingId={bike.id} 
                        imageUrl={bike.image_url} 
                        endsAt={bike.ends_at} 
                      />
                    <Link href={`/listing/${bike.id}`} className="text-[#ff5a20] text-sm font-bold hover:text-white transition-colors">
                      MANAGE →
                    </Link>
                  </div>
                </div>
              </div>
            </div>
        ))}
        </div>
        )}
      </div>

      {/* The Watchlist Grid */}
      <h3 className="text-2xl font-extrabold mb-6 tracking-tight">Saved to Garage</h3>
      {watchlistCount === 0 ? (
        <div className="bg-white/5 border border-white/10 p-10 rounded-2xl text-center">
          <p className="text-white/50 font-bold tracking-wide">No vehicles saved yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {watchlistedItems?.map((item: any) => {
            const bike = item.listings; 
            if (!bike) return null;
            
            return (
              <div key={item.listing_id} className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden hover:border-white/30 transition-colors cursor-pointer flex flex-col group">
                <div className="h-48 bg-black relative overflow-hidden">
                  <img 
                    src={bike.image_url || "https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?q=80&w=800"} 
                    alt={`${bike.make} ${bike.model}`}
                    className="object-cover w-full h-full opacity-80 group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold text-green-400 border border-white/10">
                    {bike.title_status}
                  </div>
                </div>
                
                <div className="p-5 flex-grow flex flex-col justify-between">
                  <div>
                    <p className="text-white/50 text-xs font-bold uppercase tracking-widest mb-1">{bike.year} • {bike.mileage.toLocaleString()} mi</p>
                    <h4 className="text-xl font-extrabold mb-4">{bike.make} {bike.model}</h4>
                  </div>
                  
                  <div className="flex justify-between items-end">
                    <div>
                      <p className="text-[10px] text-white/50 uppercase font-bold tracking-wider mb-1">Location</p>
                      <p className="text-sm font-semibold">{bike.location}</p>
                    </div>
                    <Link href={`/listing/${bike.id}`} className="text-[#ff5a20] text-sm font-bold hover:text-white transition-colors">
                      VIEW →
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  )
}

export default function Dashboard() {
  return (
    <main className="min-h-screen bg-[#6b2a1a] text-white p-4 md:p-10 font-sans">
      <Suspense fallback={<div className="text-white/50 animate-pulse text-xl font-bold tracking-widest uppercase">Unlocking Garage...</div>}>
        <DashboardContent />
      </Suspense>
    </main>
  )
}