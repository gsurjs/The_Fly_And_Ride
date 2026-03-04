'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createBrowserClient } from '@supabase/ssr';

export default function InboxBadge({ isMobile, userId }: { isMobile?: boolean, userId: string }) {
  const [unreadCount, setUnreadCount] = useState(0);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    // 1. Fetch the initial count of unread messages
    const fetchUnread = async () => {
      const { count } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('receiver_id', userId)
        .eq('is_read', false); // Only count unread!
        
      setUnreadCount(count || 0);
    };

    fetchUnread();

    // 2. Real-time listener: Update the badge instantly when a new message hits the database
    const channel = supabase.channel('navbar_notifications')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'messages', 
        filter: `receiver_id=eq.${userId}` // Only listen for messages sent to THIS user
      }, () => {
        fetchUnread(); 
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId, supabase]);

  const mobileClasses = "text-white font-extrabold text-2xl uppercase tracking-tight hover:text-[#ff5a20] transition-colors flex items-center gap-3";
  const desktopClasses = "text-white text-sm font-bold tracking-wide hover:text-[#ff5a20] transition-colors flex items-center gap-2";

  return (
    <Link href="/inbox" className={isMobile ? mobileClasses : desktopClasses}>
      INBOX
      {unreadCount > 0 && (
        <span className={`${isMobile ? 'text-sm px-3 py-1' : 'text-[10px] px-2 py-0.5'} bg-[#ff5a20] text-white font-black rounded-full animate-pulse shadow-lg`}>
          {unreadCount}
        </span>
      )}
    </Link>
  );
}