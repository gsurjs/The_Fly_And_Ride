import Link from 'next/link';

export default function ComingSoonPage() {
  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden bg-neutral-950 text-white">
      
      {/* Background Image with Dark Overlays */}
      <div className="absolute inset-0 z-0">
        <img
          src="https://images.unsplash.com/photo-1558981403-c5f9899a28bc?q=80&w=2070&auto=format&fit=crop"
          alt="Sleek street bike in the dark"
          className="object-cover w-full h-full opacity-50"
        />
        {/* Gradients to ensure text readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/70 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-neutral-950/90 via-neutral-950/40 to-neutral-950/90" />
      </div>

      {/* Main Content Area */}
      <div className="relative z-10 flex flex-col items-center text-center px-6 max-w-4xl mx-auto w-full mt-12 animate-in fade-in zoom-in-95 duration-1000">
        
        {/* Brand Name */}
        <div className="mb-6">
          <h1 className="text-6xl md:text-8xl font-black tracking-tighter uppercase italic text-transparent bg-clip-text bg-gradient-to-br from-white via-neutral-200 to-neutral-500 drop-shadow-xl pr-2 md:pr-4">
            The Fly <br className="md:hidden" /> & Ride
          </h1>
        </div>

        {/* Accent Line */}
        <div className="h-1 w-24 bg-gradient-to-r from-transparent via-red-600 to-transparent mb-8 opacity-80" />

        <h2 className="text-2xl md:text-3xl font-light text-neutral-300 mb-6 uppercase tracking-[0.3em]">
          In The Garage
        </h2>
        
        <p className="text-base md:text-xl text-neutral-400 max-w-2xl font-light leading-relaxed mb-12">
          The premier destination for buying and selling exceptional motorcycles is currently tuning up.
        </p>

        {/* Admin Login Portal */}
        <div className="mt-12 md:mt-24">
          <Link 
            href="/login" 
            className="group flex items-center gap-3 text-xs md:text-sm text-neutral-400 hover:text-white transition-all duration-300 uppercase tracking-[0.2em] font-medium border border-neutral-800 hover:border-neutral-500 px-8 py-4 rounded-full bg-black/40 backdrop-blur-md"
          >
            <span>Admin Access</span>
            <svg 
              className="w-4 h-4 group-hover:translate-x-1 group-hover:text-red-500 transition-all" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </Link>
        </div>
      </div>

      {/* Subtle bottom decorative accent */}
      <div className="absolute bottom-0 w-full h-1 bg-gradient-to-r from-transparent via-red-600/50 to-transparent z-10" />
    </div>
  );
}