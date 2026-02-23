'use client'; 
import { useState, useEffect, useCallback } from 'react';
import { createBrowserClient } from '@supabase/ssr';
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
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const allImages = [listing.image_url || fallbackImage, ...(listing.gallery_urls || [])];

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
          <div 
            onClick={() => setIsLightboxOpen(true)}
            className="relative rounded-3xl overflow-hidden shadow-2xl h-[300px] sm:h-[400px] lg:h-[500px] w-full bg-black border border-white/10 group flex items-center justify-center cursor-zoom-in">
            {/* Reverted to object-cover for the cinematic fill */}
            <img src={activeImage} alt={`${listing.make} ${listing.model}`} className="object-cover w-full h-full opacity-90 group-hover:opacity-100 transition-opacity duration-300" />
            
            {/* Back Button */}
            <div className="absolute top-4 left-4 flex gap-2">
              <button 
                onClick={(e) => { e.stopPropagation(); window.history.back(); }} 
                className="bg-black/50 border border-white/10 backdrop-blur-md p-3 rounded-full hover:bg-white/20 transition text-white shadow-lg">
                ←
              </button>
            </div>

            {/* Hint Icon: Shows a subtle expand icon on hover */}
            <div className="absolute bottom-4 right-4 bg-black/60 backdrop-blur-md p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none text-white shadow-lg">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
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
          <div className="flex justify-between items-center mb-8">
            <span className="text-xs font-bold text-white/50 tracking-widest uppercase">
              {isSold ? ':: Final Selling Price' : reserveNotMet ? ':: Final Bid (Reserve Not Met)' : ':: Current Top Bid'}
            </span>
            <span className={`px-4 py-2 rounded-md text-3xl font-bold ${isSold ? 'bg-green-500/20 text-green-400' : reserveNotMet ? 'bg-red-500/20 text-red-400' : 'bg-white/10 text-[#ff5a20]'}`}>
              ${currentBid.toLocaleString()}
            </span>
          </div>

          {/* AUCTION ANALYTICS BANNERS */}
          <div className="grid grid-cols-3 gap-3 md:gap-4 mb-8">
            {/* BIDS PLACED */}
            <div className="bg-black/40 border border-white/5 rounded-2xl p-4 flex flex-col items-center justify-center text-center shadow-inner">
              <span className="text-2xl md:text-3xl font-black text-white tracking-tighter">
                {bidHistory.length || 0}
              </span>
              <span className="text-[9px] md:text-[10px] font-bold uppercase tracking-widest text-white/40 mt-1">Bids Placed</span>
            </div>
            
            {/* WATCHERS */}
            <div className="bg-black/40 border border-white/5 rounded-2xl p-4 flex flex-col items-center justify-center text-center shadow-inner">
              <span className="text-2xl md:text-3xl font-black text-white tracking-tighter">
                {listing.watchers || 0}
              </span>
              <span className="text-[9px] md:text-[10px] font-bold uppercase tracking-widest text-white/40 mt-1">Watchers</span>
            </div>

            {/* VIEWS */}
            <div className="bg-black/40 border border-white/5 rounded-2xl p-4 flex flex-col items-center justify-center text-center shadow-inner">
              <span className="text-2xl md:text-3xl font-black text-white tracking-tighter">
                {listing.views || 0}
              </span>
              <span className="text-[9px] md:text-[10px] font-bold uppercase tracking-widest text-white/40 mt-1">Total Views</span>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            {errorMsg && <p className="text-red-400 text-xs font-bold text-right uppercase tracking-wider">{errorMsg}</p>}
            {successMsg && <p className="text-green-400 text-xs font-bold text-right uppercase tracking-wider">{successMsg}</p>}
            
            <div className="flex justify-end items-center gap-4">
               {/* Only show the bid input if the auction is still active */}
               {!isEnded && (
                 <div className="flex gap-2 w-full sm:w-auto">
                   <input type="number" value={bidInput} onChange={(e) => setBidInput(e.target.value === '' ? '' : Number(e.target.value))} placeholder={`> ${currentBid}`} disabled={isBidding} className="w-full sm:w-32 bg-black/50 border border-white/20 rounded-xl px-4 py-2 text-white font-bold focus:outline-none focus:border-[#ff5a20] disabled:opacity-50" />
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

        {/* Specs Row */}
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
        
        {isLightboxOpen && (
        <div 
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/95 p-4 backdrop-blur-xl animate-in fade-in duration-200 cursor-zoom-out"
          onClick={() => setIsLightboxOpen(false)}
        >
          {/* Close Button */}
          <button 
            onClick={() => setIsLightboxOpen(false)}
            className="absolute top-6 right-6 text-white bg-white/10 p-3 rounded-full hover:bg-white/30 transition-colors z-[210] border border-white/20"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Uncropped Full Size Image */}
          <img 
            src={activeImage} 
            alt={`${listing.make} Full View`} 
            className="max-w-full max-h-full object-contain shadow-2xl rounded-lg"
          />
        </div>
      )}
      </div>
    </div>
  );
}