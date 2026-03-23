'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';

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
    const cleanQuery = query.trim(); // Strip all rogue spaces from both ends
    
    if (cleanQuery) {
      router.push(`/browse?q=${encodeURIComponent(cleanQuery)}`);
    } else {
      router.push('/browse'); 
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
          ? "flex items-center gap-3 text-left text-white font-extrabold text-2xl uppercase tracking-tight hover:text-[#ff5a20] transition-colors w-full"
          : "bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold py-2 px-4 rounded-lg transition-colors text-sm tracking-wide uppercase flex items-center gap-2"
        }
      >
        <Search className={isMobile ? "w-6 h-6 stroke-[3]" : "w-4 h-4 stroke-[2.5]"} />
        <span>{isMobile ? "Search Auctions" : "Search"}</span>
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
                onChange={(e) => setQuery(e.target.value.trimStart())} // Prevent leading spaces
                className="w-full bg-transparent text-white text-xl md:text-2xl font-bold p-6 focus:outline-none placeholder:text-white/20"
              />
              
              <div className="pr-6 flex items-center">
                <button 
                  type="button" 
                  onClick={() => setIsOpen(false)} 
                  className="text-white/40 hover:text-red-500 bg-white/5 hover:bg-white/10 p-2 rounded-full transition-colors flex items-center justify-center"
                  aria-label="Close search"
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}