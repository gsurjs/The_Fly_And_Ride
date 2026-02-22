import Link from 'next/link';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import SignOutButton from './SignOutButton';
import { Suspense } from 'react';
import MobileMenu from './MobileMenu';
import SearchButton from './SearchButton';

// Isolate the dynamic cookie reading into its own async component
// 1. Upgraded to accept an `isMobile` flag for conditional CSS styling
async function NavbarAuth({ isMobile }: { isMobile?: boolean }) {
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

  if (user) {
    return (
      <>
        <SearchButton isMobile={isMobile} />
        <Link 
          href="/create" 
          className={isMobile
            ? "text-white font-extrabold text-2xl uppercase tracking-tight hover:text-[#ff5a20] transition-colors"
            : "text-white text-sm font-bold tracking-wide hover:text-[#ff5a20] transition-colors"
          }
        >
          {isMobile ? "Sell a Motorcycle" : "SELL"}
        </Link>
        
        {isMobile ? <div className="h-px bg-white/10 w-full my-2"></div> : <div className="w-px h-4 bg-white/20 mx-2"></div>}
        
        <Link 
          href="/dashboard" 
          className={isMobile
            ? "text-white font-extrabold text-2xl uppercase tracking-tight hover:text-[#ff5a20] transition-colors"
            : "text-white text-sm font-bold tracking-wide hover:text-[#ff5a20] transition-colors"
          }
        >
          MY GARAGE
        </Link>
        
        {isMobile ? null : <div className="w-px h-4 bg-white/20"></div>}
        
        <div className={isMobile ? "mt-4" : ""}>
           <SignOutButton />
        </div>
      </>
    );
  }

  // Logged out state (Added a Browse link here so buyers can search without logging in)
  return (
    <>
      <SearchButton isMobile={isMobile} />
      <Link 
        href="/login" 
        className={isMobile
          ? "text-white/70 font-bold text-lg uppercase tracking-widest hover:text-white transition-colors"
          : "text-white/70 hover:text-white text-sm font-bold tracking-wide transition-colors"
        }
      >
        SIGN IN
      </Link>
      <Link 
        href="/login" 
        className={isMobile
          ? "text-[#ff5a20] font-extrabold text-2xl uppercase tracking-tight hover:text-[#ff4500] transition-colors"
          : "bg-[#ff5a20] hover:bg-[#ff4500] text-white text-sm font-bold px-5 py-2.5 rounded-full transition-colors"
        }
      >
        REGISTER
      </Link>
    </>
  );
}

// 2. The main Navbar remains a static Server Component with a Suspense boundary
export default function Navbar() {
  return (
    <nav className="w-full bg-black/50 backdrop-blur-md border-b border-white/10 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 md:px-10 h-20 flex items-center justify-between">
        
        {/* Brand Logo */}
        <Link href="/" className="text-2xl font-extrabold text-white tracking-tighter">
          FLY&<span className="text-[#ff5a20]">RIDE</span>
        </Link>

        {/* DESKTOP VIEW: Hidden on mobile */}
        <div className="hidden md:flex items-center gap-6">
          <Suspense fallback={<div className="h-4 w-24 bg-white/10 animate-pulse rounded"></div>}>
            <NavbarAuth />
          </Suspense>
        </div>

        {/* MOBILE VIEW: Hidden on desktop, wraps the server component in the client dropdown */}
        <div className="md:hidden flex items-center">
          <Suspense fallback={
            <button className="text-white p-2">
              {/* Ghost Hamburger icon while loading */}
              <svg className="h-8 w-8 opacity-50 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          }>
            <MobileMenu>
               <NavbarAuth isMobile={true} />
            </MobileMenu>
          </Suspense>
        </div>

      </div>
    </nav>
  );
}