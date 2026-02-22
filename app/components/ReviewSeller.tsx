'use client';
import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';

export default function ReviewSeller({ 
  listingId, 
  sellerId, 
  endDate 
}: { 
  listingId: string, 
  sellerId: string, 
  endDate: string 
}) {
  const router = useRouter();
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const [canReview, setCanReview] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [comment, setComment] = useState('');
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const checkEligibility = async () => {
      // 1. Check if auction is actually over
      if (new Date(endDate).getTime() > new Date().getTime()) {
        setLoading(false);
        return; 
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      // 2. Check if current user is the winning (highest) bidder
      const { data: topBid } = await supabase
        .from('bids')
        .select('user_id')
        .eq('listing_id', listingId)
        .order('amount', { ascending: false })
        .limit(1)
        .single();

        if (!topBid || topBid.user_id !== user.id) {
          setLoading(false);
          return; // User didn't win, hide widget
      }

      // 3. Check if they already left a review for this listing
      const { data: existingReview } = await supabase
        .from('reviews')
        .select('id')
        .eq('listing_id', listingId)
        .eq('reviewer_id', user.id)
        .single();

      if (!existingReview) {
        setCanReview(true); // All checks passed! Reveal the button.
      }
      
      setLoading(false);
    };

    checkEligibility();
  }, [listingId, endDate, supabase]);

  const handleSubmit = async () => {
    if (rating === 0) {
      setErrorMsg("Please select a star rating.");
      return;
    }
    
    setSubmitting(true);
    setErrorMsg('');

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return;

    const { error } = await supabase
      .from('reviews')
      .insert({
        reviewee_id: sellerId,
        reviewer_id: user.id,
        listing_id: listingId,
        rating: rating,
        comment: comment.trim()
      });

    if (error) {
      // Catch the unique constraint if they somehow submit twice
      if (error.code === '23505') {
        setErrorMsg("You have already reviewed this transaction.");
      } else {
        setErrorMsg(error.message);
      }
      setSubmitting(false);
    } else {
      setIsOpen(false);
      setCanReview(false); // Hide widget after successful submission
      router.refresh(); // Refresh the page to show the new data
    }
  };

  if (loading || !canReview) return null; // Completely invisible if they don't meet criteria

  return (
    <>
      {/* THE TRIGGER BUTTON */}
      <div className="bg-green-500/10 border border-green-500/20 p-6 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 mt-8 backdrop-blur-sm">
        <div>
          <h3 className="text-green-400 font-extrabold text-lg uppercase tracking-tight">You won this auction!</h3>
          <p className="text-white/70 text-sm font-semibold">Help the community by rating your experience with the seller.</p>
        </div>
        <button 
          onClick={() => setIsOpen(true)}
          className="bg-green-600 hover:bg-green-500 text-white px-6 py-3 rounded-xl font-bold tracking-wide transition-colors whitespace-nowrap shadow-lg shadow-green-900/20"
        >
          Rate Seller
        </button>
      </div>

      {/* THE MODAL */}
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#1a0a07] border border-white/10 p-8 rounded-3xl w-full max-w-md shadow-2xl relative">
            
            <button onClick={() => setIsOpen(false)} className="absolute top-4 right-4 text-white/40 hover:text-white transition-colors">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>

            <h2 className="text-2xl font-extrabold text-white mb-2">Leave a Review</h2>
            <p className="text-white/50 text-xs uppercase tracking-widest font-bold mb-6">Your feedback is public and permanent.</p>

            {errorMsg && <div className="bg-red-500/20 text-red-400 p-3 rounded-lg mb-4 text-sm font-bold">{errorMsg}</div>}

            {/* Interactive Stars */}
            <div className="flex justify-center gap-2 mb-6">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHovered(star)}
                  onMouseLeave={() => setHovered(0)}
                  className="focus:outline-none transition-transform hover:scale-110"
                >
                  <svg 
                    className={`w-12 h-12 transition-colors ${star <= (hovered || rating) ? 'text-[#ff5a20] fill-current drop-shadow-[0_0_8px_rgba(255,90,32,0.5)]' : 'text-white/10 fill-current'}`} 
                    viewBox="0 0 20 20"
                  >
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                </button>
              ))}
            </div>

            <div className="mb-6">
              <label className="block text-xs font-bold text-white/50 uppercase tracking-wider mb-2">Comment (Optional)</label>
              <textarea 
                rows={3}
                placeholder="Was the vehicle exactly as described? How was communication?"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:border-[#ff5a20] transition-colors resize-none"
              />
            </div>

            <button 
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full bg-[#ff5a20] hover:bg-[#ff4500] disabled:opacity-50 text-white font-extrabold py-3 rounded-xl shadow-lg transition-colors tracking-wide"
            >
              {submitting ? 'SUBMITTING...' : 'SUBMIT REVIEW'}
            </button>
          </div>
        </div>
      )}
    </>
  );
}