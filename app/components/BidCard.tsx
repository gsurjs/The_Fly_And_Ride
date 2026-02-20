'use client'; 
import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { BarChart, Bar, ResponsiveContainer, Tooltip } from 'recharts';

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function BidCard({ listing }: { listing: any }) {
  const [timeLeft, setTimeLeft] = useState('Calculating...');
  const [currentBid, setCurrentBid] = useState(listing.reserve_price || 0);
  const [isBidding, setIsBidding] = useState(false);
  
  // New State for Custom Bid Input & Validation Messages
  const [bidInput, setBidInput] = useState<number | ''>('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  
  // Watchlist State
  const [isWatchlisted, setIsWatchlisted] = useState(false);
  const [isWatchlistLoading, setIsWatchlistLoading] = useState(false);

  // Image Gallery State
  const fallbackImage = "https://images.unsplash.com/photo-1558981403-c5f9899a28bc?q=80&w=800";
  const [activeImage, setActiveImage] = useState(listing.image_url || fallbackImage);
  
  // Combine the primary image and the gallery array into one list
  const allImages = [
    listing.image_url || fallbackImage,
    ...(listing.gallery_urls || [])
  ];

  // Dummy market data for the chart
  const marketData = [
    { month: 'Aug', price: 19500 }, { month: 'Sep', price: 21000 }, 
    { month: 'Oct', price: 20500 }, { month: 'Nov', price: 22500 },
    { month: 'Dec', price: 23000 }, { month: 'Jan', price: 24500 },
    { month: 'Feb', price: 24000 }
  ];

  useEffect(() => {
    // 1. Fetch initial high bid (in case there are already bids in the DB)
    const fetchInitialBid = async () => {
      const { data } = await supabase
        .from('bids')
        .select('amount')
        .eq('listing_id', listing.id)
        .order('amount', { ascending: false })
        .limit(1);
        
      if (data && data.length > 0) {
        setCurrentBid(data[0].amount);
      }
    };
    fetchInitialBid();

    // 2. Check initial Watchlist state
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

    // 3. The Countdown Timer
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

    // 4. The WebSocket Listener for Live Bids (Keeps your page updating without refresh!)
    const channel = supabase
      .channel('live-bids')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'bids', filter: `listing_id=eq.${listing.id}` },
        (payload) => {
          setCurrentBid(payload.new.amount);
          // If someone else bids, clear any success message we have
          setSuccessMsg(''); 
        }
      )
      .subscribe();

    return () => {
      clearInterval(timer);
      supabase.removeChannel(channel);
    };
  }, [listing.ends_at, listing.id]);

  // The Upgraded Bidding Engine
  const handlePlaceBid = async () => {
    setErrorMsg('');
    setSuccessMsg('');
    setIsBidding(true);

    if (timeLeft === 'Auction Ended') {
      setErrorMsg("This auction has concluded.");
      setIsBidding(false);
      return;
    }

    const numericBid = Number(bidInput);
    if (!numericBid || numericBid <= currentBid) {
      setErrorMsg(`Bid must be greater than $${currentBid.toLocaleString()}`);
      setIsBidding(false);
      return;
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      alert("You must be logged in to place a bid.");
      window.location.href = '/login';
      return;
    }

    if (user.id === listing.seller_id) {
      setErrorMsg("You cannot bid on your own listing.");
      setIsBidding(false);
      return;
    }

    const { error } = await supabase
      .from('bids')
      .insert([{ listing_id: listing.id, amount: numericBid, bidder_id: user.id }]);

    if (error) {
      console.error("Database rejected transaction:", error.message);
      setErrorMsg("Transaction failed. Please try again.");
    } else {
      setSuccessMsg("Bid placed successfully!");
      setBidInput(''); // Clear the input field
    }
    
    setIsBidding(false);
  };

  const toggleWatchlist = async () => {
    setIsWatchlistLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      alert("Create an account to save vehicles to your Garage.");
      window.location.href = '/login';
      return;
    }

    if (isWatchlisted) {
      await supabase.from('watchlist').delete().eq('user_id', user.id).eq('listing_id', listing.id);
      setIsWatchlisted(false);
    } else {
      await supabase.from('watchlist').insert([{ user_id: user.id, listing_id: listing.id }]);
      setIsWatchlisted(true);
    }
    setIsWatchlistLoading(false);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-7xl w-full">
      
      {/* LEFT COLUMN: The Motorcycle Image Gallery */}
      <div className="relative rounded-3xl overflow-hidden shadow-2xl h-[600px] bg-black border border-white/10 flex flex-col group">
        
        {/* The Main Active Image */}
        <div className="flex-1 relative overflow-hidden">
          <img 
            src={activeImage} 
            alt={`${listing.make} ${listing.model}`}
            className="object-cover w-full h-full opacity-90 transition-opacity duration-300"
          />
        </div>

        {/* The Thumbnail Strip (Only visible if there are multiple images) */}
        {allImages.length > 1 && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-3 bg-black/60 backdrop-blur-md p-3 rounded-2xl border border-white/10 shadow-2xl">
            {allImages.map((img, idx) => (
              <button 
                key={idx}
                onClick={() => setActiveImage(img)}
                className={`relative w-16 h-16 rounded-xl overflow-hidden border-2 transition-all duration-200 ${
                  activeImage === img ? 'border-[#ff5a20] scale-110 shadow-lg shadow-[#ff5a20]/20' : 'border-transparent opacity-50 hover:opacity-100'
                }`}
              >
                <img src={img} alt={`Thumbnail ${idx + 1}`} className="object-cover w-full h-full" />
              </button>
            ))}
          </div>
        )}

        <div className="absolute top-4 left-4 flex gap-2">
          <button onClick={() => window.history.back()} className="bg-black/50 border border-white/10 backdrop-blur-md p-3 rounded-full hover:bg-white/20 transition text-white">
             ←
          </button>
        </div>
      </div>

      {/* RIGHT COLUMN: The Bidding Interface */}
      <div className="flex flex-col text-white space-y-6">
        
        {/* Header with Watchlist Button */}
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
            {listing.make} <br /> <span className="text-[#ff5a20]">{listing.model}</span>
          </h1>
          <p className="text-sm text-white/80 leading-relaxed">
            <span className="text-white font-bold">INFO:</span> This unit comes with a {listing.title_status.toLowerCase()} title and is currently located in {listing.location}.
          </p>
        </div>

        {/* Market Value & Bid Section */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
          <div className="flex justify-between items-center mb-10">
            <span className="text-xs font-bold text-white/50 tracking-widest uppercase">:: Current Top Bid</span>
            <span className="bg-white/10 px-4 py-2 rounded-md text-3xl font-bold text-[#ff5a20]">
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

          <div className="flex flex-col gap-3">
            {/* Real-time Status Messages */}
            {errorMsg && <p className="text-red-400 text-xs font-bold text-right uppercase tracking-wider">{errorMsg}</p>}
            {successMsg && <p className="text-green-400 text-xs font-bold text-right uppercase tracking-wider">{successMsg}</p>}
            
            <div className="flex justify-between items-center">
               <div>
                  <button className="bg-white/90 text-black text-sm font-bold px-4 py-2 rounded-full mr-3">View Data</button>
                  <span className="text-xs text-white/50 font-semibold tracking-wide">LAST 6 MONTHS</span>
               </div>
               
               {/* NEW: Custom Input Field & Bidding Logic */}
               <div className="flex gap-2">
                 <input 
                   type="number" 
                   value={bidInput}
                   onChange={(e) => setBidInput(e.target.value === '' ? '' : Number(e.target.value))}
                   placeholder={`> ${currentBid}`}
                   disabled={isBidding || timeLeft === 'Auction Ended'}
                   className="w-32 bg-black/50 border border-white/20 rounded-xl px-4 py-2 text-white font-bold focus:outline-none focus:border-[#ff5a20] disabled:opacity-50"
                 />
                 <button 
                    onClick={handlePlaceBid}
                    disabled={isBidding || timeLeft === 'Auction Ended'}
                    className="bg-[#ff5a20] hover:bg-[#ff4500] disabled:opacity-50 transition-colors text-white font-extrabold px-6 py-2 rounded-xl shadow-lg shadow-[#ff5a20]/20 tracking-wide"
                  >
                   {isBidding ? '...' : 'BID'}
                 </button>
               </div>
            </div>
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
            <p className={`font-bold text-lg ${listing.title_status === 'Clean' ? 'text-green-400' : 'text-yellow-400'}`}>{listing.title_status}</p>
          </div>
          <div>
            <p className="text-[10px] text-white/50 uppercase font-bold tracking-wider mb-1">Ends In</p>
            <p className="font-bold text-lg text-[#ff5a20] tabular-nums text-nowrap">{timeLeft}</p>
          </div>
        </div>

      </div>
    </div>
  );
}