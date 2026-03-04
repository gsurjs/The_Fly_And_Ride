'use client';
import { useState, useEffect, use, Suspense } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';
import imageCompression from 'browser-image-compression';
import Link from 'next/link';

// Custom type to handle the draggable mix of existing and new images
type ImageItem = {
  id: string; 
  isExisting: boolean;
  url: string; 
  file?: File; 
};

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
  const [images, setImages] = useState<ImageItem[]>([]);
  const [urlsToDelete, setUrlsToDelete] = useState<string[]>([]);
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);

  // Auction Integrity States
  const [hasBids, setHasBids] = useState(false);
  const [originalReserve, setOriginalReserve] = useState(0);

  // Location Verification States
  const [zipCode, setZipCode] = useState('');
  const [isLocationLocked, setIsLocationLocked] = useState(true); // Default to true since they already have a valid location
  const [locationError, setLocationError] = useState('');

  useEffect(() => {
    const fetchListing = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return router.push('/login');

      // Fetch Listing
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

      // Check for Bids (Auction Integrity Lock)
      const { data: bids } = await supabase
        .from('bids')
        .select('id')
        .eq('listing_id', listingId)
        .limit(1);

      if (bids && bids.length > 0) {
        setHasBids(true);
      }

      // Ensure video_url exists in state even if null in DB
      setListing({ ...data, video_url: data.video_url || '' });
      setOriginalReserve(data.reserve_price || 0);

      // Populate Unified Draggable Grid
      const loadedImages: ImageItem[] = [];
      if (data.image_url) {
        loadedImages.push({ id: 'main-img', isExisting: true, url: data.image_url });
      }
      if (data.gallery_urls) {
        data.gallery_urls.forEach((url: string, idx: number) => {
          loadedImages.push({ id: `gal-img-${idx}`, isExisting: true, url });
        });
      }
      setImages(loadedImages);
      setLoading(false);
    };

    fetchListing();
  }, [listingId, router, supabase]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setListing({ ...listing, [e.target.name]: e.target.value });
  };

  // Verify Zip Code Logic
  const verifyZipCode = async () => {
    setLocationError('');
    if (zipCode.trim().length !== 5) {
      setLocationError('Please enter a valid 5-digit US Zip Code.');
      return;
    }

    try {
      const response = await fetch(`https://api.zippopotam.us/us/${zipCode}`);
      
      if (!response.ok) {
        setLocationError('Invalid US Zip Code. Please try again.');
        setIsLocationLocked(false);
        return;
      }
      
      const data = await response.json();
      const place = data.places[0];
      
      const formattedLocation = `${place['place name']}, ${place['state abbreviation']}`;
      
      setListing((prev: any) => ({ ...prev, location: formattedLocation }));
      setIsLocationLocked(true);
      
    } catch (err) {
      setLocationError('Network error. Could not verify Zip Code.');
    }
  };

  const handleGalleryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const remainingSlots = 5 - images.length;
    
    if (files.length > remainingSlots) {
      alert(`You can only add ${remainingSlots} more image(s) to reach the 5 maximum.`);
      return;
    }

    const newImageItems: ImageItem[] = [];

    for (let file of files) {
      try {
        if (file.type === 'image/heic' || file.name.toLowerCase().endsWith('.heic')) {
          const heic2any = (await import('heic2any')).default;
          const convertedBlob = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.8 });
          const finalBlob = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob;
          file = new File([finalBlob], file.name.replace(/\.heic$/i, '.jpg'), { type: 'image/jpeg' });
        }

        const compressedFile = await imageCompression(file, { maxSizeMB: 1, maxWidthOrHeight: 1920 });
        newImageItems.push({
          id: `new-${Math.random().toString(36).substring(7)}`,
          isExisting: false,
          url: URL.createObjectURL(compressedFile),
          file: compressedFile
        });
      } catch (err) {
        console.error("Compression failed", err);
      }
    }

    setImages([...images, ...newImageItems]);
  };

  const handleRemoveImage = (indexToRemove: number) => {
    const imgToRemove = images[indexToRemove];
    if (imgToRemove.isExisting) {
      setUrlsToDelete([...urlsToDelete, imgToRemove.url]); 
    } else {
      URL.revokeObjectURL(imgToRemove.url); 
    }
    setImages(images.filter((_, idx) => idx !== indexToRemove));
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIdx(index);
    e.dataTransfer.effectAllowed = 'move';
  };
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };
  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === dropIndex) return;
    const newImages = [...images];
    const [draggedItem] = newImages.splice(draggedIdx, 1);
    newImages.splice(dropIndex, 0, draggedItem);
    setImages(newImages);
    setDraggedIdx(null);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrorMsg('');

    if (images.length === 0) {
      setErrorMsg("You must have at least one image.");
      setSaving(false);
      return;
    }

    if (!isLocationLocked) {
      setErrorMsg("Please verify your US Zip Code before saving.");
      setSaving(false);
      return;
    }

    if (hasBids && Number(listing.reserve_price) > originalReserve) {
      setErrorMsg("Active bids exist. You may only lower your reserve price, not raise it.");
      setSaving(false);
      return;
    }

    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw new Error("Authentication failed.");

      if (urlsToDelete.length > 0) {
        for (const url of urlsToDelete) {
          if (url.includes('/motorcycles/')) {
            const fileName = url.split('/motorcycles/').pop();
            if (fileName) await supabase.storage.from('motorcycles').remove([fileName]);
          }
        }
      }

      const finalUrls: string[] = [];
      for (const item of images) {
        if (item.isExisting) {
          finalUrls.push(item.url);
        } else if (item.file) {
          const fileExt = item.file.name.split('.').pop() || 'jpg';
          const fileName = `${user.id}-${Math.random().toString(36).substring(7)}.${fileExt}`;
          const { error: uploadError } = await supabase.storage.from('motorcycles').upload(fileName, item.file);
          if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);
          const { data } = supabase.storage.from('motorcycles').getPublicUrl(fileName);
          finalUrls.push(data.publicUrl);
        }
      }

      const mainImageUrl = finalUrls[0];
      const galleryUrls = finalUrls.slice(1);

      const { error: dbError } = await supabase
        .from('listings')
        .update({
          make: listing.make,
          model: listing.model,
          year: Number(listing.year),
          mileage: Number(listing.mileage),
          location: listing.location,
          title_status: listing.title_status,
          reserve_price: Number(listing.reserve_price),
          image_url: mainImageUrl,
          gallery_urls: galleryUrls,
          video_url: listing.video_url, // Update the video URL
          highlights: listing.highlights,
          equipment: listing.equipment,
          modifications: listing.modifications,
          known_flaws: listing.known_flaws,
          recent_service_history: listing.recent_service_history,
          other_items_included: listing.other_items_included,
          ownership_history: listing.ownership_history,
          seller_notes: listing.seller_notes
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
      
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-4xl font-extrabold text-white tracking-tight mb-2">Manage Listing</h1>
          <p className="text-white/50 font-semibold uppercase tracking-widest text-xs">Update your vehicle details and media.</p>
        </div>
        <Link href="/dashboard" className="text-white/50 hover:text-white font-bold text-sm bg-white/5 px-4 py-2 rounded-lg transition-colors border border-white/10">
          Cancel
        </Link>
      </div>

      {hasBids && (
        <div className="bg-yellow-500/20 border border-yellow-500/50 text-yellow-500 p-4 rounded-xl mb-8 font-bold text-sm flex items-center gap-3">
          <span className="text-xl">🔒</span>
          <div>
            <p>Active bids have been placed.</p>
            <p className="text-yellow-500/70 text-xs font-semibold">Make, Model, Year, Mileage, and Title are locked. Reserve price can only be lowered.</p>
          </div>
        </div>
      )}

      {errorMsg && <div className="bg-red-500/20 text-red-400 p-4 rounded-xl mb-6 font-bold">{errorMsg}</div>}

      <form onSubmit={handleUpdate} className="space-y-8 text-white">
        
        {/* DRAG AND DROP IMAGE MANAGER */}
        <div className="flex flex-col gap-4">
          <h3 className="text-lg font-bold mb-2">Gallery Images ({images.length}/5)</h3>
          
          {images.length < 5 && (
            <div className="bg-white/5 border-2 border-dashed border-white/20 rounded-2xl p-6 text-center hover:border-[#ff5a20] transition-colors relative overflow-hidden group cursor-pointer">
              <div className="py-2">
                <p className="text-[#ff5a20] font-extrabold text-lg mb-1">Add Photos</p>
                <p className="text-white/50 text-xs font-semibold tracking-wide">Drag and drop new images here.</p>
              </div>
              <input type="file" multiple accept="image/jpeg, image/png, image/webp, .heic" onChange={handleGalleryUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
            </div>
          )}

          {images.length > 0 && (
            <div className="bg-black/40 p-4 rounded-2xl border border-white/10">
              <p className="text-white/50 text-xs font-bold uppercase tracking-widest mb-3">Drag to reorder. The first image is the Main cover.</p>
              <div className="flex gap-4 overflow-x-auto py-2 custom-scrollbar items-center">
                {images.map((img, idx) => (
                  <div 
                    key={img.id} draggable onDragStart={(e) => handleDragStart(e, idx)} onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, idx)}
                    className={`relative w-28 h-28 flex-shrink-0 rounded-xl overflow-hidden border-2 cursor-grab active:cursor-grabbing transition-all ${draggedIdx === idx ? 'opacity-50 border-white/50' : idx === 0 ? 'border-[#ff5a20] scale-105 shadow-lg shadow-[#ff5a20]/20' : 'border-white/20 hover:border-white/50'}`}
                  >
                    <img src={img.url} alt={`Preview ${idx}`} className="object-cover w-full h-full pointer-events-none" />
                    
                    {!img.isExisting && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                         <span className="text-[10px] font-bold bg-black/60 px-2 py-1 rounded">NEW</span>
                      </div>
                    )}
                    
                    <button type="button" onClick={() => handleRemoveImage(idx)} className="absolute top-1 right-1 bg-black/80 hover:bg-red-500 text-white w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold backdrop-blur-md transition-colors shadow-lg z-10">✕</button>

                    {idx === 0 && <span className="absolute bottom-0 left-0 right-0 bg-black/80 backdrop-blur-md text-[#ff5a20] text-[10px] font-black text-center py-1.5 uppercase tracking-widest z-10">Main</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* YouTube Video Link Field */}
        <div className="md:col-span-2 bg-white/5 border border-white/10 rounded-2xl p-6">
          <label className="block text-xs font-bold text-white/50 uppercase tracking-wider mb-2 flex items-center gap-2">
            <span className="text-[#ff0000]">▶</span> YouTube Walkaround / Cold Start Link <span className="text-white/30 lowercase normal-case text-[10px]">(Optional)</span>
          </label>
          <input 
            name="video_url" 
            type="url" 
            placeholder="e.g., https://www.youtube.com/watch?v=..." 
            value={listing.video_url} 
            onChange={handleChange}
            className="w-full bg-black/50 border border-white/10 rounded-xl p-3 focus:outline-none focus:border-[#ff0000] transition-colors" 
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-white/10">
          {/* Permanently Locked Core Identity Fields */}
          <div>
            <label className="block text-xs font-bold text-white/50 uppercase tracking-wider mb-2">Make 🔒</label>
            <input 
              readOnly 
              name="make" 
              type="text" 
              value={listing.make} 
              className="w-full bg-black/30 border border-white/5 text-white/50 rounded-xl p-3 cursor-not-allowed font-bold" 
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-white/50 uppercase tracking-wider mb-2">Model 🔒</label>
            <input 
              readOnly 
              name="model" 
              type="text" 
              value={listing.model} 
              className="w-full bg-black/30 border border-white/5 text-white/50 rounded-xl p-3 cursor-not-allowed font-bold" 
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-white/50 uppercase tracking-wider mb-2">Year 🔒</label>
            <input 
              readOnly 
              name="year" 
              type="number" 
              value={listing.year} 
              className="w-full bg-black/30 border border-white/5 text-white/50 rounded-xl p-3 cursor-not-allowed font-bold" 
            />
          </div>

          {/* Flexible Fields (Locked ONLY if bids exist) */}
          <div>
            <label className="block text-xs font-bold text-white/50 uppercase tracking-wider mb-2">Title Status {hasBids && '🔒'}</label>
            <select 
              name="title_status" 
              value={listing.title_status} 
              onChange={handleChange} 
              disabled={hasBids} 
              className="w-full bg-white/5 border border-white/10 rounded-xl p-3 focus:outline-none focus:border-[#ff5a20] transition-colors appearance-none text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="Clean" className="bg-black">Clean</option>
              <option value="Rebuilt" className="bg-black">Rebuilt</option>
              <option value="Salvage" className="bg-black">Salvage</option>
              <option value="Import" className="bg-black">Import / Grey Market</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-white/50 uppercase tracking-wider mb-2">Mileage {hasBids && '🔒'}</label>
            <input 
              required 
              name="mileage" 
              type="number" 
              min="0" 
              value={listing.mileage} 
              onChange={handleChange} 
              disabled={hasBids} 
              className="w-full bg-white/5 border border-white/10 rounded-xl p-3 focus:outline-none focus:border-[#ff5a20] transition-colors disabled:opacity-50 disabled:cursor-not-allowed" 
            />
          </div>
          
          {/* Verified US Location Field */}
          <div className="md:col-span-2 lg:col-span-1">
            <label className="block text-xs font-bold text-white/50 uppercase tracking-wider mb-2">
              Location (US Only) {isLocationLocked && '🔒'}
            </label>
            <div className="flex gap-2">
              {!isLocationLocked ? (
                <>
                  <input 
                    type="text" 
                    placeholder="5-digit Zip Code" 
                    maxLength={5}
                    value={zipCode} 
                    onChange={(e) => {
                      setZipCode(e.target.value.replace(/[^0-9]/g, ''));
                      setLocationError('');
                    }}
                    className="w-1/2 bg-white/5 border border-white/10 rounded-xl p-3 focus:outline-none focus:border-[#ff5a20] transition-colors" 
                  />
                  <button 
                    type="button" 
                    onClick={verifyZipCode}
                    disabled={zipCode.length !== 5}
                    className="w-1/2 bg-white hover:bg-gray-200 text-black font-extrabold px-4 py-3 rounded-xl transition-colors disabled:opacity-50"
                  >
                    VERIFY
                  </button>
                </>
              ) : (
                <>
                  <input 
                    readOnly 
                    type="text" 
                    value={listing.location} 
                    className="w-3/4 bg-green-500/10 border border-green-500/30 text-green-400 font-bold rounded-xl p-3 focus:outline-none cursor-not-allowed" 
                  />
                  <button 
                    type="button" 
                    onClick={() => {
                      setIsLocationLocked(false);
                      setZipCode('');
                      setListing({ ...listing, location: '' });
                    }}
                    className="w-1/4 bg-red-500/20 hover:bg-red-500/40 text-red-400 border border-red-500/30 font-bold rounded-xl transition-colors"
                  >
                    RESET
                  </button>
                </>
              )}
            </div>
            {locationError && <p className="text-red-400 text-xs mt-2 font-bold">{locationError}</p>}
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-white/50 uppercase tracking-wider mb-2">Reserve Price ($)</label>
            <input required name="reserve_price" type="number" min="0" value={listing.reserve_price} onChange={handleChange} className={`w-full bg-white/5 border border-white/10 rounded-xl p-3 focus:outline-none focus:border-[#ff5a20] transition-colors ${hasBids && Number(listing.reserve_price) > originalReserve ? 'border-red-500 text-red-400 focus:border-red-500' : ''}`} />
            {hasBids && <p className="text-[10px] text-yellow-500/70 uppercase mt-2">Original Reserve: ${originalReserve.toLocaleString()}. You may only lower it.</p>}
          </div>
        </div>

        <div className="pt-6">
          <button type="submit" disabled={saving || !isLocationLocked} className="w-full bg-[#ff5a20] hover:bg-[#ff4500] disabled:opacity-50 text-white font-extrabold py-4 rounded-xl transition-colors tracking-wide shadow-lg">
            {!isLocationLocked ? 'VERIFY ZIP CODE TO CONTINUE' : saving ? 'UPDATING SECURE LEDGER...' : 'SAVE CHANGES'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function EditListingPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <main className="min-h-screen bg-[#6b2a1a] p-4 md:p-10 font-sans flex justify-center">
      <Suspense fallback={<div className="w-full max-w-3xl mt-10 text-center text-[#ff5a20] font-bold tracking-widest uppercase animate-pulse">Loading Editor...</div>}>
        <EditListingContent paramsPromise={params} />
      </Suspense>
    </main>
  );
}