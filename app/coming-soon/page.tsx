import Link from 'next/link';

export default function ComingSoonPage() {
  return (
    <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center text-center px-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-neutral-800 via-neutral-950 to-neutral-950 -z-10 opacity-50"></div>

      <div className="max-w-2xl space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-1000">
        <h1 className="text-5xl md:text-7xl font-extrabold text-white tracking-tight">
          The Fly and Ride
        </h1>
        
        <p className="text-xl md:text-2xl text-neutral-400 font-light">
          The premier motorcycle auction experience is currently gearing up.
        </p>

        <div className="pt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
          <p className="text-sm text-neutral-500 font-mono uppercase tracking-widest">
            Launch sequence initiated
          </p>
        </div>
      </div>

      {/* Admin Login Doorway */}
      <div className="absolute bottom-8 w-full text-center">
        <Link 
          href="/login" 
          className="text-xs text-neutral-700 hover:text-neutral-400 transition-colors duration-200 uppercase tracking-widest"
        >
          Admin Portal
        </Link>
      </div>
    </div>
  );
}