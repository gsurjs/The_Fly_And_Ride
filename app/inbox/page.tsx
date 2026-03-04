'use client';
import { useState, useEffect, useRef } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function InboxPage() {
  const router = useRouter();
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const [currentUser, setCurrentUser] = useState<any>(null);
  const [conversations, setConversations] = useState<any[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 1. Fetch User & Messages
  const fetchInbox = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/login');
      return;
    }
    setCurrentUser(user);

    // Fetch all messages where the user is either the sender or receiver
    // AND fetch the associated listing data at the same time!
    const { data: messages, error } = await supabase
      .from('messages')
      .select(`
        *,
        listing:listings(id, make, model, year, seller_id, image_url)
      `)
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .order('created_at', { ascending: true });

    if (error) {
      console.error("Error fetching messages:", error);
      setLoading(false);
      return;
    }

    // Group messages into distinct conversations
    // A conversation is unique based on the Listing ID + The "Other" User's ID
    const grouped = new Map();

    messages?.forEach((msg) => {
      const otherUserId = msg.sender_id === user.id ? msg.receiver_id : msg.sender_id;
      const convoKey = `${msg.listing_id}_${otherUserId}`;

      if (!grouped.has(convoKey)) {
        grouped.set(convoKey, {
          id: convoKey,
          listing: msg.listing,
          otherUserId: otherUserId,
          isSeller: msg.listing.seller_id === user.id, // Am I the seller of this bike?
          messages: []
        });
      }
      grouped.get(convoKey).messages.push(msg);
    });

    // Convert Map to Array and sort by the most recent message
    const convoArray = Array.from(grouped.values()).sort((a, b) => {
      const lastMsgA = a.messages[a.messages.length - 1].created_at;
      const lastMsgB = b.messages[b.messages.length - 1].created_at;
      return new Date(lastMsgB).getTime() - new Date(lastMsgA).getTime();
    });

    setConversations(convoArray);
    
    // Auto-select the first conversation if none is selected
    if (convoArray.length > 0 && !activeChatId) {
      setActiveChatId(convoArray[0].id);
    }
    
    setLoading(false);
  };

  useEffect(() => {
    fetchInbox();

    // Real-time listener! Auto-updates when a new message arrives.
    const channel = supabase.channel('realtime_inbox')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => {
        fetchInbox(); // Re-fetch when a new message drops in the database
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  // Auto-scroll to bottom of chat AND Mark as Read
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });

    // Mark messages as read when you open the conversation
    const markAsRead = async () => {
      if (!activeChatId || !currentUser) return;
      
      const activeConvo = conversations.find(c => c.id === activeChatId);
      if (!activeConvo) return;

      // Update all unread messages in this chat where I am the receiver
      await supabase
        .from('messages')
        .update({ is_read: true })
        .eq('listing_id', activeConvo.listing.id)
        .eq('receiver_id', currentUser.id)
        .eq('is_read', false);
    };

    markAsRead();
  }, [activeChatId, conversations, currentUser, supabase]);

  // 2. Send a new message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeChatId || !currentUser) return;

    const activeConvo = conversations.find(c => c.id === activeChatId);
    if (!activeConvo) return;

    const tempMessage = newMessage;
    setNewMessage(''); // Clear input instantly for snappy UI UX

    const { error } = await supabase.from('messages').insert([{
      listing_id: activeConvo.listing.id,
      sender_id: currentUser.id,
      receiver_id: activeConvo.otherUserId,
      content: tempMessage,
    }]);

    if (error) {
      alert("Failed to send message.");
      setNewMessage(tempMessage); // Put it back if it failed
    } else {
      fetchInbox(); // Refresh chat
    }
  };

  if (loading) return <div className="min-h-screen bg-[#6b2a1a] flex items-center justify-center text-[#ff5a20] font-black text-2xl">LOADING INBOX...</div>;

  const activeConvo = conversations.find(c => c.id === activeChatId);

  return (
    <main className="min-h-screen bg-[#6b2a1a] p-4 md:p-10 font-sans flex justify-center items-start">
      <div className="w-full max-w-6xl bg-black/80 rounded-3xl border border-white/10 shadow-2xl backdrop-blur-md overflow-hidden flex flex-col md:flex-row h-[80vh] mt-6">
        
        {/* LEFT SIDEBAR: CONVERSATION LIST */}
        <div className="w-full md:w-1/3 border-b md:border-b-0 md:border-r border-white/10 flex flex-col h-[30vh] md:h-full">
          <div className="p-6 border-b border-white/10 bg-black/40">
            <h1 className="text-2xl font-extrabold text-white tracking-tight">Messages</h1>
          </div>
          
          <div className="overflow-y-auto flex-1 custom-scrollbar">
            {conversations.length === 0 ? (
              <p className="text-white/40 p-6 text-sm font-bold text-center">No messages yet.</p>
            ) : (
              conversations.map((convo) => {
                const lastMessage = convo.messages[convo.messages.length - 1];
                const isActive = convo.id === activeChatId;

                return (
                  <button
                    key={convo.id}
                    onClick={() => setActiveChatId(convo.id)}
                    className={`w-full text-left p-4 border-b border-white/5 transition-colors flex items-center gap-4 ${isActive ? 'bg-[#ff5a20]/10 border-l-4 border-l-[#ff5a20]' : 'hover:bg-white/5 border-l-4 border-l-transparent'}`}
                  >
                    <img src={convo.listing?.image_url || '/placeholder.jpg'} alt="Bike" className="w-12 h-12 rounded-lg object-cover border border-white/20" />
                    <div className="flex-1 overflow-hidden">
                      <p className="text-white font-bold text-sm truncate">{convo.listing?.year} {convo.listing?.make} {convo.listing?.model}</p>
                      <p className={`text-xs font-bold uppercase tracking-wider mb-1 ${convo.isSeller ? 'text-blue-400' : 'text-green-400'}`}>
                        {convo.isSeller ? 'Chat with Buyer' : 'Chat with Seller'}
                      </p>
                      <p className="text-white/50 text-xs truncate">{lastMessage.content}</p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT PANE: ACTIVE CHAT */}
        <div className="w-full md:w-2/3 flex flex-col h-[50vh] md:h-full bg-black/20">
          {!activeConvo ? (
            <div className="flex-1 flex items-center justify-center text-white/30 font-bold">
              Select a conversation to start chatting
            </div>
          ) : (
            <>
              {/* Chat Header */}
              <div className="p-4 border-b border-white/10 bg-black/60 flex justify-between items-center">
                <div>
                  <h2 className="text-white font-black text-lg">{activeConvo.listing?.year} {activeConvo.listing?.make} {activeConvo.listing?.model}</h2>
                  <p className="text-white/50 text-xs font-bold uppercase tracking-widest">{activeConvo.isSeller ? 'Answering Buyer Questions' : 'Talking to Seller'}</p>
                </div>
                <Link href={`/listing/${activeConvo.listing.id}`} className="bg-white/10 hover:bg-white/20 text-white text-xs font-bold px-4 py-2 rounded-lg transition-colors border border-white/10">
                  VIEW LISTING
                </Link>
              </div>

              {/* Chat Messages Area */}
              <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4 custom-scrollbar">
                {activeConvo.messages.map((msg: any) => {
                  const isMe = msg.sender_id === currentUser.id;
                  return (
                    <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[75%] p-4 rounded-2xl ${isMe ? 'bg-[#ff5a20] text-white rounded-br-none' : 'bg-white/10 text-white rounded-bl-none border border-white/10'}`}>
                        <p className="text-sm">{msg.content}</p>
                        <p className="text-[10px] mt-2 opacity-50 font-bold uppercase tracking-wider text-right">
                          {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} /> {/* Auto-scroll target */}
              </div>

              {/* Message Input Box */}
              <div className="p-4 border-t border-white/10 bg-black/40">
                <form onSubmit={handleSendMessage} className="flex gap-2">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type a message..."
                    className="flex-1 bg-white/5 border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:border-[#ff5a20] transition-colors"
                  />
                  <button
                    type="submit"
                    disabled={!newMessage.trim()}
                    className="bg-[#ff5a20] hover:bg-[#ff4500] disabled:opacity-50 disabled:cursor-not-allowed text-white font-extrabold px-6 py-3 rounded-xl transition-colors"
                  >
                    SEND
                  </button>
                </form>
              </div>
            </>
          )}
        </div>

      </div>
    </main>
  );
}