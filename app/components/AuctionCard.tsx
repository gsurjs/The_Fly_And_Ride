'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function AuctionCard({ bike, type = 'active' }: { bike: any, type?: 'hero' | 'active' | 'past' }) {
  const [timeLeft, setTimeLeft] = useState('Loading...');
  
  // Calculate highest bid from the joined array, default to reserve or 0
  const highestBid = bike.bids && bike.bids.length > 0 
    ? Math.max(...bike.bids.map((b: any) => b.amount)) 
    : 0;

  const isSold = type === 'past' && highestBid >= (bike.reserve_price || 0);
  const reserveNotMet = type === 'past' && highestBid < (bike.reserve_price || 0);

  useEffect(() => {
    if (type === 'past') {
      setTimeLeft('Auction Ended');
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
        setTimeLeft('Ended');
        clearInterval(timer);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [bike.ends_at, type]);

  // If this is the massive Hero banner at the top of the site
  if (type === 'hero') {
    return (
      <Link href={`/listing/${bike.id}`} className="group block relative w-full h-[500px] rounded-3xl overflow-hidden shadow-2xl border border-white/10 bg-black">
        <img src={bike.image_url} alt={bike.model} className="absolute inset-0 w-full h-full object-cover opacity-70 group-hover:opacity-90 group-hover:scale-105 transition-all duration-700" />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-8 md:p-12 flex flex-col md:flex-row justify-between items-end gap-6">
          <div>
            <span className="bg-[#ff5a20] text-white text-xs font-black px-3 py-1 rounded-full uppercase tracking-widest shadow-lg mb-4 inline-block">Featured Auction</span>
            <h2 className="text-4xl md:text-6xl font-extrabold text-white tracking-tight">{bike.year} {bike.make} <span className="text-[#ff5a20]">{bike.model}</span></h2>
            <p className="text-white/70 font-semibold uppercase tracking-widest mt-2">{bike.mileage.toLocaleString()} Miles • {bike.location}</p>
          </div>
          <div className="bg-white/10 backdrop-blur-md border border-white/20 p-6 rounded-2xl flex flex-col items-end min-w-[200px]">
            <p className="text-white/50 text-[10px] uppercase font-bold tracking-widest mb-1">Current Bid</p>
            <p className="text-4xl font-extrabold text-white mb-4">${highestBid.toLocaleString()}</p>
            <p className="text-white/50 text-[10px] uppercase font-bold tracking-widest mb-1">Ends In</p>
            <p className="text-xl font-bold text-[#ff5a20] tabular-nums">{timeLeft}</p>
          </div>
        </div>
      </Link>
    );
  }

  // Standard Grid Card (Active or Past)
  return (
    <Link href={`/listing/${bike.id}`} className="group bg-black/40 border border-white/10 rounded-2xl overflow-hidden hover:border-[#ff5a20]/50 transition-colors flex flex-col relative shadow-xl">
      <div className="h-56 bg-black relative overflow-hidden">
        <img src={bike.image_url} alt={bike.model} className="object-cover w-full h-full opacity-80 group-hover:scale-105 transition-transform duration-500" />
        <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold text-green-400 border border-white/10 shadow-lg">
          {bike.title_status}
        </div>
      </div>
      <div className="p-6 flex-grow flex flex-col justify-between">
        <div>
          <p className="text-white/50 text-xs font-bold uppercase tracking-widest mb-1">{bike.year} • {bike.mileage.toLocaleString()} mi</p>
          <h3 className="text-2xl font-extrabold text-white mb-4">{bike.make} {bike.model}</h3>
        </div>
        <div className="flex justify-between items-end border-t border-white/10 pt-4 mt-2">
          <div>
            <p className="text-[10px] text-white/50 uppercase font-bold tracking-wider mb-1">
              {type === 'past' ? (isSold ? 'Sold For' : 'Highest Bid') : 'Current Bid'}
            </p>
            <p className={`text-xl font-extrabold ${type === 'past' && !isSold ? 'text-red-400' : 'text-white'}`}>
              ${highestBid.toLocaleString()}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-white/50 uppercase font-bold tracking-wider mb-1">
              {type === 'past' ? 'Status' : 'Ends In'}
            </p>
            {type === 'past' ? (
               <p className={`text-sm font-bold uppercase tracking-widest ${isSold ? 'text-green-400' : 'text-red-400'}`}>
                 {isSold ? 'SOLD' : 'Reserve Not Met'}
               </p>
            ) : (
               <p className="text-sm font-bold text-[#ff5a20] tabular-nums">{timeLeft}</p>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}