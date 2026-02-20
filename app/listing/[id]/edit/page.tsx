'use client';
import { useState, useEffect, use, Suspense } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';
import imageCompression from 'browser-image-compression';

function EditListingContent({ paramsPromise }: { paramsPromise: Promise<{ id: string }> }) {
  const router = useRouter();
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const resolvedParams = use(paramsPromise);
  const listingId = resolvedParams.id;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
  const [listing, setListing] = useState<any>(null);
  
  // Advanced File Management States
  const [existingGallery, setExistingGallery] = useState<string[]>([]);
  const [newGalleryFiles, setNewGalleryFiles] = useState<{file: File, preview: string}[]>([]);
  const [urlsToDelete, setUrlsToDelete] = useState<string[]>([]);

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

      if (data.seller_id !== user.id) return router.push('/dashboard');

      setListing(data);
      setExistingGallery(data.gallery_urls || []);
      setLoading(false);
    };

    fetchListing();
  }, [listingId, router, supabase]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setListing({ ...listing, [e.target.name]: e.target.value });
  };

  const handleGalleryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const totalCurrentImages = existingGallery.length + newGalleryFiles.length;
    
    if (files.length + totalCurrentImages > 5) {
      alert("You can only have a maximum of 5 gallery images.");
      return;
    }

    const processedFiles: {file: File, preview: string}[] = [];

    for (let file of files) {
      try {
        if (file.type === 'image/heic' || file.name.toLowerCase().endsWith('.heic')) {
          const heic2any = (await import('heic2any')).default;
          const convertedBlob = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.8 });
          const finalBlob = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob;
          file = new File([finalBlob], file.name.replace(/\.heic$/i, '.jpg'), { type: 'image/jpeg' });
        }

        const compressedFile = await imageCompression(file, { maxSizeMB: 1, maxWidthOrHeight: 1920 });
        processedFiles.push({
          file: compressedFile,
          preview: URL.createObjectURL(compressedFile)
        });
      } catch (err) {
        console.error("Compression failed", err);
      }
    }

    setNewGalleryFiles([...newGalleryFiles, ...processedFiles]);
  };

  // NEW: Delete an existing database image
  const handleRemoveExisting = (urlToRemove: string) => {
    setExistingGallery(existingGallery.filter(url => url !== urlToRemove));
    setUrlsToDelete([...urlsToDelete, urlToRemove]); // Queue it for deletion from bucket
  };

  // NEW: Delete a newly selected image before saving
  const handleRemoveNew = (indexToRemove: number) => {
    setNewGalleryFiles(newGalleryFiles.filter((_, idx) => idx !== indexToRemove));
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrorMsg('');

    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw new Error("Authentication failed.");

      // 1. Cost-Saving Step: Delete the removed images from the Supabase Bucket
      if (urlsToDelete.length > 0) {
        for (const url of urlsToDelete) {
          if (url.includes('/motorcycles/')) {
            const fileName = url.split('/motorcycles/').pop();
            if (fileName) {
              await supabase.storage.from('motorcycles').remove([fileName]);
            }
          }
        }
      }

      // 2. Upload any brand new images
      let uploadedNewUrls: string[] = [];
      if (newGalleryFiles.length > 0) {
        for (const item of newGalleryFiles) {
          const fileExt = item.file.name.split('.').pop() || 'jpg';
          const fileName = `${user.id}-${Math.random().toString(36).substring(7)}.${fileExt}`;
          
          const { error: uploadError } = await supabase.storage.from('motorcycles').upload(fileName, item.file);
          if (uploadError) throw new Error(`Failed to upload an image: ${uploadError.message}`);

          const { data } = supabase.storage.from('motorcycles').getPublicUrl(fileName);
          uploadedNewUrls.push(data.publicUrl);
        }
      }

      // 3. Combine remaining existing images with newly uploaded ones
      const finalGalleryUrls = [...existingGallery, ...uploadedNewUrls];

      // 4. Update the Database
      const { error: dbError } = await supabase
        .from('listings')
        .update({
          mileage: Number(listing.mileage),
          location: listing.location,
          title_status: listing.title_status,
          gallery_urls: finalGalleryUrls
        })
        .eq('id', listingId);

      if (dbError) throw new Error(`Database update failed: ${dbError.message}`);

      router.push(`/listing/${listingId}`);
      router.refresh();

    } catch (err: any) {
      console.error("Sequence Failed:", err);
      setErrorMsg(err.message || "An unexpected error occurred.");
      setSaving(false); 
    }
  };

  if (loading) return null;

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
          <h3 className="text-lg font-bold mb-4">Gallery Images ({(existingGallery.length + newGalleryFiles.length)}/5)</h3>
          <div className="grid grid-cols-3 gap-4 mb-4">
            
            {/* Render Existing Images with Delete Buttons */}
            {existingGallery.map((url, idx) => (
              <div key={`existing-${idx}`} className="relative h-24 bg-black rounded-xl border border-white/20 overflow-hidden group">
                <img src={url} alt="Gallery Preview" className="w-full h-full object-cover" />
                <button 
                  type="button"
                  onClick={() => handleRemoveExisting(url)}
                  className="absolute top-1 right-1 bg-red-500/80 hover:bg-red-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  X
                </button>
              </div>
            ))}

            {/* Render Newly Selected Images with Delete Buttons */}
            {newGalleryFiles.map((item, idx) => (
              <div key={`new-${idx}`} className="relative h-24 bg-black rounded-xl border border-[#ff5a20]/50 overflow-hidden group">
                <img src={item.preview} alt="New Preview" className="w-full h-full object-cover opacity-70" />
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                   <span className="text-[10px] font-bold bg-black/60 px-2 py-1 rounded">NEW</span>
                </div>
                <button 
                  type="button"
                  onClick={() => handleRemoveNew(idx)}
                  className="absolute top-1 right-1 bg-red-500/80 hover:bg-red-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity pointer-events-auto"
                >
                  X
                </button>
              </div>
            ))}
            
            {/* Upload Button */}
            {(existingGallery.length + newGalleryFiles.length) < 5 && (
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
          <p className="text-xs text-white/50 font-bold uppercase tracking-wider">Upload or remove detail photos.</p>
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

export default function EditListingPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <main className="min-h-screen bg-[#6b2a1a] p-4 md:p-10 font-sans flex justify-center">
      <Suspense fallback={<div className="w-full max-w-3xl mt-10 text-center text-white font-bold tracking-widest uppercase animate-pulse">Loading Garage Data...</div>}>
        <EditListingContent paramsPromise={params} />
      </Suspense>
    </main>
  );
}