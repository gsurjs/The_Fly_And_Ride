'use client'; 
import { useState, useEffect, useCallback } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { BarChart, Bar, ResponsiveContainer, Tooltip } from 'recharts';
import Link from 'next/link';

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function BidCard({ listing }: { listing: any }) {
  const [timeLeft, setTimeLeft] = useState('Calculating...');
  const [currentBid, setCurrentBid] = useState(listing.reserve_price || 0);
  const [isBidding, setIsBidding] = useState(false);
  
  const [bidInput, setBidInput] = useState<number | ''>('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  
  const [isWatchlisted, setIsWatchlisted] = useState(false);
  const [isWatchlistLoading, setIsWatchlistLoading] = useState(false);

  // Bid Ledger State
  const [bidHistory, setBidHistory] = useState<any[]>([]);

  const fallbackImage = "https://images.unsplash.com/photo-1558981403-c5f9899a28bc?q=80&w=800";
  const [activeImage, setActiveImage] = useState(listing.image_url || fallbackImage);
  const allImages = [listing.image_url || fallbackImage, ...(listing.gallery_urls || [])];

  const marketData = [
    { month: 'Aug', price: 19500 }, { month: 'Sep', price: 21000 }, 
    { month: 'Oct', price: 20500 }, { month: 'Nov', price: 22500 },
    { month: 'Dec', price: 23000 }, { month: 'Jan', price: 24500 },
    { month: 'Feb', price: 24000 }
  ];

  const fetchBids = useCallback(async () => {
    const { data: bidsData } = await supabase
      .from('bids')
      .select('*')
      .eq('listing_id', listing.id)
      .order('amount', { ascending: false });

    if (bidsData && bidsData.length > 0) {
      setCurrentBid(bidsData[0].amount);
      
      const bidderIds = [...new Set(bidsData.map(b => b.bidder_id))];
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, username')
        .in('id', bidderIds);

      const profileMap: Record<string, string> = {};
      if (profilesData) {
        profilesData.forEach(p => profileMap[p.id] = p.username || 'Anonymous Rider');
      }

      const enrichedBids = bidsData.map(bid => ({
        ...bid,
        username: profileMap[bid.bidder_id] || 'Anonymous Rider'
      }));
      
      setBidHistory(enrichedBids);
    } else {
      setBidHistory([]);
    }
  }, [listing.id]);

  useEffect(() => {
    fetchBids(); 

    const checkWatchlistStatus = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase.from('watchlist').select('id').eq('user_id', user.id).eq('listing_id', listing.id).single();
        if (data) setIsWatchlisted(true);
      }
    };
    checkWatchlistStatus();

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

    const channel = supabase
      .channel('live-bids')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'bids', filter: `listing_id=eq.${listing.id}` },
        () => {
          fetchBids();
          setSuccessMsg(''); 
        }
      )
      .subscribe();

    return () => {
      clearInterval(timer);
      supabase.removeChannel(channel);
    };
  }, [listing.ends_at, listing.id, fetchBids]);

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

    const { error } = await supabase.from('bids').insert([{ listing_id: listing.id, amount: numericBid, bidder_id: user.id }]);

    if (error) {
      setErrorMsg("Transaction failed. Please try again.");
    } else {
      setSuccessMsg("Bid placed successfully!");
      setBidInput(''); 
      fetchBids(); 
    }
    
    setIsBidding(false);
  };

  const toggleWatchlist = async () => {
    setIsWatchlistLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { alert("Create an account to save vehicles to your Garage."); window.location.href = '/login'; return; }

    if (isWatchlisted) {
      await supabase.from('watchlist').delete().eq('user_id', user.id).eq('listing_id', listing.id);
      setIsWatchlisted(false);
    } else {
      await supabase.from('watchlist').insert([{ user_id: user.id, listing_id: listing.id }]);
      setIsWatchlisted(true);
    }
    setIsWatchlistLoading(false);
  };

  // Auction Resolution Logic
  const isEnded = timeLeft === 'Auction Ended';
  const hasBids = bidHistory.length > 0;
  const isSold = isEnded && hasBids && currentBid >= listing.reserve_price;
  const reserveNotMet = isEnded && hasBids && currentBid < listing.reserve_price;
  const noBidsEnd = isEnded && !hasBids;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-7xl w-full">
      
      {/* LEFT COLUMN: Image Gallery & Bid Ledger */}
      <div className="flex flex-col gap-6">
        
        {/* Gallery */}
        <div className="flex flex-col gap-4">
          <div className="relative rounded-3xl overflow-hidden shadow-2xl h-[300px] sm:h-[400px] lg:h-[500px] w-full bg-black border border-white/10 group flex items-center justify-center">
            <img src={activeImage} alt={`${listing.make} ${listing.model}`} className="object-cover w-full h-full opacity-90 transition-opacity duration-300" />
            <div className="absolute top-4 left-4 flex gap-2">
              <button onClick={() => window.history.back()} className="bg-black/50 border border-white/10 backdrop-blur-md p-3 rounded-full hover:bg-white/20 transition text-white shadow-lg">←</button>
            </div>
          </div>
          {allImages.length > 1 && (
            <div className="flex gap-3 overflow-x-auto py-2 custom-scrollbar">
              {allImages.map((img, idx) => (
                <button key={idx} onClick={() => setActiveImage(img)} className={`flex-shrink-0 relative w-24 h-24 rounded-2xl overflow-hidden border-2 transition-all duration-200 ${activeImage === img ? 'border-[#ff5a20] scale-105 shadow-xl shadow-[#ff5a20]/20 z-10' : 'border-transparent opacity-50 hover:opacity-100'}`}>
                  <img src={img} alt={`Thumbnail ${idx + 1}`} className="object-cover w-full h-full" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* THE BID LEDGER */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm flex flex-col h-80">
          <h3 className="text-xl font-extrabold text-white mb-4 tracking-tight">Bid History</h3>
          <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
            {bidHistory.length === 0 ? (
              <p className="text-white/40 text-sm font-bold tracking-wide text-center mt-10">No bids placed yet.</p>
            ) : (
              bidHistory.map((bid, idx) => (
                <div key={bid.id} className={`flex justify-between items-center p-3 rounded-xl border ${idx === 0 ? 'bg-[#ff5a20]/10 border-[#ff5a20]/30' : 'bg-black/30 border-white/5'}`}>
                  <div className="flex flex-col items-start relative z-10">
                    {/* The Fully Clickable Link */}
                    <Link 
                      href={`/user/${bid.bidder_id}`} 
                      className="text-white font-bold hover:text-[#ff5a20] hover:underline transition-colors py-0.5 cursor-pointer"
                    >
                      {bid.username}
                    </Link>
                    <p className="text-white/40 text-[10px] uppercase tracking-wider font-semibold">
                      {new Date(bid.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <div className={`text-lg font-extrabold ${idx === 0 ? 'text-[#ff5a20]' : 'text-white/80'}`}>
                    ${bid.amount.toLocaleString()}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN: Specs & Bidding Interface */}
      <div className="flex flex-col text-white space-y-6">
        
        {/* Header (INFO Restored!) */}
        <div>
          <div className="flex justify-between items-start mb-2">
            <p className="text-white/60 text-sm tracking-wider uppercase font-semibold">Back to Garage</p>
            <button onClick={toggleWatchlist} disabled={isWatchlistLoading} className={`text-sm font-bold px-4 py-2 rounded-full transition-colors border ${isWatchlisted ? 'bg-white/20 border-white/40 text-white hover:bg-white/10' : 'bg-transparent border-white/20 text-white/70 hover:text-white hover:border-white/60'}`}>
              {isWatchlistLoading ? '...' : isWatchlisted ? '★ SAVED' : '☆ SAVE TO GARAGE'}
            </button>
          </div>
          <h1 className="text-5xl font-extrabold tracking-tight mb-4">{listing.make} <br /> <span className="text-[#ff5a20]">{listing.model}</span></h1>
          
          <p className="text-sm text-white/80 leading-relaxed">
            <span className="text-white font-bold">INFO:</span> This unit comes with a {listing.title_status.toLowerCase()} title and is currently located in {listing.location}.
          </p>
        </div>

        {/* AUCTION RESOLUTION ENGINE */}
        <div className={`border rounded-2xl p-6 backdrop-blur-sm transition-all duration-500 ${isSold ? 'bg-green-500/10 border-green-500/30' : reserveNotMet ? 'bg-red-500/10 border-red-500/30' : 'bg-white/5 border-white/10'}`}>
          <div className="flex justify-between items-center mb-10">
            <span className="text-xs font-bold text-white/50 tracking-widest uppercase">
              {isSold ? ':: Final Selling Price' : reserveNotMet ? ':: Final Bid (Reserve Not Met)' : ':: Current Top Bid'}
            </span>
            <span className={`px-4 py-2 rounded-md text-3xl font-bold ${isSold ? 'bg-green-500/20 text-green-400' : reserveNotMet ? 'bg-red-500/20 text-red-400' : 'bg-white/10 text-[#ff5a20]'}`}>
              ${currentBid.toLocaleString()}
            </span>
          </div>

          {/* Market Chart (Restored to always show!) */}
          <div className="h-28 w-full mb-6">
            <ResponsiveContainer width="100%" height={112}>
              <BarChart data={marketData}>
                <defs>
                  <linearGradient id="barGradient" x1="0" y1="1" x2="0" y2="0">
                    <stop offset="0%" stopColor="#ffffff" stopOpacity={0.1} />
                    <stop offset="100%" stopColor="#ffffff" stopOpacity={0.5} />
                  </linearGradient>
                </defs>
                <Tooltip cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }} content={({ active, payload }) => {
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
            {errorMsg && <p className="text-red-400 text-xs font-bold text-right uppercase tracking-wider">{errorMsg}</p>}
            {successMsg && <p className="text-green-400 text-xs font-bold text-right uppercase tracking-wider">{successMsg}</p>}
            
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
               <div>
                   <button className="bg-white/90 text-black text-sm font-bold px-4 py-2 rounded-full mr-3">View Data</button>
                   <span className="text-xs text-white/50 font-semibold tracking-wide">LAST 6 MONTHS</span>
               </div>
               
               {/* Only show the bid input if the auction is still active */}
               {!isEnded && (
                 <div className="flex gap-2">
                   <input type="number" value={bidInput} onChange={(e) => setBidInput(e.target.value === '' ? '' : Number(e.target.value))} placeholder={`> ${currentBid}`} disabled={isBidding} className="w-32 bg-black/50 border border-white/20 rounded-xl px-4 py-2 text-white font-bold focus:outline-none focus:border-[#ff5a20] disabled:opacity-50" />
                   <button onClick={handlePlaceBid} disabled={isBidding} className="bg-[#ff5a20] hover:bg-[#ff4500] disabled:opacity-50 transition-colors text-white font-extrabold px-6 py-2 rounded-xl shadow-lg shadow-[#ff5a20]/20 tracking-wide">
                     {isBidding ? '...' : 'BID'}
                   </button>
                 </div>
               )}
            </div>
          </div>

          {/* DYNAMIC END STATES */}
          {isSold && (
            <div className="text-center py-6 border-t border-green-500/20 mt-6 animate-pulse">
              <p className="text-green-400 font-extrabold text-2xl tracking-tight mb-2">
                SOLD TO <Link href={`/user/${bidHistory[0]?.bidder_id}`} className="hover:underline hover:text-white transition-colors">{bidHistory[0]?.username}</Link>
              </p>
              <p className="text-white/60 text-sm font-semibold">The seller will contact the winning bidder shortly.</p>
            </div>
          )}

          {reserveNotMet && (
            <div className="text-center py-6 border-t border-red-500/20 mt-6">
              <p className="text-red-400 font-extrabold text-2xl tracking-tight mb-2">RESERVE NOT MET</p>
              <p className="text-white/60 text-sm font-semibold">The highest bid did not meet the seller's reserve price.</p>
            </div>
          )}

          {noBidsEnd && (
            <div className="text-center py-6 border-t border-white/10 mt-6">
              <p className="text-white font-extrabold text-2xl tracking-tight mb-2">AUCTION CLOSED</p>
              <p className="text-white/60 text-sm font-semibold">No bids were placed on this vehicle.</p>
            </div>
          )}
        </div>

        {/* Specs Row (Formatting Restored!) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
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