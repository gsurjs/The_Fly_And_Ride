'use client';
import { useState, useEffect } from 'react';

export default function LiveTimer({ endsAt }: { endsAt: string }) {
  const [timeLeft, setTimeLeft] = useState('Calculating...');

  useEffect(() => {
    const timer = setInterval(() => {
      const difference = new Date(endsAt).getTime() - new Date().getTime();
      
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

    return () => clearInterval(timer);
  }, [endsAt]);

  return <span className={`tabular-nums ${timeLeft === 'Auction Ended' ? 'text-red-400' : ''}`}>{timeLeft}</span>;
}