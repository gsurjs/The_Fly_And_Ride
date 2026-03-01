'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import LiveTimer from './LiveTimer';

export default function FeaturedCarousel({ listings }: { listings: any[] }) {
  const [currentIndex, setCurrentIndex] = useState(0);

  // Auto-advance the slideshow every 5 seconds
  useEffect(() => {
    if (listings.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentIndex((current) => (current + 1) % listings.length);
    }, 5000); 
    return () => clearInterval(timer);
  }, [listings.length]);

  const goToPrevious = () => {
    setCurrentIndex((current) => (current === 0 ? listings.length - 1 : current - 1));
  };

  const goToNext = () => {
    setCurrentIndex((current) => (current + 1) % listings.length);
  };

  if (!listings || listings.length === 0) return null;

  return (
    <div className="relative w-full h-[450px] sm:h-[500px] lg:h-[600px] rounded-3xl overflow-hidden shadow-2xl group border border-white/10">
      
      {/* THE SLIDES */}
      {listings.map((bike, index) => {
        const isActive = index === currentIndex;
        
        const highestBid = bike.bids && bike.bids.length > 0 
          ? Math.max(...bike.bids.map((b: any) => b.amount)) 
          : 0;

        return (
          <div 
            key={bike.id} 
            className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${isActive ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}
          >
            <img 
              src={bike.image_url || "https://images.unsplash.com/photo-1558981403-c5f9899a28bc?q=80&w=800"} 
              alt={`${bike.make} ${bike.model}`} 
              className="w-full h-full object-cover"
            />
            
            {/* Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-black/10 md:to-transparent md:via-black/20 md:from-black/95"></div>

            {/* Badges - Top Left */}
            <div className="absolute top-6 left-6 md:top-8 md:left-8 flex flex-wrap gap-3">
              <div className={`backdrop-blur-md px-4 py-1.5 rounded-full text-xs font-black tracking-widest uppercase shadow-lg border ${!bike.reserve_price || bike.reserve_price === 0 ? 'bg-green-500/90 text-white border-green-400/50' : 'bg-black/60 text-white/80 border-white/20'}`}>
                {!bike.reserve_price || bike.reserve_price === 0 ? 'No Reserve' : 'Reserve'}
              </div>
              <div className={`backdrop-blur-md px-4 py-1.5 rounded-full text-xs font-black tracking-widest uppercase shadow-lg border ${bike.title_status === 'Clean' ? 'bg-black/60 text-green-400 border-green-400/20' : 'bg-black/60 text-yellow-400 border-yellow-400/20'}`}>
                {bike.title_status} Title
              </div>
            </div>

            {/* Main Content Info - Locked to Left Side */}
            <div className="absolute bottom-6 left-6 right-6 md:bottom-12 md:left-12 flex flex-col md:flex-row md:items-end justify-between gap-6 pointer-events-none">
              <div className="flex-1 pointer-events-auto">
                <p className="text-[#ff5a20] text-lg md:text-xl font-extrabold uppercase tracking-widest mb-1 shadow-black drop-shadow-md">
                  {bike.year}
                </p>
                <h2 className="text-4xl md:text-5xl lg:text-7xl font-black text-white tracking-tighter drop-shadow-2xl mb-6 line-clamp-2 leading-tight">
                  {bike.make} {bike.model}
                </h2>
                
                <div className="flex flex-wrap items-center gap-6 md:gap-10">
                  <div>
                    <p className="text-[10px] md:text-xs text-white/70 uppercase font-bold tracking-wider mb-1">Ends In</p>
                    <div className="text-xl md:text-3xl font-bold text-white tabular-nums drop-shadow-md">
                      <LiveTimer endsAt={bike.ends_at} />
                    </div>
                  </div>
                  <div className="w-px h-10 bg-white/20 hidden md:block"></div>
                  <div>
                    <p className="text-[10px] md:text-xs text-white/70 uppercase font-bold tracking-wider mb-1">Current Bid</p>
                    <p className="text-xl md:text-3xl font-black text-[#ff5a20] drop-shadow-md">
                      ${highestBid.toLocaleString()}
                    </p>
                  </div>
                  
                  {/* View Action (Moved next to stats) */}
                  <Link href={`/listing/${bike.id}`} className="mt-2 md:mt-0 bg-[#ff5a20] hover:bg-[#ff4500] text-white font-extrabold py-3 px-8 rounded-2xl shadow-xl shadow-orange-900/50 transition-all hover:-translate-y-1 text-center uppercase tracking-widest flex-shrink-0 border border-[#ff5a20]/50 text-sm">
                    View Auction
                  </Link>
                </div>
              </div>
            </div>
          </div>
        );
      })}

      {/* NAVIGATION CONTROLS (Only show if multiple featured bikes) */}
      {listings.length > 1 && (
        <>
          {/* Pagination Dots (Moved to Top Right for a cleaner UI) */}
          <div className="absolute top-8 right-8 z-20 hidden md:flex gap-2">
            {listings.map((_, idx) => (
              <button 
                key={idx} 
                onClick={() => setCurrentIndex(idx)}
                className={`h-2 rounded-full transition-all duration-500 shadow-lg ${idx === currentIndex ? 'bg-[#ff5a20] w-8' : 'bg-white/50 hover:bg-white w-2'}`}
              />
            ))}
          </div>

          {/* Left/Right Arrows (Bottom Right Corner) */}
          <div className="absolute bottom-6 right-6 md:bottom-12 md:right-12 z-30 flex gap-3">
            <button onClick={goToPrevious} className="bg-white/10 hover:bg-[#ff5a20] text-white p-3 md:p-4 rounded-full backdrop-blur-md border border-white/20 transition-all duration-300 hover:scale-110 shadow-xl">
              <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <button onClick={goToNext} className="bg-white/10 hover:bg-[#ff5a20] text-white p-3 md:p-4 rounded-full backdrop-blur-md border border-white/20 transition-all duration-300 hover:scale-110 shadow-xl">
              <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>
        </>
      )}
    </div>
  );
}