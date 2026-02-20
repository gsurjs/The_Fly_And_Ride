import { Suspense } from 'react'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

// 1. Isolate the secure data fetching into its own async component
async function DashboardContent() {
  const cookieStore = await cookies()
  
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll() {
          // Ignored in server components
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return (
    <div className="w-full">
      <h1 className="text-4xl font-bold mb-2">Welcome to your Garage</h1>
      <p className="text-white/50 mb-8">Logged in as: <span className="text-white font-bold">{profile?.username || user.email}</span></p>
      
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
    </div>
  )
}

// 2. Wrap it in a Suspense boundary for the default page export
export default function Dashboard() {
  return (
    <main className="min-h-screen bg-black text-white p-10 font-sans">
      <Suspense fallback={<div className="text-white/50 animate-pulse text-xl font-bold tracking-widest uppercase">Unlocking Garage...</div>}>
        <DashboardContent />
      </Suspense>
    </main>
  )
}