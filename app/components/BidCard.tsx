'use client'; 
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { BarChart, Bar, ResponsiveContainer, Tooltip, Cell } from 'recharts';

// Initialize the Supabase client for the browser
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export default function BidCard({ listing }: { listing: any }) {

  const [timeLeft, setTimeLeft] = useState('Calculating...');
  const [currentBid, setCurrentBid] = useState(listing.reserve_price || 0);
  const [isBidding, setIsBidding] = useState(false);

  // Dummy data representing the last 6 months of Ducati Panigale sales
  const marketData = [
    { month: 'Aug', price: 19500 }, { month: 'Sep', price: 21000 }, 
    { month: 'Oct', price: 20500 }, { month: 'Nov', price: 22500 },
    { month: 'Dec', price: 23000 }, { month: 'Jan', price: 24500 },
    { month: 'Feb', price: 24000 }
  ];

  useEffect(() => {
    // 1. The Countdown Timer
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

    // 2. The WebSocket Listener for Live Bids
    const channel = supabase
      .channel('live-bids')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'bids', filter: `listing_id=eq.${listing.id}` },
        (payload) => {
          // When a new bid hits the database, instantly update the UI
          console.log("New bid received!", payload.new);
          setCurrentBid(payload.new.amount);
        }
      )
      .subscribe();

    return () => {
      clearInterval(timer);
      supabase.removeChannel(channel);
    };
  }, [listing.ends_at, listing.id]);

  // 3. The Action: Placing a Bid
  const handlePlaceBid = async () => {
    setIsBidding(true);

    // Grab the secure session from the browser
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    
    if (authError || !session) {
      alert("You must be logged in to place a bid.");
      window.location.href = '/login';
      return;
    }

    const newBidAmount = currentBid + 250; // Standard $250 bid increment

    // Insert the actual authenticated user's ID
    const { error } = await supabase
      .from('bids')
      .insert([
        { 
          listing_id: listing.id, 
          amount: newBidAmount,
          bidder_id: session.user.id 
        }
      ]);

    if (error) {
      console.error("Database rejected transaction:", error.message);
      alert("Failed to place bid. Ensure you aren't bidding on your own listing.");
    }
    
    setIsBidding(false);
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
        
        {/* Header */}
        <div>
          <p className="text-white/60 text-sm tracking-wider uppercase font-semibold mb-2">Back to Garage</p>
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
            {/* Display the live bid state here */}
            <span className="bg-white/10 px-3 py-1 rounded-md text-xl font-bold text-[#ff5a20]">
              ${currentBid.toLocaleString()}
            </span>
          </div>
          
          {/* Interactive Market Value Chart */}
          <div className="h-28 w-full mb-6">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={marketData}>
                {/* Define the SVG Gradient so it looks exactly like the mockup */}
                <defs>
                  <linearGradient id="barGradient" x1="0" y1="1" x2="0" y2="0">
                    <stop offset="0%" stopColor="#ffffff" stopOpacity={0.1} />
                    <stop offset="100%" stopColor="#ffffff" stopOpacity={0.5} />
                  </linearGradient>
                </defs>

                {/* Custom Tooltip on Hover */}
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
                {/* Apply the gradient fill here */}
                <Bar dataKey="price" radius={[4, 4, 0, 0]} fill="url(#barGradient)" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="flex justify-between items-center">
             <div>
                <button className="bg-white/90 text-black text-sm font-bold px-4 py-2 rounded-full mr-3">View Data</button>
                <span className="text-xs text-white/50 font-semibold tracking-wide">LAST 6 MONTHS</span>
             </div>
             {/* The Place Bid Button */}
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