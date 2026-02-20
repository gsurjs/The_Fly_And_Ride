import { Suspense } from 'react';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import AdminActionButtons from '../components/AdminActionButtons';

async function AdminDashboardContent() {
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

  // 1. Verify Authentication
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login');
  }

  // 2. The Fortress Check: Verify Admin Role
  const { data: roleData } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .single();

  if (!roleData || roleData.role !== 'admin') {
    // If they aren't an admin, silently bounce them back to their personal garage
    redirect('/dashboard');
  }

  // 3. Fetch the Moderation Queue (Flagged Comments)
  const { data: flaggedComments } = await supabase
    .from('comment_flags')
    .select(`
      comment_id,
      reason,
      created_at,
      comments (
        content,
        listing_id,
        user_id
      )
    `)
    .order('created_at', { ascending: false });

  // 4. Fetch High-Level Platform Stats
  const [
    { count: totalListings },
    { count: totalUsers }
  ] = await Promise.all([
    supabase.from('listings').select('*', { count: 'exact', head: true }),
    supabase.from('profiles').select('*', { count: 'exact', head: true })
  ]);

  return (
    <div className="w-full max-w-7xl mx-auto flex flex-col gap-8">
      
      {/* Header */}
      <div>
        <h1 className="text-4xl font-extrabold text-white tracking-tight mb-2">Admin Command Center</h1>
        <p className="text-[#ff5a20] font-bold tracking-widest uppercase text-sm">
          Authorized Access Only: {user.email}
        </p>
      </div>

      {/* Platform Stats Grid */}
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

      {/* Moderation Queue */}
      <div className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden shadow-2xl mt-4">
        <div className="px-8 py-6 border-b border-white/10 bg-black/40">
          <h2 className="text-2xl font-extrabold text-white tracking-tight">Moderation Queue</h2>
          <p className="text-white/50 text-sm font-semibold mt-1">Review flagged community comments.</p>
        </div>
        
        <div className="p-8">
          {!flaggedComments || flaggedComments.length === 0 ? (
            <div className="text-center py-10 text-white/40 font-bold tracking-wide">
              Queue is clear. The community is behaving.
            </div>
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
                    
                    {/* The Interactive Client Component Buttons */}
                    <AdminActionButtons commentId={flag.comment_id} />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AdminDashboardPage() {
  return (
    <main className="min-h-screen bg-[#6b2a1a] p-4 md:p-10 font-sans flex justify-center">
      <Suspense fallback={<div className="w-full max-w-7xl mt-10 text-center text-white font-bold tracking-widest uppercase animate-pulse">Verifying Security Clearance...</div>}>
        <AdminDashboardContent />
      </Suspense>
    </main>
  );
}