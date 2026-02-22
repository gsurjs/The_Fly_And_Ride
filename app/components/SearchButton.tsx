'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function SearchButton({ isMobile }: { isMobile?: boolean }) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const router = useRouter();

  // Handle the "Escape" key to close the modal easily
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // Route to the Browse page with the search query attached to the URL
    if (query.trim()) {
      router.push(`/browse?q=${encodeURIComponent(query)}`);
    } else {
      router.push('/browse'); // If they just hit enter, show them everything
    }
    setIsOpen(false);
    setQuery('');
  };

  return (
    <>
      {/* THE BUTTON THAT LIVES IN THE NAVBAR */}
      <button 
        onClick={() => setIsOpen(true)}
        className={isMobile 
          ? "text-left text-white font-extrabold text-2xl uppercase tracking-tight hover:text-[#ff5a20] transition-colors w-full"
          : "bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold py-2 px-4 rounded-lg transition-colors text-sm tracking-wide uppercase flex items-center gap-2"
        }
      >
        <span>🔍</span> {isMobile ? "Search Auctions" : "Search"}
      </button>

      {/* THE FULLSCREEN MODAL */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-[200] flex items-start justify-center pt-24 px-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200" 
          onClick={() => setIsOpen(false)}
        >
          <div 
            className="w-full max-w-2xl bg-[#1a0a07] border border-white/20 rounded-2xl shadow-2xl overflow-hidden relative transform transition-all"
            onClick={(e) => e.stopPropagation()} // Prevent clicking inside the box from closing the modal
          >
            <form onSubmit={handleSearch} className="flex items-center p-2">
              <div className="pl-6 text-[#ff5a20]">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              
              <input 
                autoFocus
                type="text" 
                placeholder="Search Make, Model, or Keyword..." 
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full bg-transparent text-white text-xl md:text-2xl font-bold p-6 focus:outline-none placeholder:text-white/20"
              />
              
              <div className="pr-6 flex items-center gap-3">
                <button type="button" onClick={() => setIsOpen(false)} className="text-white/40 hover:text-white text-xs font-bold tracking-widest uppercase transition-colors">
                  ESC
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}