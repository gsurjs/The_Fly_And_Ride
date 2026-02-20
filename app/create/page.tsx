'use client';
import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';

export default function CreateListing() {
  const router = useRouter();
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // 1. Initialize with a static value to satisfy the strict server compiler
  const [formData, setFormData] = useState({
    make: '',
    model: '',
    year: 2026, 
    mileage: 0,
    location: '',
    title_status: 'Clean',
    reserve_price: 0,
    duration_days: 7,
  });

  // 2. Safely inject the dynamic date ONLY after the browser has hydrated the page
  useEffect(() => {
    setFormData((prev) => ({ ...prev, year: new Date().getFullYear() }));
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      setErrorMsg("Authentication failed. Please log in again.");
      setLoading(false);
      return;
    }

    // Note: new Date() is perfectly safe here because handleSubmit is an event 
    // handler triggered by a click, meaning it only ever runs in the browser.
    const endsAt = new Date();
    endsAt.setDate(endsAt.getDate() + Number(formData.duration_days));

    const { error: insertError } = await supabase
      .from('listings')
      .insert([
        {
          seller_id: user.id,
          make: formData.make,
          model: formData.model,
          year: Number(formData.year),
          mileage: Number(formData.mileage),
          location: formData.location,
          title_status: formData.title_status,
          reserve_price: Number(formData.reserve_price),
          ends_at: endsAt.toISOString(),
        }
      ]);

    if (insertError) {
      setErrorMsg(`Database Error: ${insertError.message}`);
      setLoading(false);
    } else {
      router.push('/dashboard');
      router.refresh(); 
    }
  };

  return (
    <main className="min-h-screen bg-[#6b2a1a] p-4 md:p-10 font-sans flex justify-center">
      <div className="w-full max-w-3xl bg-black/80 p-8 md:p-12 rounded-3xl border border-white/10 shadow-2xl backdrop-blur-md">
        <h1 className="text-4xl font-extrabold text-white tracking-tight mb-2">List Your Motorcycle</h1>
        <p className="text-white/50 font-semibold uppercase tracking-widest text-xs mb-8">Reach thousands of verified buyers.</p>

        {errorMsg && (
          <div className="bg-red-500/20 border border-red-500/50 text-red-400 p-4 rounded-xl mb-6 font-bold">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6 text-white">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-bold text-white/50 uppercase tracking-wider mb-2">Make</label>
              <input required name="make" type="text" placeholder="e.g., Ducati" value={formData.make} onChange={handleChange}
                className="w-full bg-white/5 border border-white/10 rounded-xl p-3 focus:outline-none focus:border-[#ff5a20] transition-colors" />
            </div>
            <div>
              <label className="block text-xs font-bold text-white/50 uppercase tracking-wider mb-2">Model</label>
              <input required name="model" type="text" placeholder="e.g., Panigale V4" value={formData.model} onChange={handleChange}
                className="w-full bg-white/5 border border-white/10 rounded-xl p-3 focus:outline-none focus:border-[#ff5a20] transition-colors" />
            </div>

            <div>
              <label className="block text-xs font-bold text-white/50 uppercase tracking-wider mb-2">Year</label>
              {/* Added a dynamic max attribute to prevent future dates, safely read from the browser */}
              <input required name="year" type="number" min="1900" max={new Date().getFullYear() + 1} value={formData.year} onChange={handleChange}
                className="w-full bg-white/5 border border-white/10 rounded-xl p-3 focus:outline-none focus:border-[#ff5a20] transition-colors" />
            </div>
            <div>
              <label className="block text-xs font-bold text-white/50 uppercase tracking-wider mb-2">Mileage</label>
              <input required name="mileage" type="number" min="0" value={formData.mileage} onChange={handleChange}
                className="w-full bg-white/5 border border-white/10 rounded-xl p-3 focus:outline-none focus:border-[#ff5a20] transition-colors" />
            </div>

            <div>
              <label className="block text-xs font-bold text-white/50 uppercase tracking-wider mb-2">Location</label>
              <input required name="location" type="text" placeholder="e.g., Atlanta, GA" value={formData.location} onChange={handleChange}
                className="w-full bg-white/5 border border-white/10 rounded-xl p-3 focus:outline-none focus:border-[#ff5a20] transition-colors" />
            </div>
            <div>
              <label className="block text-xs font-bold text-white/50 uppercase tracking-wider mb-2">Title Status</label>
              <select name="title_status" value={formData.title_status} onChange={handleChange}
                className="w-full bg-white/5 border border-white/10 rounded-xl p-3 focus:outline-none focus:border-[#ff5a20] transition-colors appearance-none text-white">
                <option value="Clean" className="bg-black">Clean</option>
                <option value="Rebuilt" className="bg-black">Rebuilt</option>
                <option value="Salvage" className="bg-black">Salvage</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-white/50 uppercase tracking-wider mb-2">Reserve Price ($)</label>
              <input required name="reserve_price" type="number" min="0" value={formData.reserve_price} onChange={handleChange}
                className="w-full bg-white/5 border border-white/10 rounded-xl p-3 focus:outline-none focus:border-[#ff5a20] transition-colors" />
            </div>
            <div>
              <label className="block text-xs font-bold text-white/50 uppercase tracking-wider mb-2">Auction Duration</label>
              <select name="duration_days" value={formData.duration_days} onChange={handleChange}
                className="w-full bg-white/5 border border-white/10 rounded-xl p-3 focus:outline-none focus:border-[#ff5a20] transition-colors appearance-none text-white">
                <option value={3} className="bg-black">3 Days</option>
                <option value={5} className="bg-black">5 Days</option>
                <option value={7} className="bg-black">7 Days</option>
                <option value={14} className="bg-black">14 Days</option>
              </select>
            </div>
          </div>

          <div className="pt-6">
            <button type="submit" disabled={loading} className="w-full bg-[#ff5a20] hover:bg-[#ff4500] disabled:opacity-50 text-white font-extrabold py-4 rounded-xl shadow-lg transition-colors text-lg tracking-wide">
              {loading ? 'UPLOADING TO SECURE LEDGER...' : 'SUBMIT MOTORCYCLE FOR AUCTION'}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}