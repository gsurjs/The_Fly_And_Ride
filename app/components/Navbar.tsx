import Link from 'next/link';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import SignOutButton from './SignOutButton';

export default async function Navbar() {
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

  const { data: { user } } = await supabase.auth.getUser();

  return (
    <nav className="w-full bg-black/50 backdrop-blur-md border-b border-white/10 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 md:px-10 h-20 flex items-center justify-between">
        
        {/* Brand Logo */}
        <Link href="/" className="text-2xl font-extrabold text-white tracking-tighter">
          FLY&<span className="text-[#ff5a20]">RIDE</span>
        </Link>

        {/* Dynamic Navigation Links */}
        <div className="flex items-center gap-6">
          {user ? (
            <>

              <Link href="/create" className="text-white text-sm font-bold tracking-wide hover:text-[#ff5a20] transition-colors">
                SELL
              </Link>
              <div className="w-px h-4 bg-white/20 mx-2"></div>
              
              <Link href="/dashboard" className="text-white text-sm font-bold tracking-wide hover:text-[#ff5a20] transition-colors">
                MY GARAGE
              </Link>
              <div className="w-px h-4 bg-white/20"></div> {/* Visual Divider */}
              <SignOutButton />
            </>
          ) : (
            <>
              <Link href="/login" className="text-white/70 hover:text-white text-sm font-bold tracking-wide transition-colors">
                SIGN IN
              </Link>
              <Link href="/login" className="bg-[#ff5a20] hover:bg-[#ff4500] text-white text-sm font-bold px-5 py-2.5 rounded-full transition-colors">
                REGISTER
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}