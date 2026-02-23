import { Suspense } from 'react'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import DeleteListingButton from '../components/DeleteListingButton'

// 1. Accept the raw Promise from the parent page
async function DashboardContent({ searchParamsPromise }: { searchParamsPromise: Promise<{ tab?: string }> }) {
  // 2. Await the dynamic URL parameters safely INSIDE the Suspense boundary
  const resolvedParams = await searchParamsPromise;
  const currentTab = resolvedParams.tab || 'watchlist';

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

  const [
    { data: profile },
    { data: userListings }, 
    { data: watchlistedItems }, 
    { data: userBids }
  ] = await Promise.all([
    supabase.from('profiles').select('username').eq('id', user.id).single(),
    supabase.from('listings').select('*').eq('seller_id', user.id).order('created_at', { ascending: false }),
    supabase.from('watchlist').select('listing_id, listings(*)').eq('user_id', user.id),
    supabase.from('bids').select('listing_id, amount, listings(*)').eq('bidder_id', user.id).order('amount', { ascending: false })
  ])

  const uniqueBids = new Map();
  userBids?.forEach(bid => {
    if (bid.listings && !uniqueBids.has(bid.listing_id)) {
      uniqueBids.set(bid.listing_id, {
        ...bid.listings,
        myHighestBid: bid.amount
      });
    }
  });
  const activeBidsList = Array.from(uniqueBids.values());

  const uniqueActiveBidsCount = activeBidsList.length;
  const watchlistCount = watchlistedItems?.length || 0;
  const listingsCount = userListings?.length || 0;

  return (
    <div className="w-full max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-center bg-black/40 border border-white/10 p-6 md:p-8 rounded-3xl mb-10 backdrop-blur-sm shadow-xl mt-8">
        <div className="text-center md:text-left mb-6 md:mb-0">
          <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight">My Garage</h1>
          <p className="text-white/50 text-sm mt-2 font-semibold uppercase tracking-widest">Manage your listings, bids, and reputation</p>
        </div>
        
        <div className="flex flex-wrap justify-center gap-4">
          <Link 
            href="/dashboard/profile" 
            className="bg-white/5 hover:bg-white/10 border border-white/10 text-white px-6 py-3 rounded-xl font-bold transition-colors text-sm shadow-md flex items-center gap-2"
          >
            <span>⚙️</span> Edit Profile
          </Link>
          <Link 
            href={`/user/${user.id}`} 
            className="bg-white/10 hover:bg-white/20 border border-white/20 text-white px-6 py-3 rounded-xl font-bold transition-colors text-sm shadow-md flex items-center gap-2"
          >
            <span>👁️</span> View Public Page
          </Link>
          <Link 
            href="/create" 
            className="bg-[#ff5a20] hover:bg-[#ff4500] text-white px-6 py-3 rounded-xl font-bold transition-colors text-sm shadow-lg shadow-orange-900/20 flex items-center gap-2"
          >
            <span>➕</span> Sell Motorcycle
          </Link>
        </div>
      </div>
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

      {/* Tab Navigation Row */}
      <div className="flex gap-4 mb-8 overflow-x-auto pb-2 custom-scrollbar">
        <Link 
          href="?tab=watchlist"
          className={`px-6 py-3 rounded-xl font-extrabold text-sm tracking-widest uppercase transition-all whitespace-nowrap ${currentTab === 'watchlist' ? 'bg-white text-black shadow-lg scale-105' : 'bg-black/40 text-white/50 hover:bg-black/60 hover:text-white border border-white/10'}`}
        >
          Saved Vehicles ({watchlistCount})
        </Link>
        <Link 
          href="?tab=bids"
          className={`px-6 py-3 rounded-xl font-extrabold text-sm tracking-widest uppercase transition-all whitespace-nowrap ${currentTab === 'bids' ? 'bg-[#ff5a20] text-white shadow-lg shadow-[#ff5a20]/20 scale-105' : 'bg-black/40 text-white/50 hover:bg-black/60 hover:text-white border border-white/10'}`}
        >
          Active Bids ({uniqueActiveBidsCount})
        </Link>
        <Link 
          href="?tab=listings"
          className={`px-6 py-3 rounded-xl font-extrabold text-sm tracking-widest uppercase transition-all whitespace-nowrap ${currentTab === 'listings' ? 'bg-white text-black shadow-lg scale-105' : 'bg-black/40 text-white/50 hover:bg-black/60 hover:text-white border border-white/10'}`}
        >
          My Listings ({listingsCount})
        </Link>
      </div>

      <div className="bg-black/30 border border-white/10 rounded-3xl p-6 md:p-8 backdrop-blur-sm min-h-[500px]">
        
        {/* =========================================
            TAB 1: WATCHLIST 
            ========================================= */}
        {currentTab === 'watchlist' && (
          <div>
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
        )}

        {/* =========================================
            TAB 2: ACTIVE BIDS
            ========================================= */}
        {currentTab === 'bids' && (
          <div>
            <h3 className="text-2xl font-extrabold mb-6 tracking-tight">Your Active Bids</h3>
            {uniqueActiveBidsCount === 0 ? (
              <div className="bg-white/5 border border-white/10 p-10 rounded-2xl text-center">
                <p className="text-white/50 font-bold tracking-wide">You haven't placed any bids yet.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {activeBidsList.map((bike: any) => (
                  <div key={bike.id} className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden hover:border-[#ff5a20]/50 transition-colors cursor-pointer flex flex-col group relative">
                    <div className="absolute top-3 left-3 bg-[#ff5a20] text-white px-3 py-1 rounded-full text-[10px] font-black tracking-widest z-10 shadow-lg uppercase border border-[#ff5a20]/50">
                      Your Max: ${bike.myHighestBid.toLocaleString()}
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
                        <Link href={`/listing/${bike.id}`} className="text-[#ff5a20] text-sm font-bold hover:text-white transition-colors">
                          VIEW AUCTION →
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* =========================================
            TAB 3: YOUR LISTINGS
            ========================================= */}
        {currentTab === 'listings' && (
          <div>
            <h3 className="text-2xl font-extrabold mb-6 tracking-tight">Your Active Listings</h3>
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
                    <div className="absolute top-3 left-3 bg-white/10 backdrop-blur-md text-white px-3 py-1 rounded-full text-xs font-bold z-10 shadow-lg border border-white/20">
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
                        <div className="flex items-center gap-4">
                          <DeleteListingButton 
                            listingId={bike.id} 
                            imageUrl={bike.image_url} 
                            endsAt={bike.ends_at} 
                          />
                          <Link href={`/listing/${bike.id}/edit`} className="text-[#ff5a20] text-sm font-bold hover:text-white transition-colors">
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
        )}

      </div>
    </div>
  )
}

// 3. Keep the top-level page completely synchronous
export default function Dashboard({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  return (
    <main className="min-h-screen bg-[#6b2a1a] text-white p-4 md:p-10 font-sans">
      <Suspense fallback={<div className="text-[#ff5a20] animate-pulse text-xl font-bold tracking-widest uppercase">Unlocking Garage...</div>}>
        {/* Pass the Promise directly into the shielded component */}
        <DashboardContent searchParamsPromise={searchParams} />
      </Suspense>
    </main>
  )
}