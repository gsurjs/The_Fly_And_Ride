import Link from 'next/link';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export default async function SellerBadge({ sellerId }: { sellerId: string }) {
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

  // 1. Fetch the seller's profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('username, avatar_url, location')
    .eq('id', sellerId)
    .single();

  if (!profile) return null;

  // 2. Fetch their reviews to calculate their aggregate rating
  const { data: reviews } = await supabase
    .from('reviews')
    .select('rating')
    .eq('reviewee_id', sellerId);

  const totalReviews = reviews?.length || 0;
  const averageRating = totalReviews > 0 
    ? reviews!.reduce((acc, curr) => acc + curr.rating, 0) / totalReviews 
    : 0;
  const fullStars = Math.floor(averageRating);
  const hasHalfStar = averageRating % 1 >= 0.5;

  return (
    <div className="w-full max-w-6xl bg-white/5 border border-white/10 rounded-3xl p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6 backdrop-blur-sm relative overflow-hidden">
      
      {/* Decorative background glow */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-[#ff5a20]/10 rounded-full blur-3xl -z-10 pointer-events-none translate-x-1/2 -translate-y-1/2"></div>

      {/* HORIZONTAL ON MOBILE: Avatar + Text */}
      <div className="flex flex-row items-center gap-4 md:gap-6 w-full md:w-auto text-left">
        {/* Avatar */}
        <Link href={`/user/${sellerId}`} className="relative h-16 w-16 md:h-20 md:w-20 rounded-full overflow-hidden border-2 border-[#ff5a20] shadow-lg group flex-shrink-0 bg-black block">
          {profile.avatar_url ? (
            <img src={profile.avatar_url} alt={profile.username} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-[#ff5a20] to-orange-800 flex items-center justify-center text-2xl md:text-3xl font-black text-white group-hover:scale-110 transition-transform duration-300">
              {profile.username ? profile.username.charAt(0).toUpperCase() : '?'}
            </div>
          )}
        </Link>

        {/* Seller Details */}
        <div>
          <p className="text-white/50 text-[10px] font-bold uppercase tracking-widest mb-1">Listed By</p>
          <Link href={`/user/${sellerId}`} className="text-2xl font-extrabold text-white hover:text-[#ff5a20] transition-colors tracking-tight block mb-1">
            {profile.username || 'Anonymous Seller'}
          </Link>
          
          <div className="flex flex-wrap items-center justify-center md:justify-start gap-4">
            {/* Rating Stars */}
            <div className="flex items-center gap-2">
              <div className="flex text-[#ff5a20]">
                {[...Array(5)].map((_, i) => (
                  <svg key={i} className={`w-4 h-4 ${i < fullStars ? 'fill-current' : i === fullStars && hasHalfStar ? 'fill-current opacity-50' : 'text-white/20 fill-current'}`} viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
              <span className="text-white/70 text-xs font-bold">
                {totalReviews > 0 ? `${averageRating.toFixed(1)} (${totalReviews})` : 'No Reviews'}
              </span>
            </div>

            {/* Location */}
            {profile.location && (
              <span className="text-white/50 text-xs font-bold uppercase tracking-widest flex items-center gap-1">
                <span className="text-[#ff5a20]">📍</span> {profile.location}
              </span>
            )}
          </div>
        </div>
      </div>

      <Link href={`/user/${sellerId}`} className="bg-white/10 hover:bg-white/20 text-white font-bold py-3 px-6 rounded-xl transition-colors text-sm tracking-wide whitespace-nowrap shadow-md">
        View Full Profile
      </Link>

    </div>
  );
}