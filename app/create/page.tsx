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
  
  // UPGRADED: Image Upload State (Arrays for multiple files)
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);

  // State to track which item is currently being dragged
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);

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

  // UPGRADED: Processes up to 5 images, including HEIC conversion & compression
  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;

    const remainingSlots = 5 - imageFiles.length;
    if (remainingSlots <= 0) {
      setErrorMsg("You can only upload a maximum of 5 images.");
      return;
    }

    // Convert FileList to Array and cap at 5 images
    const filesArray = Array.from(e.target.files).slice(0, remainingSlots);
    
    const processedFiles: File[] = [];
    const newPreviewUrls: string[] = [];

    for (let file of filesArray) {
      try {
        // 1. Intercept iPhone HEIC/HEIF files
        if (file.type === 'image/heic' || file.name.toLowerCase().endsWith('.heic')) {
          const heic2any = (await import('heic2any')).default; 
          
          const convertedBlob = await heic2any({
            blob: file,
            toType: 'image/jpeg',
            quality: 0.8,
          });
          
          const finalBlob = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob;
          
          file = new File([finalBlob], file.name.replace(/\.heic$/i, '.jpg'), {
            type: 'image/jpeg',
          });
        }

        // 2. Run existing cost-saving compression
        const options = {
          maxSizeMB: 1, 
          maxWidthOrHeight: 1920,
          useWebWorker: true,
        };
        
        const compressedFile = await imageCompression(file, options);
        processedFiles.push(compressedFile);
        newPreviewUrls.push(URL.createObjectURL(compressedFile)); 
        
      } catch (error) {
        console.error("Image processing error for file", file.name, error);
        setErrorMsg("Failed to process one or more images. Please try different photos.");
      }
    }

    // Append to existing arrays instead of overwriting
    setImageFiles(prev => [...prev, ...processedFiles]);
    setPreviewUrls(prev => [...prev, ...newPreviewUrls]);
  };

  // Remove a specific image
  const removeImage = (indexToRemove: number) => {
    setImageFiles(prev => prev.filter((_, idx) => idx !== indexToRemove));
    setPreviewUrls(prev => {
      URL.revokeObjectURL(prev[indexToRemove]); // Clean up memory
      return prev.filter((_, idx) => idx !== indexToRemove);
    });
  };

  // Drag and Drop Handlers for Reordering
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIdx(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault(); // Necessary to allow dropping
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === dropIndex) return;

    const newFiles = [...imageFiles];
    const newPreviews = [...previewUrls];

    // Remove the dragged item and insert it at the drop index
    const [draggedFile] = newFiles.splice(draggedIdx, 1);
    newFiles.splice(dropIndex, 0, draggedFile);

    const [draggedPreview] = newPreviews.splice(draggedIdx, 1);
    newPreviews.splice(dropIndex, 0, draggedPreview);

    setImageFiles(newFiles);
    setPreviewUrls(newPreviews);
    setDraggedIdx(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    if (imageFiles.length === 0) {
      setErrorMsg("Please upload at least one image of the motorcycle.");
      setLoading(false);
      return;
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      setErrorMsg("Authentication failed. Please log in again.");
      setLoading(false);
      return;
    }

    try {
      const uploadedUrls: string[] = [];

      // UPGRADED: Loop through all files and upload them
      for (const file of imageFiles) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${user.id}-${Math.random().toString(36).substring(2)}.${fileExt}`;
        const filePath = `${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('motorcycles')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage
          .from('motorcycles')
          .getPublicUrl(filePath);

        uploadedUrls.push(publicUrlData.publicUrl);
      }

      // Split the URLs: First is the main hero image, the rest go to the gallery array
      const mainImageUrl = uploadedUrls[0];
      const galleryUrls = uploadedUrls.slice(1);

      // Prepare date logic
      const endsAt = new Date();
      endsAt.setDate(endsAt.getDate() + Number(formData.duration_days));

      // Insert the listing data
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
            image_url: mainImageUrl, 
            gallery_urls: galleryUrls, // Add the gallery array to the database
          }
        ]);

      if (insertError) throw insertError;

      router.push('/dashboard');
      router.refresh(); 

    } catch (err: any) {
      setErrorMsg(`Error processing listing: ${err.message}`);
      setLoading(false);
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
          
          {/* UPGRADED: Multi-Image Upload Dropzone & Previews */}
          <div className="flex flex-col gap-4">
            {imageFiles.length < 5 && (
              <div className="bg-white/5 border-2 border-dashed border-white/20 rounded-2xl p-6 text-center hover:border-[#ff5a20] transition-colors relative overflow-hidden group cursor-pointer">
                <div className="py-8">
                  <p className="text-[#ff5a20] font-extrabold text-xl mb-2">
                    Upload Photos ({imageFiles.length}/5)
                  </p>
                  <p className="text-white/50 text-sm font-semibold tracking-wide">
                    Drag and drop, or click to browse.
                  </p>
                </div>
                <input 
                  type="file" 
                  multiple 
                  accept="image/jpeg, image/png, image/webp, .heic" 
                  onChange={handleImageChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
              </div>
            )}

            {/* UPGRADED: Draggable Thumbnail Previews */}
            {previewUrls.length > 0 && (
              <div className="bg-black/40 p-4 rounded-2xl border border-white/10">
                <p className="text-white/50 text-xs font-bold uppercase tracking-widest mb-3">
                  Drag to reorder. The first image is the Main cover.
                </p>
                <div className="flex gap-4 overflow-x-auto py-2 custom-scrollbar items-center">
                  {previewUrls.map((url, idx) => (
                    <div 
                      key={url} 
                      draggable
                      onDragStart={(e) => handleDragStart(e, idx)}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, idx)}
                      className={`relative w-28 h-28 flex-shrink-0 rounded-xl overflow-hidden border-2 cursor-grab active:cursor-grabbing transition-all ${draggedIdx === idx ? 'opacity-50 border-white/50' : idx === 0 ? 'border-[#ff5a20] scale-105 shadow-lg shadow-[#ff5a20]/20' : 'border-white/20 hover:border-white/50'}`}
                    >
                      <img src={url} alt={`Preview ${idx + 1}`} className="object-cover w-full h-full pointer-events-none" />
                      
                      {/* Delete Button */}
                      <button
                        type="button"
                        onClick={() => removeImage(idx)}
                        className="absolute top-1 right-1 bg-black/80 hover:bg-red-500 text-white w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold backdrop-blur-md transition-colors shadow-lg z-10"
                      >
                        ✕
                      </button>

                      {idx === 0 && (
                        <span className="absolute bottom-0 left-0 right-0 bg-black/80 backdrop-blur-md text-[#ff5a20] text-[10px] font-black text-center py-1.5 uppercase tracking-widest z-10">
                          Main
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Form Fields Remain Completely Untouched */}
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