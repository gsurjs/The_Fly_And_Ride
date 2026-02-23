'use client';
import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';
import imageCompression from 'browser-image-compression';
import Link from 'next/link';

export default function EditProfilePage() {
  const router = useRouter();
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Profile State
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [location, setLocation] = useState('');
  const [socialLink, setSocialLink] = useState('');
  
  // Avatar State
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [newAvatarFile, setNewAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) {
        setErrorMsg('Failed to load profile data.');
      } else if (profile) {
        setUsername(profile.username || '');
        setBio(profile.bio || '');
        setLocation(profile.location || '');
        setSocialLink(profile.social_link || '');
        setAvatarUrl(profile.avatar_url || null);
      }
      setLoading(false);
    };

    fetchProfile();
  }, [router, supabase]);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    
    let file = e.target.files[0];

    try {
      // Compress the avatar so it loads instantly on the public profile
      const compressedFile = await imageCompression(file, { 
        maxSizeMB: 0.5, 
        maxWidthOrHeight: 800,
        useWebWorker: true
      });
      
      setNewAvatarFile(compressedFile);
      setAvatarPreview(URL.createObjectURL(compressedFile));
    } catch (error) {
      console.error("Compression error", error);
      setErrorMsg("Failed to process image.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Authentication error.");

      let finalAvatarUrl = avatarUrl;

      // 1. Upload new avatar if selected
      if (newAvatarFile) {
        const fileExt = newAvatarFile.name.split('.').pop() || 'jpg';
        // SECURE PATH: user.id/filename (Matches our RLS policy)
        const filePath = `${user.id}/${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(filePath, newAvatarFile, { upsert: true });

        if (uploadError) throw new Error(`Avatar upload failed: ${uploadError.message}`);

        const { data: publicUrlData } = supabase.storage
          .from('avatars')
          .getPublicUrl(filePath);

        finalAvatarUrl = publicUrlData.publicUrl;
      }

      // 2. Update the profiles table
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          bio,
          location,
          social_link: socialLink,
          avatar_url: finalAvatarUrl,
        })
        .eq('id', user.id);

      if (updateError) throw new Error(`Profile update failed: ${updateError.message}`);

      setSuccessMsg("Profile successfully updated!");
      setAvatarUrl(finalAvatarUrl);
      setNewAvatarFile(null);
      
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#6b2a1a] flex justify-center items-center">
        <div className="text-[#ff5a20] animate-pulse text-xl font-bold tracking-widest uppercase">Loading Profile...</div>
      </div>
    );
  }

  const displayImage = avatarPreview || avatarUrl;

  return (
    <main className="min-h-screen bg-[#6b2a1a] p-4 md:p-10 font-sans flex justify-center pb-20">
      <div className="w-full max-w-2xl bg-black/80 p-8 md:p-12 rounded-3xl border border-white/10 shadow-2xl backdrop-blur-md mt-10">
        
        <div className="flex justify-between items-start mb-8 border-b border-white/10 pb-6">
          <div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight mb-1">Edit Public Profile</h1>
            <p className="text-white/50 font-semibold uppercase tracking-widest text-xs">Manage your seller reputation & details</p>
          </div>
          <Link href="/dashboard" className="text-white/50 hover:text-white font-bold text-sm bg-white/5 px-4 py-2 rounded-lg transition-colors border border-white/10">
            Back to Garage
          </Link>
        </div>

        {errorMsg && <div className="bg-red-500/20 text-red-400 p-4 rounded-xl mb-6 font-bold">{errorMsg}</div>}
        {successMsg && <div className="bg-green-500/20 text-green-400 p-4 rounded-xl mb-6 font-bold">{successMsg}</div>}

        <form onSubmit={handleSubmit} className="space-y-6 text-white">
          
          {/* Avatar Upload Section */}
          <div className="flex flex-col sm:flex-row items-center gap-6 bg-white/5 p-6 rounded-2xl border border-white/10">
            
            {/* This is now a <label> with htmlFor="avatar-upload" and cursor-pointer */}
            <label htmlFor="avatar-upload" className="h-28 w-28 rounded-full overflow-hidden bg-black border-2 border-[#ff5a20] shadow-lg flex-shrink-0 relative group cursor-pointer">
              {displayImage ? (
                <img src={displayImage} alt="Avatar Preview" className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full bg-gradient-to-br from-[#ff5a20] to-orange-800 flex items-center justify-center text-4xl font-black text-white">
                  {username ? username.charAt(0).toUpperCase() : '?'}
                </div>
              )}
              {/* Overlay for hovering */}
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                 <span className="text-[10px] font-bold text-white uppercase tracking-widest">Change</span>
              </div>
            </label>
            
            <div className="flex-1 text-center sm:text-left">
              <h3 className="text-lg font-bold mb-2">Profile Picture</h3>
              <p className="text-white/50 text-xs font-semibold mb-4">Recommended size: 400x400px. JPG, PNG, or WEBP.</p>
              <div className="relative inline-block">
                <button type="button" className="bg-white/10 hover:bg-white/20 text-white font-bold py-2 px-6 rounded-full transition-colors text-sm border border-white/20 cursor-pointer">
                  Select Image
                </button>
                {/* Added id="avatar-upload" to link with the image label */}
                <input 
                  id="avatar-upload"
                  type="file" 
                  accept="image/jpeg, image/png, image/webp" 
                  onChange={handleAvatarChange} 
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* User Info Fields */}
          <div>
            <label className="block text-xs font-bold text-white/50 uppercase tracking-wider mb-2">Username (Locked)</label>
            <input 
              type="text" 
              value={username} 
              disabled 
              className="w-full bg-black/50 border border-white/5 rounded-xl p-3 text-white/50 focus:outline-none cursor-not-allowed" 
            />
            <p className="text-[10px] text-white/40 mt-2 font-semibold">Usernames cannot be changed once registered.</p>
          </div>

          <div>
            <label className="block text-xs font-bold text-white/50 uppercase tracking-wider mb-2">Location</label>
            <input 
              type="text" 
              placeholder="e.g., Austin, TX"
              value={location} 
              onChange={(e) => setLocation(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl p-3 focus:outline-none focus:border-[#ff5a20] transition-colors" 
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-white/50 uppercase tracking-wider mb-2">About Me (Bio)</label>
            <textarea 
              rows={4}
              placeholder="Tell buyers a bit about yourself, your riding history, or your collection..."
              value={bio} 
              onChange={(e) => setBio(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl p-3 focus:outline-none focus:border-[#ff5a20] transition-colors resize-none custom-scrollbar" 
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-white/50 uppercase tracking-wider mb-2">Social / Website Link</label>
            <input 
              type="url" 
              placeholder="e.g., https://instagram.com/yourhandle"
              value={socialLink} 
              onChange={(e) => setSocialLink(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl p-3 focus:outline-none focus:border-[#ff5a20] transition-colors" 
            />
          </div>

          <div className="pt-6 border-t border-white/10">
            <button 
              type="submit" 
              disabled={saving} 
              className="w-full bg-[#ff5a20] hover:bg-[#ff4500] disabled:opacity-50 text-white font-extrabold py-4 rounded-xl shadow-lg transition-colors text-lg tracking-wide"
            >
              {saving ? 'SAVING PROFILE...' : 'SAVE PROFILE'}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}