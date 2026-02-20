'use client';
import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';
import imageCompression from 'browser-image-compression';

export default function CreateListing() {
  const router = useRouter();
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
  // Image Upload State
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const [maxYear, setMaxYear] = useState(2027); 

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

  useEffect(() => {
    const currentYear = new Date().getFullYear();
    setFormData((prev) => ({ ...prev, year: currentYear }));
    setMaxYear(currentYear + 1); 
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // The Client-Side Compression Logic
  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      // Configuration to crush the image while maintaining quality
      const options = {
        maxSizeMB: 1, // Compress to max 1MB (keeps your storage costs incredibly low)
        maxWidthOrHeight: 1920, // Max 1080p resolution
        useWebWorker: true,
      };
      
      const compressedFile = await imageCompression(file, options);
      setImageFile(compressedFile);
      setImagePreview(URL.createObjectURL(compressedFile)); // Show the user a preview
    } catch (error) {
      console.error("Compression error:", error);
      setErrorMsg("Failed to process image. Please try a different photo.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    if (!imageFile) {
      setErrorMsg("Please upload an image of the motorcycle.");
      setLoading(false);
      return;
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      setErrorMsg("Authentication failed. Please log in again.");
      setLoading(false);
      return;
    }

    // Step 1: Upload the compressed image to Supabase Storage
    const fileExt = imageFile.name.split('.').pop();
    const fileName = `${user.id}-${Math.random()}.${fileExt}`; // Cryptographically safe, unique filename
    const filePath = `${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('motorcycles')
      .upload(filePath, imageFile);

    if (uploadError) {
      setErrorMsg(`Image Upload Error: ${uploadError.message}`);
      setLoading(false);
      return;
    }

    // Step 2: Get the public URL of the successfully uploaded image
    const { data: publicUrlData } = supabase.storage
      .from('motorcycles')
      .getPublicUrl(filePath);

    const imageUrl = publicUrlData.publicUrl;

    // Step 3: Insert the listing data with the new image URL
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
          image_url: imageUrl, // Mapping the hosted image to the database row
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
      <div className="w-full max-w-3xl bg-black/80 p-8 md:p-12 rounded-3xl border border-white/10 shadow-2xl backdrop-blur-md mt-10 mb-10">
        <h1 className="text-4xl font-extrabold text-white tracking-tight mb-2">List Your Motorcycle</h1>
        <p className="text-white/50 font-semibold uppercase tracking-widest text-xs mb-8">Reach thousands of verified buyers.</p>

        {errorMsg && (
          <div className="bg-red-500/20 border border-red-500/50 text-red-400 p-4 rounded-xl mb-6 font-bold">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8 text-white">
          
          {/* New Image Upload Dropzone */}
          <div className="bg-white/5 border-2 border-dashed border-white/20 rounded-2xl p-6 text-center hover:border-[#ff5a20] transition-colors relative overflow-hidden group">
            {imagePreview ? (
              <div className="relative h-64 w-full">
                <img src={imagePreview} alt="Preview" className="object-cover w-full h-full rounded-xl" />
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity rounded-xl">
                  <p className="font-bold tracking-widest uppercase">Click to Change Photo</p>
                </div>
              </div>
            ) : (
              <div className="py-12">
                <p className="text-[#ff5a20] font-extrabold text-xl mb-2">Upload Primary Photo</p>
                <p className="text-white/50 text-sm font-semibold tracking-wide">High quality landscape images work best.</p>
              </div>
            )}
            <input 
              type="file" 
              accept="image/jpeg, image/png, image/webp" 
              onChange={handleImageChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
          </div>

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
              <input required name="year" type="number" min="1900" max={maxYear} value={formData.year} onChange={handleChange}
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