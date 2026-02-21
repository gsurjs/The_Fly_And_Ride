import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import AuctionCard from '../../components/AuctionCard'

export default async function PublicUserProfile({ params }: { params: Promise<{ id: string }> }) {
  // Next.js 15 requires awaiting the dynamic route params
  const resolvedParams = await params;
  const userId = resolvedParams.id;

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

  // 1. Fetch the User's Public Profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('username, created_at, is_banned')
    .eq('id', userId)
    .single();

  if (!profile) {
    notFound(); // Triggers the Next.js 404 page if the user doesn't exist
  }

  // 2. Fetch all their listings with bid data
  const { data: userListings } = await supabase
    .from('listings')
    .select('*, bids(amount)')
    .eq('seller_id', userId)
    .order('created_at', { ascending: false });

  // 3. Separate them into Active and Past
  const now = new Date().getTime();
  
  const activeListings = userListings?.filter(
    (bike) => new Date(bike.ends_at).getTime() > now
  ) || [];
  
  const pastListings = userListings?.filter(
    (bike) => new Date(bike.ends_at).getTime() <= now
  ) || [];

  return (
    <main className="min-h-screen bg-[#6b2a1a] p-4 md:p-10 font-sans flex justify-center pb-20">
      <div className="w-full max-w-6xl">
        
        {/* Profile Header */}
        <div className="bg-black/40 border border-white/10 rounded-3xl p-8 md:p-12 mb-10 shadow-2xl backdrop-blur-sm flex flex-col md:flex-row items-start md:items-center gap-6">
          <div className="h-24 w-24 bg-gradient-to-br from-[#ff5a20] to-orange-800 rounded-full flex items-center justify-center text-4xl font-black text-white shadow-lg border-4 border-black">
            {profile.username ? profile.username.charAt(0).toUpperCase() : '?'}
          </div>
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-4xl font-extrabold text-white tracking-tight">
                {profile.username || 'Anonymous Rider'}
              </h1>
              {profile.is_banned && (
                <span className="bg-red-500 text-white text-[10px] font-black px-2 py-1 rounded uppercase tracking-widest shadow-md">
                  Banned
                </span>
              )}
            </div>
            <p className="text-white/50 font-bold uppercase tracking-widest text-sm">
              Member Since • {new Date(profile.created_at).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
            </p>
          </div>
        </div>

        {/* Active Listings Section */}
        {activeListings.length > 0 && (
          <div className="mb-16">
            <h2 className="text-2xl font-extrabold text-white tracking-tight mb-6 border-b border-white/10 pb-4">
              Current Auctions
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {activeListings.map(bike => (
                <AuctionCard key={bike.id} bike={bike} />
              ))}
            </div>
          </div>
        )}

        {/* Past History Section */}
        {pastListings.length > 0 && (
          <div>
            <h2 className="text-2xl font-extrabold text-white tracking-tight mb-6 border-b border-white/10 pb-4">
              Auction History
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 opacity-90">
              {pastListings.map(bike => (
                <AuctionCard key={bike.id} bike={bike} />
              ))}
            </div>
          </div>
        )}

        {/* Empty State Fallback */}
        {activeListings.length === 0 && pastListings.length === 0 && (
          <div className="text-center py-20 bg-white/5 border border-white/10 rounded-3xl">
            <p className="text-white/40 font-bold tracking-widest uppercase">
              This user has no auction history.
            </p>
          </div>
        )}

      </div>
    </main>
  );
}