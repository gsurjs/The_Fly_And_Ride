'use client';
import { useState, useEffect, use, Suspense } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';
import imageCompression from 'browser-image-compression';
import Link from 'next/link';

// NEW: Custom type to handle the draggable mix of existing and new images
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

      setListing(data);
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

  // Unified Image Removal 
  const handleRemoveImage = (indexToRemove: number) => {
    const imgToRemove = images[indexToRemove];
    if (imgToRemove.isExisting) {
      setUrlsToDelete([...urlsToDelete, imgToRemove.url]); // Queue for bucket deletion
    } else {
      URL.revokeObjectURL(imgToRemove.url); // Clean memory for local blobs
    }
    setImages(images.filter((_, idx) => idx !== indexToRemove));
  };

  // Drag and Drop Handlers
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

    if (hasBids && Number(listing.reserve_price) > originalReserve) {
      setErrorMsg("Active bids exist. You may only lower your reserve price, not raise it.");
      setSaving(false);
      return;
    }

    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw new Error("Authentication failed.");

      // 1. Cost-Saving Step: Delete removed images from Supabase Bucket
      if (urlsToDelete.length > 0) {
        for (const url of urlsToDelete) {
          if (url.includes('/motorcycles/')) {
            const fileName = url.split('/motorcycles/').pop();
            if (fileName) await supabase.storage.from('motorcycles').remove([fileName]);
          }
        }
      }

      // 2. Upload new images & preserve existing ones in exact drag-order
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

      // 3. Update the Database
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
          gallery_urls: galleryUrls
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-white/10">
          <div>
            <label className="block text-xs font-bold text-white/50 uppercase tracking-wider mb-2">Make {hasBids && '🔒'}</label>
            <input required name="make" type="text" value={listing.make} onChange={handleChange} disabled={hasBids} className="w-full bg-white/5 border border-white/10 rounded-xl p-3 focus:outline-none focus:border-[#ff5a20] transition-colors disabled:opacity-50" />
          </div>
          <div>
            <label className="block text-xs font-bold text-white/50 uppercase tracking-wider mb-2">Model {hasBids && '🔒'}</label>
            <input required name="model" type="text" value={listing.model} onChange={handleChange} disabled={hasBids} className="w-full bg-white/5 border border-white/10 rounded-xl p-3 focus:outline-none focus:border-[#ff5a20] transition-colors disabled:opacity-50" />
          </div>
          <div>
            <label className="block text-xs font-bold text-white/50 uppercase tracking-wider mb-2">Year {hasBids && '🔒'}</label>
            <input required name="year" type="number" value={listing.year} onChange={handleChange} disabled={hasBids} className="w-full bg-white/5 border border-white/10 rounded-xl p-3 focus:outline-none focus:border-[#ff5a20] transition-colors disabled:opacity-50" />
          </div>
          <div>
            <label className="block text-xs font-bold text-white/50 uppercase tracking-wider mb-2">Title Status {hasBids && '🔒'}</label>
            <select name="title_status" value={listing.title_status} onChange={handleChange} disabled={hasBids} className="w-full bg-white/5 border border-white/10 rounded-xl p-3 focus:outline-none focus:border-[#ff5a20] transition-colors appearance-none text-white disabled:opacity-50">
              <option value="Clean" className="bg-black">Clean</option>
              <option value="Rebuilt" className="bg-black">Rebuilt</option>
              <option value="Salvage" className="bg-black">Salvage</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-white/50 uppercase tracking-wider mb-2">Mileage {hasBids && '🔒'}</label>
            <input required name="mileage" type="number" min="0" value={listing.mileage} onChange={handleChange} disabled={hasBids} className="w-full bg-white/5 border border-white/10 rounded-xl p-3 focus:outline-none focus:border-[#ff5a20] transition-colors disabled:opacity-50" />
          </div>
          <div>
            <label className="block text-xs font-bold text-white/50 uppercase tracking-wider mb-2">Update Location</label>
            <input required name="location" type="text" value={listing.location} onChange={handleChange} className="w-full bg-white/5 border border-white/10 rounded-xl p-3 focus:outline-none focus:border-[#ff5a20] transition-colors" />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-white/50 uppercase tracking-wider mb-2">Reserve Price ($)</label>
            <input required name="reserve_price" type="number" min="0" value={listing.reserve_price} onChange={handleChange} className={`w-full bg-white/5 border border-white/10 rounded-xl p-3 focus:outline-none focus:border-[#ff5a20] transition-colors ${hasBids && Number(listing.reserve_price) > originalReserve ? 'border-red-500 text-red-400 focus:border-red-500' : ''}`} />
            {hasBids && <p className="text-[10px] text-yellow-500/70 uppercase mt-2">Original Reserve: ${originalReserve.toLocaleString()}. You may only lower it.</p>}
          </div>
        </div>

        <div className="pt-6">
          <button type="submit" disabled={saving} className="w-full bg-[#ff5a20] hover:bg-[#ff4500] disabled:opacity-50 text-white font-extrabold py-4 rounded-xl transition-colors tracking-wide shadow-lg">
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
      <Suspense fallback={<div className="w-full max-w-3xl mt-10 text-center text-[#ff5a20] font-bold tracking-widest uppercase animate-pulse">Loading Editor...</div>}>
        <EditListingContent paramsPromise={params} />
      </Suspense>
    </main>
  );
}