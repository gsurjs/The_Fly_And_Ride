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
  const [isSubmitted, setIsSubmitted] = useState(false);
  
  // NHTSA VIN DECODING STATE
  const [isDecoding, setIsDecoding] = useState(false);
  const [vinError, setVinError] = useState('');
  const [isVinLocked, setIsVinLocked] = useState(false); // Locks the Make/Model/Year inputs
  
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);

  const [formData, setFormData] = useState({
    vin: '',
    make: '',
    model: '',
    year: 2026, 
    mileage: 0,
    location: '',
    title_status: 'Clean',
    reserve_price: 0,
    duration_days: 7,
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // NHTSA API DECODER FUNCTION
  const decodeVIN = async () => {
    setVinError('');
    if (formData.vin.trim().length !== 17) {
      setVinError("VIN must be exactly 17 characters to decode.");
      return;
    }

    setIsDecoding(true);
    try {
      // Free US Gov API. No key required.
      const response = await fetch(`https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${formData.vin.toUpperCase()}?format=json`);
      const data = await response.json();
      
      const result = data.Results[0];

      // If NHTSA can't find the Make, the VIN is invalid or not in the US database
      if (!result.Make || result.ErrorCode !== "0") {
        setVinError(result.ErrorText || "Invalid VIN or vehicle not found in database.");
        setIsVinLocked(false);
        setIsDecoding(false);
        return;
      }

      // Check if it is actually a motorcycle
      if (result.VehicleType && result.VehicleType.toUpperCase() !== 'MOTORCYCLE') {
        setVinError(`Invalid vehicle type: ${result.VehicleType}. FLY&RIDE is exclusively for motorcycles.`);
        setIsVinLocked(false);
        setIsDecoding(false);
        return;
      }

      // Title-case the Make (e.g., DUCATI -> Ducati)
      const formattedMake = result.Make.charAt(0).toUpperCase() + result.Make.slice(1).toLowerCase();

      setFormData(prev => ({
        ...prev,
        make: formattedMake,
        model: result.Model,
        year: parseInt(result.ModelYear) || prev.year,
      }));
      
      setIsVinLocked(true); // Lock the fields so the user can't fake it

    } catch (err) {
      setVinError("Network error. Could not reach the VIN database.");
    }
    setIsDecoding(false);
  };

  // ... (Image Upload & Drag/Drop Handlers remain exactly the same) ...
  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const remainingSlots = 5 - imageFiles.length;
    if (remainingSlots <= 0) {
      setErrorMsg("Maximum 5 images allowed.");
      return;
    }

    const filesArray = Array.from(e.target.files).slice(0, remainingSlots);
    const processedFiles: File[] = [];
    const newPreviewUrls: string[] = [];

    for (let file of filesArray) {
      try {
        if (file.type === 'image/heic' || file.name.toLowerCase().endsWith('.heic')) {
          const heic2any = (await import('heic2any')).default; 
          const convertedBlob = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.8 });
          const finalBlob = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob;
          file = new File([finalBlob], file.name.replace(/\.heic$/i, '.jpg'), { type: 'image/jpeg' });
        }
        const options = { maxSizeMB: 1, maxWidthOrHeight: 1920, useWebWorker: true };
        const compressedFile = await imageCompression(file, options);
        processedFiles.push(compressedFile);
        newPreviewUrls.push(URL.createObjectURL(compressedFile)); 
      } catch (error) {
        setErrorMsg("Failed to process one or more images.");
      }
    }
    setImageFiles(prev => [...prev, ...processedFiles]);
    setPreviewUrls(prev => [...prev, ...newPreviewUrls]);
  };

  const removeImage = (idx: number) => {
    setImageFiles(prev => prev.filter((_, i) => i !== idx));
    setPreviewUrls(prev => {
      URL.revokeObjectURL(prev[idx]);
      return prev.filter((_, i) => i !== idx);
    });
  };

  const handleDragStart = (e: React.DragEvent, index: number) => { setDraggedIdx(index); e.dataTransfer.effectAllowed = 'move'; };
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; };
  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === dropIndex) return;
    const newFiles = [...imageFiles]; const newPreviews = [...previewUrls];
    const [draggedFile] = newFiles.splice(draggedIdx, 1); newFiles.splice(dropIndex, 0, draggedFile);
    const [draggedPreview] = newPreviews.splice(draggedIdx, 1); newPreviews.splice(dropIndex, 0, draggedPreview);
    setImageFiles(newFiles); setPreviewUrls(newPreviews); setDraggedIdx(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    if (!isVinLocked) {
      setErrorMsg("You must decode and verify your VIN before submitting.");
      setLoading(false);
      return;
    }

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
      for (const file of imageFiles) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${user.id}-${Math.random().toString(36).substring(2)}.${fileExt}`;
        const { error: uploadError } = await supabase.storage.from('motorcycles').upload(fileName, file);
        if (uploadError) throw uploadError;
        const { data: publicUrlData } = supabase.storage.from('motorcycles').getPublicUrl(fileName);
        uploadedUrls.push(publicUrlData.publicUrl);
      }

      const endsAt = new Date();
      endsAt.setDate(endsAt.getDate() + Number(formData.duration_days));

      const { error: insertError } = await supabase
        .from('listings')
        .insert([{
          seller_id: user.id,
          make: formData.make,
          model: formData.model,
          year: Number(formData.year),
          mileage: Number(formData.mileage),
          location: formData.location,
          title_status: formData.title_status,
          reserve_price: Number(formData.reserve_price),
          ends_at: endsAt.toISOString(),
          image_url: uploadedUrls[0], 
          gallery_urls: uploadedUrls.slice(1),
          vin: formData.vin.toUpperCase(),
          status: 'pending'
        }]);

      if (insertError) throw insertError;

      setIsSubmitted(true);
      setLoading(false);

    } catch (err: any) {
      setErrorMsg(`Error processing listing: ${err.message}`);
      setLoading(false);
    }
  };

  if (isSubmitted) {
    return (
      <main className="min-h-screen bg-[#6b2a1a] p-4 md:p-10 font-sans flex justify-center items-center">
        <div className="w-full max-w-xl bg-black/80 p-8 md:p-12 rounded-3xl border border-white/10 shadow-2xl backdrop-blur-md text-center">
          <div className="text-6xl mb-6">⏳</div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight mb-4">Listing Submitted!</h1>
          <p className="text-white/70 mb-8 font-medium">
            Your verified motorcycle has been sent to our moderation team. You will see it in your garage once approved.
          </p>
          <button 
            onClick={() => { router.push('/dashboard'); router.refresh(); }}
            className="bg-[#ff5a20] hover:bg-[#ff4500] text-white font-bold py-3 px-8 rounded-full transition-colors uppercase tracking-widest"
          >
            Go to My Garage
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#6b2a1a] p-4 md:p-10 font-sans flex justify-center">
      <div className="w-full max-w-3xl bg-black/80 p-8 md:p-12 rounded-3xl border border-white/10 shadow-2xl backdrop-blur-md mt-10 mb-10">
        <h1 className="text-4xl font-extrabold text-white tracking-tight mb-2">List Your Motorcycle</h1>
        <p className="text-white/50 font-semibold uppercase tracking-widest text-xs mb-8">Reach thousands of verified buyers.</p>

        {errorMsg && <div className="bg-red-500/20 border border-red-500/50 text-red-400 p-4 rounded-xl mb-6 font-bold">{errorMsg}</div>}
        {vinError && <div className="bg-yellow-500/20 border border-yellow-500/50 text-yellow-500 p-4 rounded-xl mb-6 font-bold">{vinError}</div>}

        <form onSubmit={handleSubmit} className="space-y-8 text-white">
          
          {/* VIN Decoder Section */}
          <div className="bg-white/5 border border-[#ff5a20]/30 p-6 rounded-2xl">
            <label className="block text-xs font-bold text-[#ff5a20] uppercase tracking-wider mb-2">
              Vehicle Identification Number (VIN)
            </label>
            <div className="flex flex-col sm:flex-row gap-3">
              <input 
                required 
                name="vin" 
                type="text" 
                placeholder="Enter 17-character VIN" 
                maxLength={17}
                value={formData.vin} 
                onChange={handleChange}
                disabled={isVinLocked}
                className="flex-1 bg-black/50 border border-white/10 rounded-xl p-3 focus:outline-none focus:border-[#ff5a20] transition-colors uppercase font-mono disabled:opacity-50 disabled:cursor-not-allowed" 
              />
              {!isVinLocked ? (
                <button 
                  type="button" 
                  onClick={decodeVIN}
                  disabled={isDecoding || formData.vin.length !== 17}
                  className="bg-white hover:bg-gray-200 text-black font-extrabold px-6 py-3 rounded-xl transition-colors disabled:opacity-50 whitespace-nowrap"
                >
                  {isDecoding ? 'DECODING...' : 'VERIFY VIN'}
                </button>
              ) : (
                <button 
                  type="button" 
                  onClick={() => setIsVinLocked(false)}
                  className="bg-red-500/20 hover:bg-red-500/40 text-red-400 border border-red-500/30 font-bold px-6 py-3 rounded-xl transition-colors whitespace-nowrap"
                >
                  RESET
                </button>
              )}
            </div>
            <p className="text-[10px] text-white/50 mt-3 font-semibold uppercase tracking-wider">
              {isVinLocked ? "✅ VIN Verified and Locked." : "Make, Model, and Year will auto-fill to prevent fraud."}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Make, Model, Year are now READ ONLY and styled to look locked */}
            <div>
              <label className="block text-xs font-bold text-white/50 uppercase tracking-wider mb-2">Make {isVinLocked && '🔒'}</label>
              <input readOnly required name="make" type="text" value={formData.make} placeholder="Auto-fills from VIN"
                className={`w-full border rounded-xl p-3 focus:outline-none transition-colors ${isVinLocked ? 'bg-green-500/10 border-green-500/30 text-green-400 font-bold' : 'bg-black/30 border-white/5 text-white/30 cursor-not-allowed'}`} />
            </div>
            <div>
              <label className="block text-xs font-bold text-white/50 uppercase tracking-wider mb-2">Model {isVinLocked && '🔒'}</label>
              <input readOnly required name="model" type="text" value={formData.model} placeholder="Auto-fills from VIN"
                className={`w-full border rounded-xl p-3 focus:outline-none transition-colors ${isVinLocked ? 'bg-green-500/10 border-green-500/30 text-green-400 font-bold' : 'bg-black/30 border-white/5 text-white/30 cursor-not-allowed'}`} />
            </div>

            <div>
              <label className="block text-xs font-bold text-white/50 uppercase tracking-wider mb-2">Year {isVinLocked && '🔒'}</label>
              <input readOnly required name="year" type="number" value={formData.year} placeholder="Auto-fills"
                className={`w-full border rounded-xl p-3 focus:outline-none transition-colors ${isVinLocked ? 'bg-green-500/10 border-green-500/30 text-green-400 font-bold' : 'bg-black/30 border-white/5 text-white/30 cursor-not-allowed'}`} />
            </div>

            {/* The rest remain editable */}
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
                      <button type="button" onClick={() => removeImage(idx)} className="absolute top-1 right-1 bg-black/80 hover:bg-red-500 text-white w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold backdrop-blur-md transition-colors shadow-lg z-10">✕</button>
                      {idx === 0 && <span className="absolute bottom-0 left-0 right-0 bg-black/80 backdrop-blur-md text-[#ff5a20] text-[10px] font-black text-center py-1.5 uppercase tracking-widest z-10">Main</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="pt-6">
            <button 
              type="submit" 
              disabled={loading || !isVinLocked} 
              className={`w-full text-white font-extrabold py-4 rounded-xl shadow-lg transition-colors text-lg tracking-wide ${loading || !isVinLocked ? 'bg-white/10 text-white/30 cursor-not-allowed' : 'bg-[#ff5a20] hover:bg-[#ff4500]'}`}
            >
              {!isVinLocked ? 'VERIFY VIN TO CONTINUE' : loading ? 'UPLOADING TO SECURE LEDGER...' : 'SUBMIT MOTORCYCLE FOR AUCTION'}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}