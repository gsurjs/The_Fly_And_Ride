'use client';
import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';
import imageCompression from 'browser-image-compression';
import StripeVerificationModal from '../components/StripeVerificationModal';

export default function CreateListing() {
  const router = useRouter();
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const [isVerificationModalOpen, setIsVerificationModalOpen] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  
  // NHTSA VIN DECODING STATE
  const [isDecoding, setIsDecoding] = useState(false);
  const [vinError, setVinError] = useState('');
  const [isVinLocked, setIsVinLocked] = useState(false); 
  
  // IMPORTED / VINTAGE BIKE STATE
  const [isImported, setIsImported] = useState(false);
  const [zipCode, setZipCode] = useState('');
  const [isLocationLocked, setIsLocationLocked] = useState(false);
  const [locationError, setLocationError] = useState('');
  
  // SECURE VERIFICATION PHOTO STATE
  const [framePhoto, setFramePhoto] = useState<{ file: File; url: string } | null>(null);
  const [titlePhoto, setTitlePhoto] = useState<{ file: File; url: string } | null>(null);
  
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
    video_url: '',
    highlights: '',
    equipment: '',
    modifications: '',
    known_flaws: '',
    recent_service_history: '',
    other_items_included: '',
    ownership_history: '',
    seller_notes: ''
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleImportToggle = () => {
    setIsImported(!isImported);
    setIsVinLocked(false); 
    setVinError('');
    if (!isImported) {
      setFormData(prev => ({ ...prev, make: '', model: '' }));
      // Clear verification photos if they toggle back to standard
      if (framePhoto) URL.revokeObjectURL(framePhoto.url);
      if (titlePhoto) URL.revokeObjectURL(titlePhoto.url);
      setFramePhoto(null);
      setTitlePhoto(null);
    }
  };

  // Now accepts a message to tell the user what happened
  const enableImportMode = (message: string) => {
    setIsImported(true);
    setIsVinLocked(false);
    setVinError(message); // Leave a helpful note explaining the auto-switch
  };

  const decodeVIN = async () => {
    setVinError('');

    // If it's less than 17 characters, auto-switch immediately
    if (formData.vin.trim().length !== 17) {
      enableImportMode("Standard VINs are 17 characters. We automatically switched you to Import / Vintage mode so you can upload your frame number & paperwork.");
      return;
    }

    setIsDecoding(true);
    try {
      const response = await fetch(`https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${formData.vin.toUpperCase()}?format=json`);
      const data = await response.json();
      const result = data.Results[0];

      // If the API fails to find it, auto-switch immediately
      if (!result.Make || result.ErrorCode !== "0") {
        setIsDecoding(false);
        enableImportMode("Vehicle not found in the standard US database. We automatically switched you to Import / Vintage mode.");
        return;
      }

      const badTypes = ['PASSENGER CAR', 'TRUCK', 'TRAILER', 'BUS', 'MULTIPURPOSE PASSENGER VEHICLE (MPV)'];
      if (result.VehicleType && badTypes.includes(result.VehicleType.toUpperCase())) {
        setVinError(`Invalid vehicle type: ${result.VehicleType}. FLY&RIDE is exclusively for motorcycles.`);
        setIsVinLocked(false);
        setIsDecoding(false);
        return;
      }

      const formattedMake = result.Make.charAt(0).toUpperCase() + result.Make.slice(1).toLowerCase();

      setFormData(prev => ({
        ...prev,
        make: formattedMake,
        model: result.Model,
        year: parseInt(result.ModelYear) || prev.year,
      }));
      
      setIsVinLocked(true); 

    } catch (err) {
      setVinError("Network error. Could not reach the VIN database.");
    }
    setIsDecoding(false);
  };

  // Location Verification Function
  const verifyZipCode = async () => {
    setLocationError('');
    if (zipCode.trim().length !== 5) {
      setLocationError('Please enter a valid 5-digit US Zip Code.');
      return;
    }

    try {
      // Free postal API to fetch City and State from a Zip Code
      const response = await fetch(`https://api.zippopotam.us/us/${zipCode}`);
      
      if (!response.ok) {
        setLocationError('Invalid US Zip Code. Please try again.');
        setIsLocationLocked(false);
        return;
      }
      
      const data = await response.json();
      const place = data.places[0];
      
      // Format it beautifully (e.g., "Beverly Hills, CA")
      const formattedLocation = `${place['place name']}, ${place['state abbreviation']}`;
      
      setFormData(prev => ({ ...prev, location: formattedLocation }));
      setIsLocationLocked(true);
      
    } catch (err) {
      setLocationError('Network error. Could not verify Zip Code.');
    }
  };

  // HELPER TO PROCESS ALL IMAGES (HEIC + Compression)
  const processImage = async (file: File) => {
    let processedFile = file;
    if (file.type === 'image/heic' || file.name.toLowerCase().endsWith('.heic')) {
      const heic2any = (await import('heic2any')).default; 
      const convertedBlob = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.8 });
      const finalBlob = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob;
      processedFile = new File([finalBlob], file.name.replace(/\.heic$/i, '.jpg'), { type: 'image/jpeg' });
    }
    const options = { maxSizeMB: 1, maxWidthOrHeight: 1920, useWebWorker: true };
    return await imageCompression(processedFile, options);
  };

  // HANDLERS FOR VERIFICATION PHOTOS
  const handleVerificationPhoto = async (e: React.ChangeEvent<HTMLInputElement>, type: 'frame' | 'title') => {
    if (!e.target.files || !e.target.files[0]) return;
    try {
      const compressedFile = await processImage(e.target.files[0]);
      const photoObj = { file: compressedFile, url: URL.createObjectURL(compressedFile) };
      if (type === 'frame') setFramePhoto(photoObj);
      else setTitlePhoto(photoObj);
    } catch (error) {
      setErrorMsg(`Failed to process ${type} photo.`);
    }
  };

  // STANDARD GALLERY IMAGE HANDLER
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
        const compressedFile = await processImage(file);
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

    if (!isImported && !isVinLocked) {
      setErrorMsg("You must decode and verify your standard VIN before submitting.");
      setLoading(false);
      return;
    }

    // Enforce Verification Photos for Imports
    if (isImported && (!framePhoto || !titlePhoto)) {
      setErrorMsg("Imported & Vintage bikes require BOTH a Frame Number photo and Title photo for verification.");
      setLoading(false);
      return;
    }

    if (imageFiles.length === 0) {
      setErrorMsg("Please upload at least one image of the motorcycle.");
      setLoading(false);
      return;
    }

    if (formData.vin.trim().length < 4) {
      setErrorMsg("Please enter a valid Frame Number or VIN.");
      setLoading(false);
      return;
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      setErrorMsg("Authentication failed. Please log in again.");
      setLoading(false);
      return;
    }

    const { data: profile } = await supabase.from('profiles').select('has_payment_method').eq('id', user.id).single();

    console.log("=== DEBUG STRIPE CHECK ===");
    console.log("Raw Profile Data from DB:", profile);
    console.log("Is JS reading it as true?:", !!profile?.has_payment_method);

    if (!profile?.has_payment_method) {
      setIsVerificationModalOpen(true);
      setLoading(false);
      return;
    }

    try {
      // 1. Upload Gallery Images
      const uploadedUrls: string[] = [];
      for (const file of imageFiles) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${user.id}-${Math.random().toString(36).substring(2)}.${fileExt}`;
        const { error: uploadError } = await supabase.storage.from('motorcycles').upload(fileName, file);
        if (uploadError) throw uploadError;
        const { data: publicUrlData } = supabase.storage.from('motorcycles').getPublicUrl(fileName);
        uploadedUrls.push(publicUrlData.publicUrl);
      }

      // Upload Verification Photos (if applicable)
      let framePhotoUrl = null;
      let titlePhotoUrl = null;

      if (isImported && framePhoto && titlePhoto) {
        // Frame Upload
        const frameExt = framePhoto.file.name.split('.').pop();
        const frameName = `verification/${user.id}-frame-${Math.random().toString(36).substring(2)}.${frameExt}`;
        await supabase.storage.from('motorcycles').upload(frameName, framePhoto.file);
        framePhotoUrl = supabase.storage.from('motorcycles').getPublicUrl(frameName).data.publicUrl;

        // Title Upload
        const titleExt = titlePhoto.file.name.split('.').pop();
        const titleName = `verification/${user.id}-title-${Math.random().toString(36).substring(2)}.${titleExt}`;
        await supabase.storage.from('motorcycles').upload(titleName, titlePhoto.file);
        titlePhotoUrl = supabase.storage.from('motorcycles').getPublicUrl(titleName).data.publicUrl;
      }

      const endsAt = new Date();
      endsAt.setDate(endsAt.getDate() + Number(formData.duration_days));

      // 3. Insert Database Payload
      const insertPayload: any = {
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
        video_url: formData.video_url,
        status: 'pending',
        highlights: formData.highlights,
        equipment: formData.equipment,
        modifications: formData.modifications,
        known_flaws: formData.known_flaws,
        recent_service_history: formData.recent_service_history,
        other_items_included: formData.other_items_included,
        ownership_history: formData.ownership_history,
        seller_notes: formData.seller_notes
      };

      // Add the secure URLs to the payload if they exist
      if (isImported) {
        insertPayload.frame_photo_url = framePhotoUrl;
        insertPayload.title_photo_url = titlePhotoUrl;
      }

      const { error: insertError } = await supabase.from('listings').insert([insertPayload]);

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
            Your motorcycle has been sent to our moderation team. You will see it in your garage once approved.
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
            <div className="flex justify-between items-start mb-2">
              <label className="block text-xs font-bold text-[#ff5a20] uppercase tracking-wider">
                {isImported ? 'Frame Number / Non-Standard VIN' : 'Vehicle Identification Number (VIN)'}
              </label>
              
              {/* The Toggle Switch */}
              <label className="flex items-center gap-2 cursor-pointer group">
                <div className="relative">
                  <input type="checkbox" className="sr-only" checked={isImported} onChange={handleImportToggle} />
                  <div className={`block w-10 h-6 rounded-full transition-colors ${isImported ? 'bg-[#ff5a20]' : 'bg-black/50 border border-white/20'}`}></div>
                  <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${isImported ? 'translate-x-4' : ''}`}></div>
                </div>
                <span className="text-xs text-white/50 font-bold uppercase tracking-wider group-hover:text-white transition-colors">Import / Pre-1981</span>
              </label>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <input 
                required 
                name="vin" 
                type="text" 
                placeholder={isImported ? "Enter Frame Number" : "Enter 17-character VIN"} 
                maxLength={isImported ? 50 : 17}
                value={formData.vin} 
                onChange={handleChange}
                disabled={isVinLocked && !isImported}
                className="flex-1 bg-black/50 border border-white/10 rounded-xl p-3 focus:outline-none focus:border-[#ff5a20] transition-colors uppercase font-mono disabled:opacity-50 disabled:cursor-not-allowed" 
              />
              {!isImported && (
                !isVinLocked ? (
                  <button 
                    type="button" 
                    onClick={decodeVIN}
                    disabled={isDecoding || formData.vin.length === 0}
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
                )
              )}
            </div>
            <p className="text-[10px] text-white/50 mt-3 font-semibold uppercase tracking-wider">
              {isImported ? "⚠️ Imported bikes will be closely verified by admins before publishing." : isVinLocked ? "✅ VIN Verified and Locked." : "Make, Model, and Year will auto-fill to prevent fraud."}
            </p>
          </div>

          {/* CONDITIONAL VERIFICATION PHOTO UPLOADS */}
          {isImported && (
            <div className="bg-yellow-500/10 border border-yellow-500/30 p-6 rounded-2xl">
              <h3 className="text-yellow-500 font-extrabold text-sm uppercase tracking-widest mb-2 flex items-center gap-2">
                <span>🔒</span> Mandatory Security Verification
              </h3>
              <p className="text-white/70 text-sm mb-4">Because this vehicle does not have a standard 17-character VIN, you must upload photographic proof of ownership. <strong>These photos are strictly for admin review and will not be made public.</strong></p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Frame Photo Dropzone */}
                <div className="relative border-2 border-dashed border-yellow-500/30 rounded-xl p-4 text-center hover:border-yellow-500 transition-colors flex flex-col items-center justify-center min-h-[120px] overflow-hidden">
                  {framePhoto ? (
                    <>
                      <img src={framePhoto.url} alt="Frame verification" className="absolute inset-0 w-full h-full object-cover opacity-60" />
                      <div className="relative z-10 bg-black/80 px-3 py-1 rounded-md text-green-400 font-bold text-xs uppercase tracking-widest border border-green-500/50">✓ Frame Uploaded</div>
                      <button type="button" onClick={() => setFramePhoto(null)} className="absolute top-2 right-2 z-10 bg-red-500 hover:bg-red-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs shadow-lg">✕</button>
                    </>
                  ) : (
                    <>
                      <p className="text-yellow-500/80 font-bold text-sm mb-1">1. Stamped Frame #</p>
                      <p className="text-white/40 text-[10px] uppercase">Photo of metal steering head</p>
                      <input type="file" accept="image/jpeg, image/png, image/webp, .heic" onChange={(e) => handleVerificationPhoto(e, 'frame')} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                    </>
                  )}
                </div>

                {/* Title Photo Dropzone */}
                <div className="relative border-2 border-dashed border-yellow-500/30 rounded-xl p-4 text-center hover:border-yellow-500 transition-colors flex flex-col items-center justify-center min-h-[120px] overflow-hidden">
                  {titlePhoto ? (
                    <>
                      <img src={titlePhoto.url} alt="Title verification" className="absolute inset-0 w-full h-full object-cover opacity-60" />
                      <div className="relative z-10 bg-black/80 px-3 py-1 rounded-md text-green-400 font-bold text-xs uppercase tracking-widest border border-green-500/50">✓ Title Uploaded</div>
                      <button type="button" onClick={() => setTitlePhoto(null)} className="absolute top-2 right-2 z-10 bg-red-500 hover:bg-red-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs shadow-lg">✕</button>
                    </>
                  ) : (
                    <>
                      <p className="text-yellow-500/80 font-bold text-sm mb-1">2. Title / Paperwork</p>
                      <p className="text-white/40 text-[10px] uppercase">Must match frame number</p>
                      <input type="file" accept="image/jpeg, image/png, image/webp, .heic" onChange={(e) => handleVerificationPhoto(e, 'title')} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Make, Model, Year dynamically unlock if isImported is true */}
            <div>
              <label className="block text-xs font-bold text-white/50 uppercase tracking-wider mb-2">Make {!isImported && isVinLocked && '🔒'}</label>
              <input 
                readOnly={!isImported} 
                required 
                name="make" 
                type="text" 
                value={formData.make} 
                onChange={handleChange}
                placeholder={isImported ? "e.g., Honda" : "Auto-fills from VIN"}
                className={`w-full border rounded-xl p-3 focus:outline-none transition-colors ${!isImported ? (isVinLocked ? 'bg-green-500/10 border-green-500/30 text-green-400 font-bold' : 'bg-black/30 border-white/5 text-white/30 cursor-not-allowed') : 'bg-white/5 border-white/10 focus:border-[#ff5a20]'}`} 
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-white/50 uppercase tracking-wider mb-2">Model {!isImported && isVinLocked && '🔒'}</label>
              <input 
                readOnly={!isImported} 
                required 
                name="model" 
                type="text" 
                value={formData.model} 
                onChange={handleChange}
                placeholder={isImported ? "e.g., NSR250R" : "Auto-fills from VIN"}
                className={`w-full border rounded-xl p-3 focus:outline-none transition-colors ${!isImported ? (isVinLocked ? 'bg-green-500/10 border-green-500/30 text-green-400 font-bold' : 'bg-black/30 border-white/5 text-white/30 cursor-not-allowed') : 'bg-white/5 border-white/10 focus:border-[#ff5a20]'}`} 
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-white/50 uppercase tracking-wider mb-2">Year {!isImported && isVinLocked && '🔒'}</label>
              <input 
                readOnly={!isImported} 
                required 
                name="year" 
                type="number" 
                min="1900"
                max="2027"
                value={formData.year} 
                onChange={handleChange}
                placeholder={isImported ? "Year" : "Auto-fills"}
                className={`w-full border rounded-xl p-3 focus:outline-none transition-colors ${!isImported ? (isVinLocked ? 'bg-green-500/10 border-green-500/30 text-green-400 font-bold' : 'bg-black/30 border-white/5 text-white/30 cursor-not-allowed') : 'bg-white/5 border-white/10 focus:border-[#ff5a20]'}`} 
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-white/50 uppercase tracking-wider mb-2">Mileage</label>
              <input required name="mileage" type="number" min="0" value={formData.mileage} onChange={handleChange}
                className="w-full bg-white/5 border border-white/10 rounded-xl p-3 focus:outline-none focus:border-[#ff5a20] transition-colors" />
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
                        // Only allow numbers
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
                      value={formData.location} 
                      className="w-3/4 bg-green-500/10 border border-green-500/30 text-green-400 font-bold rounded-xl p-3 focus:outline-none cursor-not-allowed" 
                    />
                    <button 
                      type="button" 
                      onClick={() => {
                        setIsLocationLocked(false);
                        setZipCode('');
                        setFormData(prev => ({ ...prev, location: '' }));
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

            <div>
              <label className="block text-xs font-bold text-white/50 uppercase tracking-wider mb-2">Title Status</label>
              <select name="title_status" value={formData.title_status} onChange={handleChange}
                className="w-full bg-white/5 border border-white/10 rounded-xl p-3 focus:outline-none focus:border-[#ff5a20] transition-colors appearance-none text-white">
                <option value="Clean" className="bg-black">Clean</option>
                <option value="Rebuilt" className="bg-black">Rebuilt</option>
                <option value="Salvage" className="bg-black">Salvage</option>
                <option value="Import" className="bg-black">Import / Grey Market</option>
              </select>
            </div>

            {/* YouTube Video Link Field */}
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-white/50 uppercase tracking-wider mb-2 flex items-center gap-2">
                <span className="text-[#ff0000]">▶</span> YouTube Walkaround / Cold Start Link <span className="text-white/30 lowercase normal-case text-[10px]">(Optional)</span>
              </label>
              <input 
                name="video_url" 
                type="url" 
                placeholder="e.g., https://www.youtube.com/watch?v=..." 
                value={formData.video_url} 
                onChange={handleChange}
                className="w-full bg-white/5 border border-white/10 rounded-xl p-3 focus:outline-none focus:border-[#ff0000] transition-colors" 
              />
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

          {/* DETAILED REPORT TEXTAREAS */}
          <div className="pt-8 border-t border-white/10 space-y-6">
            <h2 className="text-2xl font-black text-white tracking-tight mb-4">Detailed Vehicle Report</h2>
            <p className="text-white/50 text-sm font-bold mb-6">Fill out as much detail as possible. Sections left blank will be hidden from buyers.</p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[
                { id: 'highlights', label: 'Highlights', placeholder: 'General overview of the vehicle...' },
                { id: 'equipment', label: 'Equipment', placeholder: 'Factory options, packages, etc...' },
                { id: 'modifications', label: 'Modifications', placeholder: 'Aftermarket parts, tunes, exhaust...' },
                { id: 'known_flaws', label: 'Known Flaws', placeholder: 'Scratches, dents, mechanical issues...' },
                { id: 'recent_service_history', label: 'Recent Service History', placeholder: 'Oil changes, tire replacements...' },
                { id: 'other_items_included', label: 'Other Items Included', placeholder: 'Keys, manuals, spare parts...' },
                { id: 'ownership_history', label: 'Ownership History', placeholder: 'Number of owners, states registered in...' },
                { id: 'seller_notes', label: 'Seller Notes', placeholder: 'Any final thoughts or disclaimers...' },
              ].map((field) => (
                <div key={field.id} className="flex flex-col">
                  <label className="block text-xs font-bold text-white/50 uppercase tracking-wider mb-2">
                    {field.label}
                  </label>
                  <textarea
                    name={field.id}
                    value={(formData as any)[field.id]}
                    onChange={handleChange}
                    placeholder={field.placeholder}
                    className="w-full h-32 bg-white/5 border border-white/10 rounded-xl p-4 text-white text-sm focus:outline-none focus:border-[#ff5a20] transition-colors resize-y custom-scrollbar"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="pt-6">
            <button 
              type="submit" 
              disabled={loading || (!isImported && !isVinLocked) || !isLocationLocked}
              className={`w-full text-white font-extrabold py-4 rounded-xl shadow-lg transition-colors text-lg tracking-wide ${loading || (!isImported && !isVinLocked) ? 'bg-white/10 text-white/30 cursor-not-allowed' : 'bg-[#ff5a20] hover:bg-[#ff4500]'}`}
            >
              {!isImported && !isVinLocked ? 'VERIFY VIN TO CONTINUE' : loading ? 'UPLOADING TO SECURE LEDGER...' : 'SUBMIT MOTORCYCLE FOR AUCTION'}
            </button>
          </div>
        </form>
      </div>

      {isVerificationModalOpen && (
        <StripeVerificationModal 
          onClose={() => setIsVerificationModalOpen(false)} 
          onSuccess={() => {
            setIsVerificationModalOpen(false);
            alert("Payment method verified! You can now submit your listing.");
          }} 
        />
      )}
    </main>
  );
}