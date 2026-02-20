'use client';
import { useState, useEffect, use, Suspense } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';
import imageCompression from 'browser-image-compression';

// 1. The Inner Component that does the heavy lifting
function EditListingContent({ paramsPromise }: { paramsPromise: Promise<{ id: string }> }) {
  const router = useRouter();
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Safely unwrap the params inside the Suspense shield
  const resolvedParams = use(paramsPromise);
  const listingId = resolvedParams.id;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
  const [listing, setListing] = useState<any>(null);
  const [galleryFiles, setGalleryFiles] = useState<File[]>([]);
  const [galleryPreviews, setGalleryPreviews] = useState<string[]>([]);

  useEffect(() => {
    const fetchListing = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return router.push('/login');

      const { data, error } = await supabase
        .from('listings')
        .select('*')
        .eq('id', listingId)
        .single();

      if (error || !data) {
        setErrorMsg('Listing not found.');
        return;
      }

      if (data.seller_id !== user.id) {
        router.push('/dashboard'); 
        return;
      }

      setListing(data);
      setGalleryPreviews(data.gallery_urls || []);
      setLoading(false);
    };

    fetchListing();
  }, [listingId, router, supabase]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setListing({ ...listing, [e.target.name]: e.target.value });
  };

  const handleGalleryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    
    if (files.length + galleryPreviews.length > 5) {
      alert("You can only have a maximum of 5 gallery images.");
      return;
    }

    const newCompressedFiles: File[] = [];
    const newPreviews: string[] = [];

    for (let file of files) {
      try {
        if (file.type === 'image/heic' || file.name.toLowerCase().endsWith('.heic')) {
          const heic2any = (await import('heic2any')).default;
          const convertedBlob = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.8 });
          const finalBlob = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob;
          file = new File([finalBlob], file.name.replace(/\.heic$/i, '.jpg'), { type: 'image/jpeg' });
        }

        const compressedFile = await imageCompression(file, { maxSizeMB: 1, maxWidthOrHeight: 1920 });
        newCompressedFiles.push(compressedFile);
        newPreviews.push(URL.createObjectURL(compressedFile));
      } catch (err) {
        console.error("Compression failed for a file", err);
      }
    }

    setGalleryFiles([...galleryFiles, ...newCompressedFiles]);
    setGalleryPreviews([...galleryPreviews, ...newPreviews]);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrorMsg('');

    try {
      // 1. Strict Auth Check
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw new Error("Authentication failed. Please log in again.");

      let finalGalleryUrls = [...(listing.gallery_urls || [])];

      // 2. Safe Upload Sequence
      if (galleryFiles.length > 0) {
        for (const file of galleryFiles) {
          // Safeguard against the compression library occasionally dropping the filename
          const originalName = file.name || 'gallery-image.jpg';
          const fileExt = originalName.split('.').pop();
          const fileName = `${user.id}-${Math.random().toString(36).substring(7)}.${fileExt}`;
          
          const { error: uploadError } = await supabase.storage
            .from('motorcycles')
            .upload(fileName, file);

          if (uploadError) {
            console.error("Supabase Storage Error:", uploadError);
            throw new Error(`Failed to upload an image: ${uploadError.message}`);
          }

          const { data } = supabase.storage.from('motorcycles').getPublicUrl(fileName);
          finalGalleryUrls.push(data.publicUrl);
        }
      }

      // 3. Database Transaction
      const { error: dbError } = await supabase
        .from('listings')
        .update({
          mileage: Number(listing.mileage),
          location: listing.location,
          title_status: listing.title_status,
          gallery_urls: finalGalleryUrls
        })
        .eq('id', listingId);

      if (dbError) {
        console.error("PostgreSQL Error:", dbError);
        throw new Error(`Database update failed: ${dbError.message}`);
      }

      // 4. Successful Routing
      router.push(`/listing/${listingId}`);
      router.refresh();

    } catch (err: any) {
      // 5. The Safety Net: Catch the crash, show the user, and unlock the button
      console.error("Sequence Failed:", err);
      setErrorMsg(err.message || "An unexpected error occurred during the update.");
      setSaving(false); 
    }
  };

  if (loading) return null; // Let the Suspense fallback handle the initial load state

  return (
    <div className="w-full max-w-3xl bg-black/80 p-8 md:p-12 rounded-3xl border border-white/10 shadow-2xl backdrop-blur-md mt-10 mb-10">
      <h1 className="text-4xl font-extrabold text-white tracking-tight mb-2">Manage Listing</h1>
      <p className="text-[#ff5a20] font-bold text-lg mb-8">{listing.year} {listing.make} {listing.model}</p>

      {errorMsg && <div className="bg-red-500/20 text-red-400 p-4 rounded-xl mb-6 font-bold">{errorMsg}</div>}

      <form onSubmit={handleUpdate} className="space-y-8 text-white">
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-6 border-b border-white/10">
          <div>
            <label className="block text-xs font-bold text-white/50 uppercase tracking-wider mb-2">Update Mileage</label>
            <input required name="mileage" type="number" min="0" value={listing.mileage} onChange={handleChange}
              className="w-full bg-white/5 border border-white/10 rounded-xl p-3 focus:outline-none focus:border-[#ff5a20] transition-colors" />
          </div>
          <div>
            <label className="block text-xs font-bold text-white/50 uppercase tracking-wider mb-2">Update Location</label>
            <input required name="location" type="text" value={listing.location} onChange={handleChange}
              className="w-full bg-white/5 border border-white/10 rounded-xl p-3 focus:outline-none focus:border-[#ff5a20] transition-colors" />
          </div>
          <div>
            <label className="block text-xs font-bold text-white/50 uppercase tracking-wider mb-2">Title Status</label>
            <select name="title_status" value={listing.title_status} onChange={handleChange}
              className="w-full bg-white/5 border border-white/10 rounded-xl p-3 focus:outline-none focus:border-[#ff5a20] transition-colors appearance-none">
              <option value="Clean" className="bg-black">Clean</option>
              <option value="Rebuilt" className="bg-black">Rebuilt</option>
              <option value="Salvage" className="bg-black">Salvage</option>
            </select>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-bold mb-4">Gallery Images ({galleryPreviews.length}/5)</h3>
          <div className="grid grid-cols-3 gap-4 mb-4">
            {galleryPreviews.map((src, idx) => (
              <div key={idx} className="h-24 bg-black rounded-xl border border-white/20 overflow-hidden">
                <img src={src} alt="Gallery Preview" className="w-full h-full object-cover" />
              </div>
            ))}
            
            {galleryPreviews.length < 5 && (
              <div className="h-24 border-2 border-dashed border-white/20 rounded-xl flex items-center justify-center relative hover:border-[#ff5a20] transition-colors group cursor-pointer">
                <p className="text-white/50 text-2xl group-hover:text-[#ff5a20]">+</p>
                <input 
                  type="file" 
                  multiple 
                  accept="image/jpeg, image/png, image/webp, .heic" 
                  onChange={handleGalleryUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
              </div>
            )}
          </div>
          <p className="text-xs text-white/50 font-bold uppercase tracking-wider">Upload up to 5 additional details photos.</p>
        </div>

        <div className="pt-6">
          <button type="submit" disabled={saving} className="w-full bg-[#ff5a20] hover:bg-[#ff4500] disabled:opacity-50 text-white font-extrabold py-4 rounded-xl transition-colors tracking-wide">
            {saving ? 'UPDATING SECURE LEDGER...' : 'SAVE CHANGES'}
          </button>
        </div>
      </form>
    </div>
  );
}

// 2. The Top-Level Page that protects the build with a Suspense boundary
export default function EditListingPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <main className="min-h-screen bg-[#6b2a1a] p-4 md:p-10 font-sans flex justify-center">
      <Suspense fallback={<div className="w-full max-w-3xl mt-10 text-center text-white font-bold tracking-widest uppercase animate-pulse">Loading Garage Data...</div>}>
        <EditListingContent paramsPromise={params} />
      </Suspense>
    </main>
  );
}