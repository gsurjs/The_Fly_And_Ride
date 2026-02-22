'use client';
import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';

export default function MobileMenu({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  // Automatically close the mobile menu whenever the user clicks a link and the route changes
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  return (
    <div className="md:hidden flex items-center">
      <button 
        onClick={() => setIsOpen(!isOpen)} 
        className="text-white hover:text-[#ff5a20] focus:outline-none p-2 transition-colors"
        aria-label="Toggle menu"
      >
        <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          {isOpen ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          )}
        </svg>
      </button>

      {/* The Dropdown Panel */}
      {isOpen && (
        <div className="absolute top-20 left-0 w-full bg-black/95 backdrop-blur-xl border-b border-white/10 shadow-2xl animate-in slide-in-from-top-2 duration-200">
          <div className="flex flex-col px-6 py-8 space-y-6">
            {children}
          </div>
        </div>
      )}
    </div>
  );
}