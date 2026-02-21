'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function AuctionCard({ bike }: { bike: any }) {
  const [timeLeft, setTimeLeft] = useState('Calculating...');

  // Pull the actual highest bid from the database array, or default to 0
  const highestBid = bike.bids && bike.bids.length > 0 
    ? Math.max(...bike.bids.map((b: any) => b.amount)) 
    : 0;

  useEffect(() => {
    // If there is no ends_at date, fallback safely
    if (!bike.ends_at) {
      setTimeLeft('TBD');
      return;
    }

    const timer = setInterval(() => {
      const difference = new Date(bike.ends_at).getTime() - new Date().getTime();
      
      if (difference > 0) {
        const days = Math.floor(difference / (1000 * 60 * 60 * 24));
        const hours = Math.floor((difference / (1000 * 60 * 60)) % 24);
        const minutes = Math.floor((difference / 1000 / 60) % 60);
        const seconds = Math.floor((difference / 1000) % 60);
        
        if (days > 0) {
          setTimeLeft(`${days}d ${hours}h`);
        } else {
          setTimeLeft(`${hours}h ${minutes}m ${seconds}s`);
        }
      } else {
        setTimeLeft('Auction Ended');
        clearInterval(timer);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [bike.ends_at]);

  return (
    <Link href={`/listing/${bike.id}`} className="group block h-full">
      <div className="bg-black/40 border border-white/10 rounded-2xl overflow-hidden hover:border-white/30 transition-all duration-300 flex flex-col h-full hover:-translate-y-1 hover:shadow-2xl hover:shadow-black/50">
        
        {/* Image Section*/}
        <div className="h-56 bg-black relative overflow-hidden">
          <img 
            src={bike.image_url || "https://images.unsplash.com/photo-1558981403-c5f9899a28bc?q=80&w=800"} 
            alt={`${bike.make} ${bike.model}`}
            className="object-cover w-full h-full opacity-80 group-hover:scale-105 group-hover:opacity-100 transition-all duration-700"
          />
          <div className="absolute bottom-0 left-0 w-full h-1/2 bg-gradient-to-t from-black/80 to-transparent"></div>
          
          <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold text-white border border-white/10">
            {bike.location}
          </div>
        </div>
        
        {/* Details Section (Your exact code, with timer injected) */}
        <div className="p-5 flex-grow flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-1">
              <p className="text-[#ff5a20] text-xs font-extrabold uppercase tracking-widest">{bike.year}</p>
              <p className="text-white/50 text-xs font-bold uppercase tracking-widest">{bike.mileage.toLocaleString()} mi</p>
            </div>
            <h4 className="text-2xl font-extrabold text-white mb-4 tracking-tight group-hover:text-[#ff5a20] transition-colors">
              {bike.make} {bike.model}
            </h4>
          </div>
          
          <div className="flex justify-between items-end pt-4 border-t border-white/10">
            <div>
              {/* Swapped Title Status for the Live Timer to drive urgency */}
              <p className="text-[10px] text-white/50 uppercase font-bold tracking-wider mb-1">Time Left</p>
              <p className={`text-sm font-semibold tabular-nums ${timeLeft === 'Auction Ended' ? 'text-red-400' : 'text-white'}`}>
                {timeLeft}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-white/50 uppercase font-bold tracking-wider mb-1">Current Bid</p>
              <p className="text-lg font-extrabold text-white">
                ${highestBid.toLocaleString()}
              </p>
            </div>
          </div>
        </div>

      </div>
    </Link>
  );
}