'use client';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';

export default function SignOutButton() {
  const router = useRouter();
  
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    // Force the router to refresh the server components so the Navbar updates instantly
    router.push('/');
    router.refresh(); 
  };

  return (
    <button 
      onClick={handleSignOut} 
      className="text-white/50 hover:text-[#ff5a20] text-xs font-bold tracking-widest uppercase transition-colors"
    >
      Sign Out
    </button>
  );
}