import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic';

export default async function Dashboard() {
  // 1. We must 'await' the cookies in modern Next.js
  const cookieStore = await cookies()
  
  // 2. Use the new getAll/setAll pattern required by @supabase/ssr
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          } catch {
            // The setAll method was called from a Server Component.
            // This can be safely ignored as middleware handles the session refresh.
          }
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Fetch their profile data securely from the server
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return (
    <main className="min-h-screen bg-black text-white p-10">
      <h1 className="text-4xl font-bold mb-2">Welcome to your Garage</h1>
      <p className="text-white/50 mb-8">Logged in as: {profile?.username || user.email}</p>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white/5 border border-white/10 p-6 rounded-2xl">
          <h2 className="text-xl font-bold mb-2">Active Bids</h2>
          <p className="text-3xl font-extrabold text-[#ff5a20]">0</p>
        </div>
        <div className="bg-white/5 border border-white/10 p-6 rounded-2xl">
          <h2 className="text-xl font-bold mb-2">Watchlist</h2>
          <p className="text-3xl font-extrabold text-white">0</p>
        </div>
        <div className="bg-white/5 border border-white/10 p-6 rounded-2xl">
          <h2 className="text-xl font-bold mb-2">Your Listings</h2>
          <p className="text-3xl font-extrabold text-white">0</p>
        </div>
      </div>
    </main>
  )
}