'use client'; 
import { useState, useEffect, useCallback } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import Link from 'next/link';

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function BidCard({ listing }: { listing: any }) {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [timeLeft, setTimeLeft] = useState('Calculating...');
  const [currentBid, setCurrentBid] = useState(listing.reserve_price || 0);
  const [isBidding, setIsBidding] = useState(false);
  
  const [bidInput, setBidInput] = useState<number | ''>('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  
  const [isWatchlisted, setIsWatchlisted] = useState(false);
  const [isWatchlistLoading, setIsWatchlistLoading] = useState(false);

  const [isMessageModalOpen, setIsMessageModalOpen] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [isSendingMessage, setIsSendingMessage] = useState(false);

  const [bidHistory, setBidHistory] = useState<any[]>([]);

  const fallbackImage = "https://images.unsplash.com/photo-1558981403-c5f9899a28bc?q=80&w=800";
  const [activeImage, setActiveImage] = useState(listing.image_url || fallbackImage);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const allImages = [listing.image_url || fallbackImage, ...(listing.gallery_urls || [])];

  // Feature Details Modal State
  const [activeDetailModal, setActiveDetailModal] = useState<any>(null);

  // YouTube ID Extractor
  const getYouTubeId = (url: string) => {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  const youtubeId = getYouTubeId(listing.video_url);

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

    const fetchUserAndWatchlist = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user); 
      
      if (user) {
        const { data } = await supabase.from('watchlist').select('id').eq('user_id', user.id).eq('listing_id', listing.id).single();
        if (data) setIsWatchlisted(true);
      }
    };
    fetchUserAndWatchlist();

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
    if (!currentUser) { alert("Create an account to save vehicles to your Garage."); window.location.href = '/login'; return; }

    if (isWatchlisted) {
      await supabase.from('watchlist').delete().eq('user_id', currentUser.id).eq('listing_id', listing.id);
      setIsWatchlisted(false);
    } else {
      await supabase.from('watchlist').insert([{ user_id: currentUser.id, listing_id: listing.id }]);
      setIsWatchlisted(true);
    }
    setIsWatchlistLoading(false);
  };

  const handleSendMessage = async () => {
    if (!messageText.trim() || !currentUser || !listing) return;
    setIsSendingMessage(true);

    const { error } = await supabase.from('messages').insert([{
      listing_id: listing.id,
      sender_id: currentUser.id,
      receiver_id: listing.seller_id,
      content: messageText.trim(),
    }]);

    if (error) {
      alert('Failed to send message. Please try again.');
      setIsSendingMessage(false);
    } else {
      setIsMessageModalOpen(false);
      setMessageText('');
      setIsSendingMessage(false);
      alert('Message sent! Keep an eye on your Inbox for a reply.');
    }
  };

  // Dummy Data & Icon Helper for the Feature Tiles
  const getIconForSection = (id: string) => {
    switch(id) {
      case 'Highlights': return '✨';
      case 'Equipment': return '🛠️';
      case 'Modifications': return '⚙️';
      case 'Known Flaws': return '⚠️';
      case 'Recent Service History': return '📅';
      case 'Other Items Included': return '📦';
      case 'Ownership History': return '👤';
      case 'Seller Notes': return '📝';
      default: return '📄';
    }
  };

  const listingDetails = [
    {
      id: 'Highlights',
      title: 'Highlights',
      content: `THIS... is a 2021 Porsche 718 Cayman GT4, finished in black with a black interior.\n\nThis coupe is equipped with the desirable 6-speed manual transmission, and its odometer displays about 14,400 miles.\n\nThe attached Carfax history report lists no mileage inconsistencies in this Cayman's past. It also shows that this Porsche has been registered in California since new.\n\nNotable modifications reported by the seller include a Dundon Motorsports Pro Tune with a COBB Tuning Accessport tuner, Dundon Motorsports mandrel-bent equal-length exhaust headers, a Valvetronic Designs titanium exhaust system, RSNV rear wing risers, and an aftermarket shift knob.\n\nA build sheet is provided in the gallery, and a partial list of notable equipment reported by the seller includes the Chrono Package, full bucket seats, Alcantara and leather upholstery, and a Bose surround sound system.\n\nIntroduced in 2020, the Porsche 718 Cayman GT4 featured an all-new naturally aspirated 4.0-liter flat-6 engine paired to either a 6-speed manual or a 7-speed PDK transmission, as well as a new aero package with up to 50% more downforce than the original GT4. Mix these all up with a further refined chassis, and the 718 Cayman GT4 proved to be 12 seconds quicker than its predecessor where it matters the most for a Porsche: the Nürburgring Nordschleife.\n\nPower comes from a 4.0-liter flat-6, rated at 414 horsepower and 309 lb-ft of torque in stock form. Due to the modifications performed to this Cayman, it may produce more power, but a dyno sheet was not provided to confirm. Output is sent to the rear wheels via a 6-speed manual transmission.`
    },
    {
      id: 'Equipment',
      title: 'Equipment',
      content: `A build sheet is provided in the gallery, and a partial list of notable equipment reported by the seller includes:\n\n• Chrono Package (analog and digital stopwatch on the dashboard, performance display in the infotainment system, and more)\n• 20-inch wheels\n• Full bucket seats\n• Alcantara and leather upholstery\n• Bose surround sound system`
    },
    {
      id: 'Modifications',
      title: 'Modifications',
      content: `Notable modifications reported by the seller include:\n\nMechanical:\n• Dundon Motorsports Pro Tune with COBB Tuning Accessport tuner\n• Dundon Motorsports mandrel-bent equal-length exhaust headers\n• Valvetronic Designs titanium exhaust system\n• BMC air filters\n\nExterior:\n• Cayman GT4 RS front bumper\n• Tinted side-marker lights\n• RSNV rear wing risers\n\nInterior:\n• Aftermarket shift knob`
    },
    {
      id: 'Known Flaws',
      title: 'Known Flaws',
      content: `• The attached Carfax history report notes that this Cayman sustained "moderate damage" to its front, right-front, right-rear, and undercarriage after an accident in August 2024. The seller states that the front bumper was replaced following the accident.\n• Some scratches on the front splitter`
    },
    {
      id: 'Recent Service History',
      title: 'Recent Service History',
      content: `The attached Carfax history report shows that the following services have been performed:\n\n• December 2025 (13,655 miles): Tire(s) mounted\n• July 2025 (12,204 miles): Tire(s) replaced\n• April 2025 (10,092 miles): Engine oil and filter changed\n• January 2025 (6,865 miles): Cooling system bled, four-wheel alignment performed\n• September 2021 (64 miles): Engine oil and filter changed, coolant flushed/changed`
    },
    {
      id: 'Other Items Included',
      title: 'Other Items Included',
      content: `• 2 keys\n• Owner's manual\n• COBB Tuning Accessport tuner\n• EdGaurd seat bolster covers\n• Numeric Racing shift knob\n• Spare trim covers\n• Gas cap tether ring`
    },
    {
      id: 'Ownership History',
      title: 'Ownership History',
      content: `The seller reportedly purchased this Cayman in June 2024 and has added about 8,200 miles since.`
    },
    {
      id: 'Seller Notes',
      title: 'Seller Notes',
      content: `• The seller states that the windows are tinted.\n• Due to the modifications performed to this Cayman, it may not pass emissions testing in some states. As always, it's the buyer's responsibility to perform all due diligence regarding registering this car in their respective state prior to placing a bid.\n• There is a loan on this vehicle, and sale proceeds will be used to satisfy the loan. We recommend handling the loan payoff securely through Cars & Bids SafePay if agreed to by both the buyer and the seller. Please note that the title may only be available after the loan has been paid off.`
    }
  ];

  const isEnded = timeLeft === 'Auction Ended';
  const hasBids = bidHistory.length > 0;
  const isSold = isEnded && hasBids && currentBid >= listing.reserve_price;
  const reserveNotMet = isEnded && hasBids && currentBid < listing.reserve_price;
  const noBidsEnd = isEnded && !hasBids;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-7xl w-full">
      
      {/* LEFT COLUMN: Image Gallery & Bid Ledger */}
      <div className="flex flex-col gap-6">
        
        {/* Gallery & Video Player */}
        <div className="flex flex-col gap-4">
          
          {/* Main Viewer (Shows Image OR Video) */}
          <div 
            onClick={() => activeImage !== 'video' && setIsLightboxOpen(true)}
            className={`relative rounded-3xl overflow-hidden shadow-2xl h-[300px] sm:h-[400px] lg:h-[500px] w-full bg-black border border-white/10 group flex items-center justify-center ${activeImage !== 'video' ? 'cursor-zoom-in' : ''}`}>
            
            {activeImage === 'video' && youtubeId ? (
              <iframe 
                className="w-full h-full"
                src={`https://www.youtube.com/embed/${youtubeId}?autoplay=1`} 
                title="YouTube video player" 
                frameBorder="0" 
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                allowFullScreen
              ></iframe>
            ) : (
              <>
                <img src={activeImage} alt={`${listing.make} ${listing.model}`} className="object-cover w-full h-full opacity-90 group-hover:opacity-100 transition-opacity duration-300" />
                <div className="absolute top-4 left-4 flex gap-2">
                  <button 
                    onClick={(e) => { e.stopPropagation(); window.history.back(); }} 
                    className="bg-black/50 border border-white/10 backdrop-blur-md p-3 rounded-full hover:bg-white/20 transition text-white shadow-lg">
                    ←
                  </button>
                </div>
                <div className="absolute bottom-4 right-4 bg-black/60 backdrop-blur-md p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none text-white shadow-lg">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                  </svg>
                </div>
              </>
            )}
          </div>

          {/* Thumbnails */}
          <div className="flex gap-3 overflow-x-auto py-2 custom-scrollbar items-center">
            {/* Video Thumbnail */}
            {youtubeId && (
              <button 
                onClick={() => setActiveImage('video')} 
                className={`flex-shrink-0 relative w-24 h-24 rounded-2xl overflow-hidden border-2 transition-all duration-200 flex items-center justify-center bg-black ${activeImage === 'video' ? 'border-[#ff0000] scale-105 shadow-xl shadow-[#ff0000]/20 z-10' : 'border-white/20 opacity-70 hover:opacity-100 hover:border-[#ff0000]'}`}
              >
                <img src={`https://img.youtube.com/vi/${youtubeId}/mqdefault.jpg`} className="absolute inset-0 w-full h-full object-cover opacity-50" alt="Video Thumbnail" />
                <div className="relative z-10 bg-[#ff0000] text-white w-10 h-8 rounded-lg flex items-center justify-center shadow-lg">
                   ▶
                </div>
              </button>
            )}
            {/* Regular Thumbnails */}
            {allImages.map((img, idx) => (
              <button 
                key={idx} 
                onClick={() => setActiveImage(img)} 
                className={`flex-shrink-0 relative w-24 h-24 rounded-2xl overflow-hidden border-2 transition-all duration-200 ${activeImage === img ? 'border-[#ff5a20] scale-105 shadow-xl shadow-[#ff5a20]/20 z-10' : 'border-transparent opacity-50 hover:opacity-100'}`}
              >
                <img src={img} alt={`Thumbnail ${idx + 1}`} className="object-cover w-full h-full" />
              </button>
            ))}
          </div>
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
        
        {/* Header */}
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
            <div className="bg-black/40 border border-white/5 rounded-2xl p-4 flex flex-col items-center justify-center text-center shadow-inner">
              <span className="text-2xl md:text-3xl font-black text-white tracking-tighter">{bidHistory.length || 0}</span>
              <span className="text-[9px] md:text-[10px] font-bold uppercase tracking-widest text-white/40 mt-1">Bids Placed</span>
            </div>
            <div className="bg-black/40 border border-white/5 rounded-2xl p-4 flex flex-col items-center justify-center text-center shadow-inner">
              <span className="text-2xl md:text-3xl font-black text-white tracking-tighter">{listing.watchers || 0}</span>
              <span className="text-[9px] md:text-[10px] font-bold uppercase tracking-widest text-white/40 mt-1">Watchers</span>
            </div>
            <div className="bg-black/40 border border-white/5 rounded-2xl p-4 flex flex-col items-center justify-center text-center shadow-inner">
              <span className="text-2xl md:text-3xl font-black text-white tracking-tighter">{listing.views || 0}</span>
              <span className="text-[9px] md:text-[10px] font-bold uppercase tracking-widest text-white/40 mt-1">Total Views</span>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            {errorMsg && <p className="text-red-400 text-xs font-bold text-right uppercase tracking-wider">{errorMsg}</p>}
            {successMsg && <p className="text-green-400 text-xs font-bold text-right uppercase tracking-wider">{successMsg}</p>}
            <div className="flex justify-end items-center gap-4">
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

        {/* MESSAGE SELLER BUTTON */}
        {currentUser && currentUser.id !== listing.seller_id && (
          <button
            onClick={() => setIsMessageModalOpen(true)}
            className="w-full bg-transparent hover:bg-white/5 border-2 border-white/20 text-white font-extrabold py-3 px-6 rounded-xl transition-colors mt-4 tracking-widest text-sm flex items-center justify-center gap-2"
          >
            <span>💬</span> MESSAGE SELLER
          </button>
        )}
      </div>

      {/* HORIZONTAL FEATURE TILES (Spans the bottom of the grid) */}
      <div className="lg:col-span-2 mt-4 pt-8 border-t border-white/10">
        <h3 className="text-sm font-bold text-white/50 uppercase tracking-widest mb-4">Detailed Vehicle Report</h3>
        <div className="flex gap-3 overflow-x-auto pb-4 custom-scrollbar">
          {listingDetails.map((section) => (
            <button
              key={section.id}
              onClick={() => setActiveDetailModal(section)}
              className="flex-shrink-0 w-36 h-28 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-[#ff5a20]/50 rounded-2xl flex flex-col items-center justify-center p-3 transition-all group relative overflow-hidden shadow-lg"
            >
              {/* Subtle hover glow inside the card */}
              <div className="absolute -inset-1 bg-gradient-to-b from-[#ff5a20]/0 to-[#ff5a20]/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              
              <span className="text-3xl mb-2 group-hover:scale-110 transition-transform group-hover:-translate-y-1 relative z-10">
                {getIconForSection(section.id)}
              </span>
              <span className="text-xs font-bold text-white/80 group-hover:text-white text-center leading-tight relative z-10 tracking-wide">
                {section.title}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* DETAIL READING MODAL */}
      {activeDetailModal && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md" onClick={() => setActiveDetailModal(null)}>
          <div 
            className="bg-[#1a0a07] border border-white/20 p-6 md:p-8 rounded-3xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-[0_0_50px_rgba(255,90,32,0.15)] relative overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex justify-between items-center mb-6 pb-4 border-b border-white/10 shrink-0">
              <h2 className="text-2xl md:text-3xl font-black text-white flex items-center gap-3 tracking-tight">
                <span>{getIconForSection(activeDetailModal.id)}</span> {activeDetailModal.title}
              </h2>
              <button 
                onClick={() => setActiveDetailModal(null)} 
                className="text-white/50 hover:text-white bg-white/5 hover:bg-white/10 p-2.5 rounded-full transition-colors border border-transparent hover:border-white/20"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {/* Scrollable Reading Content */}
            <div className="overflow-y-auto custom-scrollbar pr-4 text-white/80 text-sm md:text-base leading-relaxed whitespace-pre-wrap font-medium">
              {activeDetailModal.content}
            </div>
          </div>
        </div>
      )}

      {/* ORIGINAL DIRECT MESSAGE MODAL */}
      {isMessageModalOpen && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#1a0a07] border border-[#ff5a20]/30 p-6 md:p-8 rounded-3xl w-full max-w-lg shadow-[0_0_40px_rgba(255,90,32,0.15)] relative overflow-hidden">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[150%] h-24 bg-[#ff5a20]/20 blur-[50px] pointer-events-none"></div>
            <div className="relative z-10">
              <h2 className="text-2xl font-black text-white mb-2 tracking-tight">Message the Seller</h2>
              <p className="text-white/60 text-sm mb-6 font-medium">Ask about the {listing.year} {listing.make} {listing.model}, request specific photos, or discuss logistics.</p>
              <textarea
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                placeholder="Hi, I'm highly interested in this bike. Could you tell me more about..."
                className="w-full h-36 bg-black/50 border border-white/10 rounded-xl p-4 text-white focus:outline-none focus:border-[#ff5a20] transition-colors resize-none mb-6 text-sm"
              ></textarea>
              <div className="flex gap-3">
                <button onClick={() => setIsMessageModalOpen(false)} disabled={isSendingMessage} className="flex-1 bg-white/5 hover:bg-white/10 text-white text-xs font-bold py-4 rounded-xl transition-colors disabled:opacity-50 uppercase tracking-widest">CANCEL</button>
                <button onClick={handleSendMessage} disabled={isSendingMessage || !messageText.trim()} className="flex-1 bg-[#ff5a20] hover:bg-[#ff4500] text-white text-xs font-bold py-4 rounded-xl transition-colors disabled:opacity-50 uppercase tracking-widest">{isSendingMessage ? 'SENDING...' : 'SEND MESSAGE'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* ORIGINAL LIGHTBOX */}
      {isLightboxOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/95 p-4 backdrop-blur-xl animate-in fade-in duration-200 cursor-zoom-out" onClick={() => setIsLightboxOpen(false)}>
          <button onClick={() => setIsLightboxOpen(false)} className="absolute top-6 right-6 text-white bg-white/10 p-3 rounded-full hover:bg-white/30 transition-colors z-[210] border border-white/20">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
          <img src={activeImage} alt={`${listing.make} Full View`} className="max-w-full max-h-full object-contain shadow-2xl rounded-lg" />
        </div>
      )}
    </div>
  );
}