'use client';
import { useState, useEffect, useCallback } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

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
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const fetchComments = useCallback(async () => {
    // 1. Get the current user so we know if they've already upvoted/flagged
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id || null;
    setCurrentUserId(userId);

    // 2. Fetch the raw comments
    const { data: commentsData } = await supabase
      .from('comments')
      .select('*')
      .eq('listing_id', listingId)
      .order('created_at', { ascending: true });

    if (commentsData && commentsData.length > 0) {
      const commentIds = commentsData.map(c => c.id);
      const userIds = [...new Set(commentsData.map(c => c.user_id))];

      // 3. Parallel fetch: Usernames, Upvotes, and User's past Flags
      const [
        { data: profilesData },
        { data: upvotesData },
        { data: userFlagsData }
      ] = await Promise.all([
        supabase.from('profiles').select('id, username').in('id', userIds),
        supabase.from('comment_upvotes').select('comment_id, user_id').in('comment_id', commentIds),
        userId ? supabase.from('comment_flags').select('comment_id').eq('user_id', userId).in('comment_id', commentIds) : Promise.resolve({ data: [] })
      ]);

      const profileMap: Record<string, string> = {};
      if (profilesData) profilesData.forEach(p => profileMap[p.id] = p.username || 'Unknown Rider');

      const flaggedSet = new Set(userFlagsData?.map(f => f.comment_id) || []);

      // 4. Combine all the data into a rich comment object
      const enrichedComments = commentsData.map(comment => {
        const commentUpvotes = upvotesData?.filter(u => u.comment_id === comment.id) || [];
        return {
          ...comment,
          username: profileMap[comment.user_id] || 'Unknown Rider',
          isSeller: comment.user_id === sellerId,
          upvoteCount: commentUpvotes.length,
          hasUpvoted: userId ? commentUpvotes.some(u => u.user_id === userId) : false,
          hasFlagged: flaggedSet.has(comment.id)
        };
      });

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

    if (!currentUserId) {
      setErrorMsg("You must be logged in to join the discussion.");
      setIsSubmitting(false);
      return;
    }

    const { error } = await supabase
      .from('comments')
      .insert([{ listing_id: listingId, user_id: currentUserId, content: newComment.trim() }]);

    if (error) {
      setErrorMsg("Failed to post comment.");
    } else {
      setNewComment('');
      fetchComments(); 
    }
    setIsSubmitting(false);
  };

  // ACTION: Toggle Upvote (Helpful)
  const handleToggleUpvote = async (commentId: string, hasUpvoted: boolean) => {
    if (!currentUserId) return alert("You must be logged in to upvote.");

    if (hasUpvoted) {
      await supabase.from('comment_upvotes').delete().eq('comment_id', commentId).eq('user_id', currentUserId);
    } else {
      await supabase.from('comment_upvotes').insert([{ comment_id: commentId, user_id: currentUserId }]);
    }
    fetchComments(); // Refresh counts
  };

  // ACTION: Flag for Admin Review
  const handleFlagComment = async (commentId: string) => {
    if (!currentUserId) return alert("You must be logged in to report a comment.");
    
    const reason = window.prompt("Why are you reporting this comment? (Spam, inappropriate, etc.)");
    if (!reason) return; // User cancelled

    const { error } = await supabase
      .from('comment_flags')
      .insert([{ comment_id: commentId, user_id: currentUserId, reason }]);

    if (error) {
      alert("Failed to flag comment. You may have already reported it.");
    } else {
      alert("Comment flagged for admin review. Thank you.");
      fetchComments(); // Refresh to disable the flag button
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto mt-12 bg-black/40 border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
      <div className="bg-white/5 border-b border-white/10 px-8 py-6">
        <h2 className="text-2xl font-extrabold text-white tracking-tight">Live Q&A & Discussion</h2>
        <p className="text-white/50 text-sm font-semibold mt-1">Ask the seller questions about history, condition, and specs.</p>
      </div>

      <div className="p-8 flex flex-col gap-6">
        
        <div className="flex flex-col gap-4">
          {comments.length === 0 ? (
            <div className="text-center py-10 text-white/40 font-bold tracking-wide">
              No comments yet. Be the first to ask a question!
            </div>
          ) : (
            comments.map((comment) => (
              <div key={comment.id} className={`p-5 rounded-2xl border ${comment.isSeller ? 'bg-[#ff5a20]/5 border-[#ff5a20]/30' : 'bg-white/5 border-white/10'}`}>
                
                {/* Header */}
                <div className="flex items-center gap-3 mb-2">
                  <Link href={`/user/${comment.user_id}`} className="font-extrabold text-white hover:text-[#ff5a20] hover:underline transition-colors">
                    {comment.username}
                    </Link>
                  {comment.isSeller && (
                    <span className="bg-[#ff5a20] text-white text-[10px] font-extrabold px-2 py-0.5 rounded uppercase tracking-widest shadow-md shadow-[#ff5a20]/20">
                      Seller
                    </span>
                  )}
                  <span className="text-white/40 text-xs font-semibold">
                    {new Date(comment.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                
                {/* Body */}
                <p className="text-white/80 leading-relaxed text-sm whitespace-pre-wrap mb-4">{comment.content}</p>
                
                {/* Footer Actions (Upvote & Flag) */}
                <div className="flex justify-between items-center border-t border-white/5 pt-3 mt-2">
                  <button 
                    onClick={() => handleToggleUpvote(comment.id, comment.hasUpvoted)}
                    className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-colors flex items-center gap-2 ${
                      comment.hasUpvoted 
                        ? 'bg-[#ff5a20]/20 text-[#ff5a20] hover:bg-[#ff5a20]/30' 
                        : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    ↑ HELPFUL ({comment.upvoteCount})
                  </button>

                  <button 
                    onClick={() => handleFlagComment(comment.id)}
                    disabled={comment.hasFlagged}
                    className="text-xs font-bold text-white/30 hover:text-red-400 transition-colors uppercase tracking-widest disabled:opacity-50 disabled:hover:text-white/30"
                  >
                    {comment.hasFlagged ? 'REPORTED' : '⚑ FLAG'}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

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