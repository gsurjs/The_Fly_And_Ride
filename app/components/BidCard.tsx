'use client'; 
import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { BarChart, Bar, ResponsiveContainer, Tooltip, Cell } from 'recharts';

// 1. Upgrade to the SSR-compatible browser client to read secure cookies
const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function BidCard({ listing }: { listing: any }) {
  const [timeLeft, setTimeLeft] = useState('Calculating...');
  const [currentBid, setCurrentBid] = useState(listing.reserve_price || 0);
  const [isBidding, setIsBidding] = useState(false);
  
  // Watchlist State
  const [isWatchlisted, setIsWatchlisted] = useState(false);
  const [isWatchlistLoading, setIsWatchlistLoading] = useState(false);

  // Dummy market data for the chart
  const marketData = [
    { month: 'Aug', price: 19500 }, { month: 'Sep', price: 21000 }, 
    { month: 'Oct', price: 20500 }, { month: 'Nov', price: 22500 },
    { month: 'Dec', price: 23000 }, { month: 'Jan', price: 24500 },
    { month: 'Feb', price: 24000 }
  ];

  useEffect(() => {
    // Check initial Watchlist state if a user is logged in
    const checkWatchlistStatus = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from('watchlist')
          .select('id')
          .eq('user_id', user.id)
          .eq('listing_id', listing.id)
          .single();
        
        if (data) setIsWatchlisted(true);
      }
    };
    
    checkWatchlistStatus();

    // The Countdown Timer
    const timer = setInterval(() => {
      const difference = new Date(listing.ends_at).getTime() - new Date().getTime();
      if (difference > 0) {
        const hours = Math.floor((difference / (1000 * 60 * 60)) % 24);
        const minutes = Math.floor((difference / 1000 / 60) % 60);
        const seconds = Math.floor((difference / 1000) % 60);
        setTimeLeft(`${hours}h ${minutes}m ${seconds}s`);
      } else {
        setTimeLeft('Auction Ended');
        clearInterval(timer);
      }
    }, 1000);

    // The WebSocket Listener for Live Bids
    const channel = supabase
      .channel('live-bids')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'bids', filter: `listing_id=eq.${listing.id}` },
        (payload) => setCurrentBid(payload.new.amount)
      )
      .subscribe();

    return () => {
      clearInterval(timer);
      supabase.removeChannel(channel);
    };
  }, [listing.ends_at, listing.id]);

  const handlePlaceBid = async () => {
    setIsBidding(true);
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      alert("You must be logged in to place a bid.");
      window.location.href = '/login';
      return;
    }

    const newBidAmount = currentBid + 250; 
    const { error } = await supabase
      .from('bids')
      .insert([{ listing_id: listing.id, amount: newBidAmount, bidder_id: user.id }]);

    if (error) {
      console.error("Database rejected transaction:", error.message);
      alert("Failed to place bid. Ensure you aren't bidding on your own listing.");
    }
    setIsBidding(false);
  };

  // 2. The Watchlist Action
  const toggleWatchlist = async () => {
    setIsWatchlistLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      alert("Create an account to save vehicles to your Garage.");
      window.location.href = '/login';
      return;
    }

    if (isWatchlisted) {
      // Remove from database
      await supabase
        .from('watchlist')
        .delete()
        .eq('user_id', user.id)
        .eq('listing_id', listing.id);
      setIsWatchlisted(false);
    } else {
      // Add to database
      await supabase
        .from('watchlist')
        .insert([{ user_id: user.id, listing_id: listing.id }]);
      setIsWatchlisted(true);
    }
    setIsWatchlistLoading(false);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-7xl w-full">
      
      {/* LEFT COLUMN: The Motorcycle Image */}
      <div className="relative rounded-3xl overflow-hidden shadow-2xl h-[600px] bg-black">
        <img 
          src="https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?q=80&w=2070" 
          alt="Ducati Panigale V4"
          className="object-cover w-full h-full opacity-90"
        />
        <div className="absolute top-4 left-4 flex gap-2">
          <button className="bg-white/20 backdrop-blur-md p-3 rounded-full hover:bg-white/30 transition text-white">
             ←
          </button>
        </div>
      </div>

      {/* RIGHT COLUMN: The Bidding Interface */}
      <div className="flex flex-col text-white space-y-6">
        
        {/* Header with new Watchlist Button */}
        <div>
          <div className="flex justify-between items-start mb-2">
            <p className="text-white/60 text-sm tracking-wider uppercase font-semibold">Back to Garage</p>
            <button 
              onClick={toggleWatchlist}
              disabled={isWatchlistLoading}
              className={`text-sm font-bold px-4 py-2 rounded-full transition-colors border ${
                isWatchlisted 
                  ? 'bg-white/20 border-white/40 text-white hover:bg-white/10' 
                  : 'bg-transparent border-white/20 text-white/70 hover:text-white hover:border-white/60'
              }`}
            >
              {isWatchlistLoading ? '...' : isWatchlisted ? '★ SAVED' : '☆ SAVE TO GARAGE'}
            </button>
          </div>
          <h1 className="text-5xl font-extrabold tracking-tight mb-4">
            {listing.make} <br /> {listing.model}
          </h1>
          <p className="text-sm text-white/80 leading-relaxed">
            <span className="text-[#ff5a20] font-bold">FUN FACT:</span> This specific model was the first street bike to feature the Desmosedici Stradale engine, derived directly from MotoGP.
          </p>
        </div>

        {/* Market Value & Bid Section */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
          <div className="flex justify-between items-center mb-10">
            <span className="text-xs font-bold text-white/50 tracking-widest uppercase">:: Current Top Bid</span>
            <span className="bg-white/10 px-3 py-1 rounded-md text-xl font-bold text-[#ff5a20]">
              ${currentBid.toLocaleString()}
            </span>
          </div>
          
          {/* Interactive Market Value Chart */}
          <div className="h-28 w-full mb-6">
            <ResponsiveContainer width="100%" height={112}>
              <BarChart data={marketData}>
                <defs>
                  <linearGradient id="barGradient" x1="0" y1="1" x2="0" y2="0">
                    <stop offset="0%" stopColor="#ffffff" stopOpacity={0.1} />
                    <stop offset="100%" stopColor="#ffffff" stopOpacity={0.5} />
                  </linearGradient>
                </defs>
                <Tooltip 
                  cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-black/90 border border-white/20 p-3 rounded-lg shadow-xl backdrop-blur-md">
                          <p className="text-[#ff5a20] font-bold">${payload[0].value?.toLocaleString()}</p>
                          <p className="text-white/50 text-xs uppercase tracking-wider">{payload[0].payload.month}</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="price" radius={[4, 4, 0, 0]} fill="url(#barGradient)" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="flex justify-between items-center">
             <div>
                <button className="bg-white/90 text-black text-sm font-bold px-4 py-2 rounded-full mr-3">View Data</button>
                <span className="text-xs text-white/50 font-semibold tracking-wide">LAST 6 MONTHS</span>
             </div>
             <button 
                onClick={handlePlaceBid}
                disabled={isBidding}
                className="bg-[#ff5a20] hover:bg-[#ff4500] disabled:opacity-50 transition-colors text-white font-bold px-8 py-3 rounded-xl shadow-lg shadow-[#ff5a20]/20"
              >
               {isBidding ? 'SENDING...' : 'PLACE BID'}
             </button>
          </div>
        </div>

        {/* Specs Row */}
        <div className="grid grid-cols-4 gap-4 bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
          <div>
            <p className="text-[10px] text-white/50 uppercase font-bold tracking-wider mb-1">Mileage</p>
            <p className="font-bold text-lg">{listing.mileage.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-[10px] text-white/50 uppercase font-bold tracking-wider mb-1">Location</p>
            <p className="font-bold text-lg">{listing.location}</p>
          </div>
          <div>
            <p className="text-[10px] text-white/50 uppercase font-bold tracking-wider mb-1">Title</p>
            <p className="font-bold text-lg text-green-400">{listing.title_status}</p>
          </div>
          <div>
            <p className="text-[10px] text-white/50 uppercase font-bold tracking-wider mb-1">Ends In</p>
            <p className="font-bold text-lg text-[#ff5a20] tabular-nums">{timeLeft}</p>
          </div>
        </div>

      </div>
    </div>
  );
}