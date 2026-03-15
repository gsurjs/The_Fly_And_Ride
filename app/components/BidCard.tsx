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

  const [activeDetailModal, setActiveDetailModal] = useState<any>(null);

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

  const getIconForSection = (id: string, isModal: boolean = false) => {
    const size = isModal ? "w-8 h-8" : "w-7 h-7"; 
    const baseClass = `${size} transition-colors duration-300`;

    switch(id) {
      case 'Highlights': 
        return <svg className={baseClass} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>;
      case 'Equipment': 
        return <svg className={baseClass} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>;
      case 'Modifications': 
        return <svg className={baseClass} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>;
      case 'Known Flaws': 
        return <svg className={baseClass} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>;
      case 'Recent Service History': 
        return <svg className={baseClass} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>;
      case 'Other Items Included': 
        return <svg className={baseClass} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>;
      case 'Ownership History': 
        return <svg className={baseClass} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>;
      case 'Seller Notes': 
        return <svg className={baseClass} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>;
      default: 
        return <svg className={baseClass} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>;
    }
  };

  // Dynamic Data Array
  // This maps the database columns to the UI tiles, and ONLY shows tiles that the seller actually filled out!
  const rawDetails = [
    { id: 'Highlights', title: 'Highlights', content: listing.highlights },
    { id: 'Equipment', title: 'Equipment', content: listing.equipment },
    { id: 'Modifications', title: 'Modifications', content: listing.modifications },
    { id: 'Known Flaws', title: 'Known Flaws', content: listing.known_flaws },
    { id: 'Recent Service History', title: 'Recent Service History', content: listing.recent_service_history },
    { id: 'Other Items Included', title: 'Other Items Included', content: listing.other_items_included },
    { id: 'Ownership History', title: 'Ownership History', content: listing.ownership_history },
    { id: 'Seller Notes', title: 'Seller Notes', content: listing.seller_notes }
  ];

  // Filter out any sections that are null or empty so we don't show blank tiles
  const listingDetails = rawDetails.filter(section => section.content && section.content.trim() !== '');

  const isEnded = timeLeft === 'Auction Ended';
  const hasBids = bidHistory.length > 0;
  const isSold = isEnded && hasBids && currentBid >= listing.reserve_price;
  const reserveNotMet = isEnded && hasBids && currentBid < listing.reserve_price;
  const noBidsEnd = isEnded && !hasBids;

  return (
    <div className="w-full flex flex-col gap-8">
      
      {/* HEADER (Title & Badges at the very top) */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-white/10 pb-6">
        <div>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-white mb-2">
            {listing.make} <span className="text-[#ff5a20]">{listing.model}</span>
          </h1>
          <p className="text-sm md:text-base text-white/70 flex items-center gap-3 font-semibold">
            <span className="bg-white/10 px-3 py-1 rounded-md text-white">{listing.year}</span>
            <span className="bg-white/10 px-3 py-1 rounded-md text-white">{listing.mileage.toLocaleString()} Miles</span>
            <span className="bg-white/10 px-3 py-1 rounded-md text-white">📍 {listing.location}</span>
          </p>
        </div>
        
        <button onClick={toggleWatchlist} disabled={isWatchlistLoading} className={`text-sm font-bold px-6 py-3 rounded-xl transition-all border shadow-lg ${isWatchlisted ? 'bg-[#ff5a20]/20 border-[#ff5a20]/50 text-[#ff5a20]' : 'bg-white/5 border-white/20 text-white hover:bg-white/10 hover:border-white/40'}`}>
          {isWatchlistLoading ? '...' : isWatchlisted ? '★ WATCHING' : '☆ ADD TO GARAGE'}
        </button>
      </div>

      {/* MAIN GRID LAYOUT */}
      <div className="flex flex-col lg:grid lg:grid-cols-12 gap-6 lg:gap-8 relative">
        
        {/* 1. GALLERY (Always First) */}
        <div className="lg:col-start-1 lg:col-span-8 lg:row-start-1 order-1 flex flex-col gap-4 w-full">
          {/* Main Viewer */}
          <div 
            onClick={() => activeImage !== 'video' && setIsLightboxOpen(true)}
            className={`relative rounded-3xl overflow-hidden shadow-2xl aspect-[4/3] sm:aspect-[16/9] w-full bg-black border border-white/10 group flex items-center justify-center ${activeImage !== 'video' ? 'cursor-zoom-in' : ''}`}>
            
            {activeImage === 'video' && youtubeId ? (
              <iframe className="w-full h-full" src={`https://www.youtube.com/embed/${youtubeId}?autoplay=1`} title="YouTube video player" frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen></iframe>
            ) : (
              <>
                <img src={activeImage} alt={`${listing.make} ${listing.model}`} className="object-cover w-full h-full opacity-90 group-hover:opacity-100 transition-opacity duration-300" />
                <div className="absolute bottom-4 right-4 bg-black/60 backdrop-blur-md p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none text-white shadow-lg">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
                </div>
              </>
            )}
          </div>

          {/* Thumbnails */}
          <div className="flex gap-2 overflow-x-auto py-2 custom-scrollbar items-center pb-2">
            {youtubeId && (
              <button onClick={() => setActiveImage('video')} className={`flex-shrink-0 relative w-24 h-16 sm:w-28 sm:h-20 rounded-xl overflow-hidden border-2 transition-all duration-200 flex items-center justify-center bg-black ${activeImage === 'video' ? 'border-[#ff0000] scale-105 shadow-xl shadow-[#ff0000]/20 z-10' : 'border-white/20 opacity-70 hover:opacity-100 hover:border-[#ff0000]'}`}>
                <img src={`https://img.youtube.com/vi/${youtubeId}/mqdefault.jpg`} className="absolute inset-0 w-full h-full object-cover opacity-50" alt="Video Thumbnail" />
                <div className="relative z-10 bg-[#ff0000] text-white w-8 h-6 sm:w-10 sm:h-8 rounded-lg flex items-center justify-center shadow-lg text-xs sm:text-base">▶</div>
              </button>
            )}
            {allImages.map((img, idx) => (
              <button key={idx} onClick={() => setActiveImage(img)} className={`flex-shrink-0 relative w-24 h-16 sm:w-28 sm:h-20 rounded-xl overflow-hidden border-2 transition-all duration-200 ${activeImage === img ? 'border-[#ff5a20] scale-105 shadow-xl shadow-[#ff5a20]/20 z-10' : 'border-transparent opacity-50 hover:opacity-100'}`}>
                <img src={img} alt={`Thumbnail ${idx + 1}`} className="object-cover w-full h-full" />
              </button>
            ))}
          </div>
        </div>

        {/* 2. AUCTION ACTION ZONE (Moved to slot 2 on mobile, stays in Right Column on Desktop) */}
        <div className="lg:col-start-9 lg:col-span-4 lg:row-start-1 lg:row-span-3 order-2 w-full">
          {/* This sticky wrapper follows the user down the page on desktop! */}
          <div className="sticky top-8 flex flex-col gap-6">
            <div className={`border rounded-3xl p-6 md:p-8 backdrop-blur-md shadow-2xl transition-all duration-500 flex flex-col ${isSold ? 'bg-green-500/10 border-green-500/30' : reserveNotMet ? 'bg-red-500/10 border-red-500/30' : 'bg-[#1a0a07] border-[#ff5a20]/30'}`}>
              
              <div className="flex justify-between items-center mb-6 pb-6 border-b border-white/10">
                <div>
                  <p className="text-[10px] sm:text-xs text-white/50 uppercase font-bold tracking-widest mb-1">Time Left</p>
                  <p className={`text-xl sm:text-2xl font-black tracking-tight tabular-nums ${isEnded ? 'text-white/50' : 'text-[#ff5a20]'}`}>{timeLeft}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] sm:text-xs text-white/50 uppercase font-bold tracking-widest mb-1">Title</p>
                  <p className={`font-black text-base sm:text-lg ${listing.title_status === 'Clean' ? 'text-green-400' : 'text-yellow-400'}`}>{listing.title_status}</p>
                </div>
              </div>

              <div className="mb-8">
                <span className="text-[10px] sm:text-xs font-bold text-white/50 tracking-widest uppercase block mb-2">
                  {isSold ? 'Final Selling Price' : reserveNotMet ? 'Final Bid (Reserve Not Met)' : 'Current Bid'}
                </span>
                <span className={`text-4xl sm:text-5xl font-black tracking-tighter ${isSold ? 'text-green-400' : reserveNotMet ? 'text-red-400' : 'text-white'}`}>
                  ${currentBid.toLocaleString()}
                </span>
              </div>

              {!isEnded && (
                <div className="flex flex-col gap-3 mb-6">
                  <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 w-full sm:items-stretch">
                    <input 
                      type="number" 
                      value={bidInput} 
                      onChange={(e) => setBidInput(e.target.value === '' ? '' : Number(e.target.value))} 
                      placeholder={`> $${currentBid.toLocaleString()}`} 
                      disabled={isBidding} 
                      className="w-full sm:flex-1 bg-black/50 border border-white/20 rounded-xl px-4 text-white text-base sm:text-lg font-bold focus:outline-none focus:border-[#ff5a20] disabled:opacity-50 h-14" 
                    />
                    <button 
                      onClick={handlePlaceBid} 
                      disabled={isBidding} 
                      className="w-full sm:w-auto bg-[#ff5a20] hover:bg-[#ff4500] disabled:opacity-50 transition-colors text-white font-extrabold px-6 sm:px-8 rounded-xl shadow-lg shadow-[#ff5a20]/20 tracking-widest text-sm sm:text-base h-14 flex items-center justify-center"
                    >
                      {isBidding ? '...' : 'BID'}
                    </button>
                  </div>
                  {errorMsg && <p className="text-red-400 text-[10px] sm:text-xs font-bold uppercase tracking-wider text-center">{errorMsg}</p>}
                  {successMsg && <p className="text-green-400 text-[10px] sm:text-xs font-bold uppercase tracking-wider text-center">{successMsg}</p>}
                </div>
              )}

              {isSold && (
                <div className="text-center py-4 bg-green-500/20 rounded-xl mt-2 mb-6">
                  <p className="text-green-400 font-extrabold tracking-tight mb-1 text-sm sm:text-base">SOLD TO {bidHistory[0]?.username}</p>
                  <p className="text-white/60 text-[10px] sm:text-xs font-semibold">The seller will contact the winner.</p>
                </div>
              )}
              {reserveNotMet && (
                <div className="text-center py-4 bg-red-500/20 rounded-xl mt-2 mb-6">
                  <p className="text-red-400 font-extrabold tracking-tight mb-1 text-sm sm:text-base">RESERVE NOT MET</p>
                  <p className="text-white/60 text-[10px] sm:text-xs font-semibold">The highest bid fell short.</p>
                </div>
              )}

              <div className="grid grid-cols-3 gap-2 border-t border-white/10 pt-6">
                <div className="flex flex-col items-center justify-center text-center">
                  <span className="text-lg sm:text-xl font-black text-white">{bidHistory.length || 0}</span>
                  <span className="text-[8px] sm:text-[9px] font-bold uppercase tracking-widest text-white/40 mt-1">Bids</span>
                </div>
                <div className="flex flex-col items-center justify-center text-center border-x border-white/10">
                  <span className="text-lg sm:text-xl font-black text-white">{listing.watchers || 0}</span>
                  <span className="text-[8px] sm:text-[9px] font-bold uppercase tracking-widest text-white/40 mt-1">Watchers</span>
                </div>
                <div className="flex flex-col items-center justify-center text-center">
                  <span className="text-lg sm:text-xl font-black text-white">{listing.views || 0}</span>
                  <span className="text-[8px] sm:text-[9px] font-bold uppercase tracking-widest text-white/40 mt-1">Views</span>
                </div>
              </div>
              
              {currentUser && currentUser.id !== listing.seller_id && (
                <button onClick={() => setIsMessageModalOpen(true)} className="w-full mt-6 bg-transparent hover:bg-white/5 border-2 border-white/20 text-white font-bold py-3 sm:py-4 rounded-xl transition-colors tracking-widest text-[10px] sm:text-xs flex items-center justify-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                  MESSAGE SELLER
                </button>
              )}
            </div>
          </div>
        </div>

        {/* 3. FEATURE TILES (Slot 3 on Mobile, Left Column on Desktop) */}
        <div className="lg:col-start-1 lg:col-span-8 lg:row-start-2 order-3 flex flex-col w-full pt-2">
          <h3 className="text-xs sm:text-sm font-bold text-white/50 uppercase tracking-widest mb-4 flex items-center gap-2">
            Vehicle Report
          </h3>
          <div className="flex gap-2 sm:gap-3 overflow-x-auto pb-6 custom-scrollbar">
            {listingDetails.map((section) => (
              <button
                key={section.id}
                onClick={() => setActiveDetailModal(section)}
                className="flex-shrink-0 w-28 h-24 sm:w-32 sm:h-28 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-[#ff5a20]/50 rounded-2xl flex flex-col items-center justify-center p-2 sm:p-3 transition-all group relative overflow-hidden shadow-lg"
              >
                <div className="absolute -inset-1 bg-gradient-to-b from-[#ff5a20]/0 to-[#ff5a20]/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="text-white/50 group-hover:text-[#ff5a20] mb-2 group-hover:scale-110 transition-all duration-300 group-hover:-translate-y-1 relative z-10">
                  {getIconForSection(section.id, false)}
                </div>
                <span className="text-[10px] sm:text-[11px] font-bold text-white/80 group-hover:text-white text-center leading-tight relative z-10 tracking-wide transition-colors">
                  {section.title}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* 4. BID HISTORY (Left Column, Row 3 - wide rectangle) */}
        <div className="lg:col-start-1 lg:col-span-8 lg:row-start-3 order-4 flex flex-col w-full pb-4">
          <div className="bg-black/40 border border-white/10 rounded-3xl p-6 md:p-8 flex flex-col shadow-inner w-full">
            <h3 className="text-xs sm:text-sm font-bold text-white/50 uppercase tracking-widest mb-6 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              Bid History
            </h3>
            
            <div className="overflow-y-auto pr-2 space-y-3 custom-scrollbar max-h-[350px]">
              {bidHistory.length === 0 ? (
                <p className="text-white/30 text-sm font-bold text-center py-10">No bids placed yet.</p>
              ) : (
                bidHistory.map((bid, idx) => (
                  <div key={bid.id} className={`flex justify-between items-center p-4 rounded-2xl border transition-colors ${idx === 0 ? 'bg-[#ff5a20]/10 border-[#ff5a20]/30' : 'bg-white/5 border-white/5'}`}>
                    <div className="flex flex-col items-start gap-1">
                      <Link href={`/user/${bid.bidder_id}`} className="text-white font-bold hover:text-[#ff5a20] hover:underline transition-colors text-sm sm:text-base">
                        {bid.username}
                      </Link>
                      <p className="text-white/40 text-[10px] uppercase font-semibold tracking-wider">
                        {new Date(bid.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <div className={`font-black ${idx === 0 ? 'text-[#ff5a20] text-xl sm:text-2xl' : 'text-white/80 text-lg sm:text-xl'}`}>
                      ${bid.amount.toLocaleString()}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
      {/* MODALS */}
      {activeDetailModal && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md" onClick={() => setActiveDetailModal(null)}>
          <div 
            className="bg-[#1a0a07] border border-white/20 p-6 md:p-8 rounded-3xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-[0_0_50px_rgba(255,90,32,0.15)] relative overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-6 pb-4 border-b border-white/10 shrink-0">
              <h2 className="text-2xl md:text-3xl font-black text-white flex items-center gap-3 tracking-tight">
                <span className="text-[#ff5a20]">{getIconForSection(activeDetailModal.id, true)}</span> 
                {activeDetailModal.title}
              </h2>
              <button onClick={() => setActiveDetailModal(null)} className="text-white/50 hover:text-white bg-white/5 hover:bg-white/10 p-2.5 rounded-full transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="overflow-y-auto custom-scrollbar pr-4 text-white/80 text-sm md:text-base leading-relaxed whitespace-pre-wrap font-medium">
              {activeDetailModal.content}
            </div>
          </div>
        </div>
      )}

      {isMessageModalOpen && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#1a0a07] border border-[#ff5a20]/30 p-6 md:p-8 rounded-3xl w-full max-w-lg shadow-[0_0_40px_rgba(255,90,32,0.15)] relative overflow-hidden">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[150%] h-24 bg-[#ff5a20]/20 blur-[50px] pointer-events-none"></div>
            <div className="relative z-10">
              <h2 className="text-2xl font-black text-white mb-2 tracking-tight">Message the Seller</h2>
              <p className="text-white/60 text-sm mb-6 font-medium">Ask about the {listing.year} {listing.make} {listing.model}, request specific photos, or discuss logistics.</p>
              <textarea value={messageText} onChange={(e) => setMessageText(e.target.value)} placeholder="Hi, I'm highly interested in this bike. Could you tell me more about..." className="w-full h-36 bg-black/50 border border-white/10 rounded-xl p-4 text-white focus:outline-none focus:border-[#ff5a20] transition-colors resize-none mb-6 text-sm"></textarea>
              <div className="flex gap-3">
                <button onClick={() => setIsMessageModalOpen(false)} disabled={isSendingMessage} className="flex-1 bg-white/5 hover:bg-white/10 text-white text-xs font-bold py-4 rounded-xl transition-colors disabled:opacity-50 uppercase tracking-widest">CANCEL</button>
                <button onClick={handleSendMessage} disabled={isSendingMessage || !messageText.trim()} className="flex-1 bg-[#ff5a20] hover:bg-[#ff4500] text-white text-xs font-bold py-4 rounded-xl transition-colors disabled:opacity-50 uppercase tracking-widest">{isSendingMessage ? 'SENDING...' : 'SEND MESSAGE'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
      
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