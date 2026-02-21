import { Suspense } from 'react';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import AdminActionButtons from '../components/AdminActionButtons';
import AdminCancelButton from '../components/AdminCancelButton';
import AdminBanButton from '../components/AdminBanButton';

async function AdminDashboardContent() {
  const cookieStore = await cookies();
  
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll() { },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: roleData } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .single();

  if (!roleData || roleData.role !== 'admin') redirect('/dashboard');

  // Fetch the Moderation Queue
  const { data: flaggedComments } = await supabase
    .from('comment_flags')
    .select(`
      comment_id,
      reason,
      created_at,
      comments ( content, listing_id, user_id )
    `)
    .order('created_at', { ascending: false });

  // Fetch Active Listings Oversight (Top 5 most recent)
  const { data: activeListings } = await supabase
    .from('listings')
    .select('id, make, model, year, title_status, ends_at')
    .gt('ends_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(5);

  // Fetch User Roster (Top 5 newest users)
  const { data: recentUsers } = await supabase
    .from('profiles')
    .select('id, username, is_banned, created_at')
    .order('created_at', { ascending: false })
    .limit(5);

  // Fetch High-Level Stats
  const [ { count: totalListings }, { count: totalUsers } ] = await Promise.all([
    supabase.from('listings').select('*', { count: 'exact', head: true }),
    supabase.from('profiles').select('*', { count: 'exact', head: true })
  ]);

  return (
    <div className="w-full max-w-7xl mx-auto flex flex-col gap-10">
      
      {/* Header & Stats */}
      <div>
        <h1 className="text-4xl font-extrabold text-white tracking-tight mb-2">Admin Command Center</h1>
        <p className="text-[#ff5a20] font-bold tracking-widest uppercase text-sm mb-6">
          Authorized Access Only: {user.email}
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white/5 border border-white/10 p-6 rounded-2xl">
            <h2 className="text-sm font-bold text-white/50 uppercase tracking-widest mb-2">Active Listings</h2>
            <p className="text-4xl font-extrabold text-white">{totalListings || 0}</p>
          </div>
          <div className="bg-white/5 border border-white/10 p-6 rounded-2xl">
            <h2 className="text-sm font-bold text-white/50 uppercase tracking-widest mb-2">Registered Users</h2>
            <p className="text-4xl font-extrabold text-white">{totalUsers || 0}</p>
          </div>
          <div className="bg-red-500/10 border border-red-500/30 p-6 rounded-2xl">
            <h2 className="text-sm font-bold text-red-400 uppercase tracking-widest mb-2">Pending Flags</h2>
            <p className="text-4xl font-extrabold text-red-400">{flaggedComments?.length || 0}</p>
          </div>
        </div>
      </div>

      {/* 1. Moderation Queue (RESTORED TO FULL DETAIL) */}
      <div className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
        <div className="px-8 py-6 border-b border-white/10 bg-black/40">
          <h2 className="text-2xl font-extrabold text-white tracking-tight">Moderation Queue</h2>
        </div>
        <div className="p-8">
          {!flaggedComments || flaggedComments.length === 0 ? (
            <div className="text-center py-10 text-white/40 font-bold tracking-wide">Queue is clear.</div>
          ) : (
            <div className="flex flex-col gap-4">
              {flaggedComments.map((flag: any, idx: number) => {
                const comment = flag.comments;
                if (!comment) return null;
                return (
                  <div key={`${flag.comment_id}-${idx}`} className="bg-black/50 border border-white/10 rounded-2xl p-6 flex flex-col md:flex-row justify-between items-start gap-6">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <span className="bg-red-500 text-white text-[10px] font-extrabold px-2 py-0.5 rounded uppercase tracking-widest">
                          FLAGGED
                        </span>
                        <span className="text-red-400 text-xs font-bold uppercase tracking-wider">
                          Reason: {flag.reason || 'No reason provided'}
                        </span>
                      </div>
                      <p className="text-white/80 font-medium mb-4 italic border-l-2 border-white/20 pl-4 py-1">
                        "{comment.content}"
                      </p>
                      <Link href={`/listing/${comment.listing_id}`} target="_blank" className="text-white/50 hover:text-white text-xs font-bold transition-colors uppercase tracking-widest">
                        View Auction →
                      </Link>
                    </div>
                    <AdminActionButtons commentId={flag.comment_id} />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        
        {/* 2. Active Auctions Oversight */}
        <div className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
          <div className="px-8 py-6 border-b border-white/10 bg-black/40">
            <h2 className="text-xl font-extrabold text-white tracking-tight">Live Auctions Oversight</h2>
          </div>
          <div className="p-6">
            <div className="flex flex-col gap-3">
              {activeListings?.map(bike => (
                <div key={bike.id} className="bg-black/50 border border-white/10 rounded-xl p-4 flex justify-between items-center">
                  <div>
                    <p className="text-white font-bold">{bike.year} {bike.make} {bike.model}</p>
                    <p className="text-white/50 text-xs uppercase tracking-wider font-semibold mt-1">Title: {bike.title_status}</p>
                  </div>
                  <div className="flex gap-2">
                    <Link href={`/listing/${bike.id}`} target="_blank" className="bg-white/10 hover:bg-white/20 text-white text-xs font-bold px-3 py-2 rounded-lg transition-colors">
                      VIEW
                    </Link>
                    <AdminCancelButton listingId={bike.id} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 3. User Roster */}
        <div className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
          <div className="px-8 py-6 border-b border-white/10 bg-black/40">
            <h2 className="text-xl font-extrabold text-white tracking-tight">Recent User Roster</h2>
          </div>
          <div className="p-6">
            <div className="flex flex-col gap-3">
              {recentUsers?.map(user => (
                <div key={user.id} className="bg-black/50 border border-white/10 rounded-xl p-4 flex justify-between items-center">
                  <div>
                    <p className="text-white font-bold flex items-center gap-2">
                      {user.username} 
                      {user.is_banned && <span className="bg-red-500 text-white text-[9px] px-1.5 py-0.5 rounded uppercase font-black">BANNED</span>}
                    </p>
                    <p className="text-white/50 text-xs font-semibold mt-1">Joined: {new Date(user.created_at).toLocaleDateString()}</p>
                  </div>
                  <AdminBanButton userId={user.id} isBanned={user.is_banned} />
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

export default function AdminDashboardPage() {
  return (
    <main className="min-h-screen bg-[#6b2a1a] p-4 md:p-10 font-sans flex justify-center pb-20">
      <Suspense fallback={<div className="w-full max-w-7xl mt-10 text-center text-white font-bold tracking-widest uppercase animate-pulse">Verifying Security Clearance...</div>}>
        <AdminDashboardContent />
      </Suspense>
    </main>
  );
}