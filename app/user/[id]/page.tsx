import { Suspense } from 'react';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import AuctionCard from '../../components/AuctionCard';
import Link from 'next/link';

// Helper component to render stars
function StarRating({ rating, total }: { rating: number, total: number }) {
  const fullStars = Math.floor(rating);
  const hasHalfStar = rating % 1 >= 0.5;
  
  return (
    <div className="flex items-center gap-2">
      <div className="flex text-[#ff5a20]">
        {[...Array(5)].map((_, i) => (
          <svg key={i} className={`w-5 h-5 ${i < fullStars ? 'fill-current' : i === fullStars && hasHalfStar ? 'fill-current opacity-50' : 'text-white/20 fill-current'}`} viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        ))}
      </div>
      <span className="text-white/70 text-sm font-bold">
        {rating > 0 ? `${rating.toFixed(1)} (${total} Reviews)` : 'No Reviews Yet'}
      </span>
    </div>
  );
}

// 1. The inner component that safely handles the dynamic data
async function UserProfileContent({ paramsPromise }: { paramsPromise: Promise<{ id: string }> }) {
  // Await the dynamic URL parameters safely INSIDE the Suspense boundary
  const resolvedParams = await paramsPromise;
  const userId = resolvedParams.id;

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

  // Fetch the User's Public Profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (!profile) {
    notFound(); 
  }

  // Fetch Reviews and calculate aggregate rating
  const { data: reviews } = await supabase
    .from('reviews')
    .select('rating, comment, created_at')
    .eq('reviewee_id', userId)
    .order('created_at', { ascending: false });

  const totalReviews = reviews?.length || 0;
  const averageRating = totalReviews > 0 
    ? reviews!.reduce((acc, curr) => acc + curr.rating, 0) / totalReviews 
    : 0;

  // Fetch all their listings with bid data
  const { data: userListings } = await supabase
    .from('listings')
    .select('*, bids(amount)')
    .eq('seller_id', userId)
    .order('created_at', { ascending: false });

  // Separate them into Active and Past
  const now = new Date().getTime();
  
  const activeListings = userListings?.filter(
    (bike) => new Date(bike.ends_at).getTime() > now
  ) || [];
  
  const pastListings = userListings?.filter(
    (bike) => new Date(bike.ends_at).getTime() <= now
  ) || [];

  return (
    <div className="w-full max-w-6xl">
      
      {/* PREMIUM PROFILE HEADER */}
      <div className="bg-black/40 border border-white/10 rounded-3xl overflow-hidden mb-10 shadow-2xl backdrop-blur-sm relative mt-16">
        
        {/* Decorative Background Banner */}
        <div className="h-32 w-full bg-gradient-to-r from-black via-[#6b2a1a] to-[#ff5a20]/40"></div>

        <div className="px-8 pb-8 md:px-12 md:pb-12 relative z-10 flex flex-col md:flex-row items-center md:items-start gap-8">
          
          {/* Avatar: -mt-16 (64px) is exactly half of the h-32 (128px) banner, creating a perfect overlap */}
          <div className="h-32 w-32 md:h-40 md:w-40 bg-black rounded-full flex-shrink-0 border-4 border-[#ff5a20] shadow-2xl overflow-hidden -mt-16 md:-mt-20 relative z-20 mx-auto md:mx-0">
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt={profile.username} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-[#ff5a20] to-orange-800 flex items-center justify-center text-6xl font-black text-white">
                {profile.username ? profile.username.charAt(0).toUpperCase() : '?'}
              </div>
            )}
          </div>

          {/* User Details */}
          <div className="flex-1 text-center md:text-left w-full">
            <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4 mb-4">
              <div>
                <div className="flex items-center justify-center md:justify-start gap-3 mb-1">
                  <h1 className="text-4xl font-extrabold text-white tracking-tight">
                    {profile.username || 'Anonymous Rider'}
                  </h1>
                  {profile.is_banned && (
                    <span className="bg-red-500 text-white text-[10px] font-black px-2 py-1 rounded uppercase tracking-widest shadow-md">Banned</span>
                  )}
                </div>
                
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-x-4 gap-y-2 text-sm font-bold uppercase tracking-widest text-white/50 mt-2">
                  <span>Joined {new Date(profile.created_at).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}</span>
                  {profile.location && (
                    <span className="flex items-center gap-1">
                      <span className="text-[#ff5a20]">📍</span> {profile.location}
                    </span>
                  )}
                  {profile.social_link && (
                    <a href={profile.social_link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[#ff5a20] hover:text-white transition-colors">
                      <span>🔗</span> Social Link
                    </a>
                  )}
                </div>
              </div>

              {/* Trust & Reputation Box */}
              <div className="bg-white/5 border border-white/10 rounded-xl p-4 inline-block text-left">
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/50 mb-1">Seller Reputation</p>
                <StarRating rating={averageRating} total={totalReviews} />
              </div>
            </div>

            {/* Bio Section */}
            {profile.bio && (
              <div className="mt-6 bg-black/50 p-6 rounded-2xl border border-white/5">
                <p className="text-white/80 leading-relaxed text-sm">
                  {profile.bio}
                </p>
              </div>
            )}
          </div>
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

      {/* REVIEWS SHOWCASE */}
      {reviews && reviews.length > 0 && (
        <div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight mb-6 border-b border-white/10 pb-4">
            Buyer Feedback
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {reviews.map((review: any, idx: number) => (
              <div key={idx} className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
                <div className="flex justify-between items-start mb-3">
                  <StarRating rating={review.rating} total={0} />
                  <span className="text-white/40 text-[10px] font-bold uppercase tracking-widest">
                    {new Date(review.created_at).toLocaleDateString()}
                  </span>
                </div>
                {review.comment && (
                  <p className="text-white/80 text-sm italic">"{review.comment}"</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* EMPTY STATE */}
      {activeListings.length === 0 && pastListings.length === 0 && (
        <div className="text-center py-20 bg-white/5 border border-white/10 rounded-3xl">
          <p className="text-white/40 font-bold tracking-widest uppercase">
            This user has no auction history.
          </p>
        </div>
      )}

    </div>
  );
}

// 2. The synchronous top-level page
export default function PublicUserProfile({ params }: { params: Promise<{ id: string }> }) {
  return (
    <main className="min-h-screen bg-[#6b2a1a] p-4 md:p-10 font-sans flex justify-center pb-20">
      <Suspense fallback={<div className="text-[#ff5a20] animate-pulse text-xl font-bold tracking-widest uppercase mt-20">Loading Profile...</div>}>
        {/* Pass the Promise directly into the shielded component */}
        <UserProfileContent paramsPromise={params} />
      </Suspense>
    </main>
  );
}