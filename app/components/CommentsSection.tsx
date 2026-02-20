'use client';
import { useState, useEffect, useCallback } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';

interface CommentsProps {
  listingId: string;
  sellerId: string;
}

export default function CommentsSection({ listingId, sellerId }: CommentsProps) {
  const router = useRouter();
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const fetchComments = useCallback(async () => {
    // 1. Fetch the raw comments
    const { data: commentsData } = await supabase
      .from('comments')
      .select('*')
      .eq('listing_id', listingId)
      .order('created_at', { ascending: true }); // Oldest first, reading top to bottom

    if (commentsData && commentsData.length > 0) {
      // 2. Extract unique user IDs and fetch their usernames
      const userIds = [...new Set(commentsData.map(c => c.user_id))];
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, username')
        .in('id', userIds);

      const profileMap: Record<string, string> = {};
      if (profilesData) {
        profilesData.forEach(p => profileMap[p.id] = p.username || 'Unknown Rider');
      }

      // 3. Combine the data
      const enrichedComments = commentsData.map(comment => ({
        ...comment,
        username: profileMap[comment.user_id] || 'Unknown Rider',
        isSeller: comment.user_id === sellerId
      }));

      setComments(enrichedComments);
    } else {
      setComments([]);
    }
  }, [listingId, sellerId, supabase]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    setIsSubmitting(true);
    setErrorMsg('');

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      setErrorMsg("You must be logged in to join the discussion.");
      setIsSubmitting(false);
      return;
    }

    const { error } = await supabase
      .from('comments')
      .insert([{
        listing_id: listingId,
        user_id: user.id,
        content: newComment.trim()
      }]);

    if (error) {
      setErrorMsg("Failed to post comment. Please try again.");
    } else {
      setNewComment('');
      fetchComments(); // Instantly reload the thread
    }

    setIsSubmitting(false);
  };

  return (
    <div className="w-full max-w-5xl mx-auto mt-12 bg-black/40 border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
      <div className="bg-white/5 border-b border-white/10 px-8 py-6">
        <h2 className="text-2xl font-extrabold text-white tracking-tight">Live Q&A & Discussion</h2>
        <p className="text-white/50 text-sm font-semibold mt-1">Ask the seller questions about history, condition, and specs.</p>
      </div>

      <div className="p-8 flex flex-col gap-6">
        
        {/* The Comment Thread */}
        <div className="flex flex-col gap-4">
          {comments.length === 0 ? (
            <div className="text-center py-10 text-white/40 font-bold tracking-wide">
              No comments yet. Be the first to ask a question!
            </div>
          ) : (
            comments.map((comment) => (
              <div key={comment.id} className={`p-5 rounded-2xl border ${comment.isSeller ? 'bg-[#ff5a20]/5 border-[#ff5a20]/30' : 'bg-white/5 border-white/10'}`}>
                <div className="flex items-center gap-3 mb-2">
                  <span className="font-extrabold text-white">{comment.username}</span>
                  {comment.isSeller && (
                    <span className="bg-[#ff5a20] text-white text-[10px] font-extrabold px-2 py-0.5 rounded uppercase tracking-widest shadow-md shadow-[#ff5a20]/20">
                      Seller
                    </span>
                  )}
                  <span className="text-white/40 text-xs font-semibold">
                    {new Date(comment.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p className="text-white/80 leading-relaxed text-sm whitespace-pre-wrap">{comment.content}</p>
              </div>
            ))
          )}
        </div>

        {/* The Input Form */}
        <form onSubmit={handleSubmit} className="mt-4 pt-6 border-t border-white/10">
          {errorMsg && <p className="text-red-400 text-xs font-bold mb-3 uppercase tracking-wider">{errorMsg}</p>}
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Ask a question or share your knowledge..."
            disabled={isSubmitting}
            className="w-full bg-black/50 border border-white/20 rounded-xl p-4 text-white placeholder:text-white/30 focus:outline-none focus:border-[#ff5a20] transition-colors resize-none h-28 min-h-[7rem]"
          />
          <div className="flex justify-end mt-3">
            <button
              type="submit"
              disabled={isSubmitting || !newComment.trim()}
              className="bg-white text-black hover:bg-gray-200 disabled:opacity-50 disabled:hover:bg-white font-extrabold px-8 py-3 rounded-xl transition-colors tracking-wide shadow-lg"
            >
              {isSubmitting ? 'POSTING...' : 'POST COMMENT'}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}