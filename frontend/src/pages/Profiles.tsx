import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { clearAuthSession } from '../services/api';

interface ProfileData {
  profile_id: string;
  display_name: string;
  avatar_url: string | null;
  is_kids_profile: boolean;
  language_pref: string;
}

interface Toast {
  message: string;
  type: 'success' | 'error';
}

const EMOJIS = ['😀', '😎', '🤖', '👽', '🦁', '🐼', '🐱', '🦊', '🐸', '🐵', '🦄', '🚀', '🎮', '🍿'];


const Profiles: React.FC = () => {
  const [profiles, setProfiles] = useState<ProfileData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isManageMode, setIsManageMode] = useState(false);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [profileToDelete, setProfileToDelete] = useState<ProfileData | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<ProfileData | null>(null);

  const [newDisplayName, setNewDisplayName] = useState('');
  const [newIsKids, setNewIsKids] = useState(false);
  const [newLang, setNewLang] = useState('en');
  const [newEmoji, setNewEmoji] = useState('🍿');
  const [editEmoji, setEditEmoji] = useState('🍿');

  const [toast, setToast] = useState<Toast | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [maxProfiles, setMaxProfiles] = useState<number>(4);  // will be fetched from subscription
  const [planName, setPlanName] = useState<string>('free');

  const navigate = useNavigate();

  const showToast = (message: string, type: 'success' | 'error') => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message, type });
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  };

  const fetchProfiles = async () => {
    try {
      setLoading(true);
      const [profileRes, subRes] = await Promise.all([
        api.get('/profiles/'),
        api.get('/subscription/current').catch(() => null),
      ]);
      setProfiles(profileRes.data);
      if (subRes?.data?.plan) {
        setMaxProfiles(subRes.data.plan.max_profiles);
        setPlanName(subRes.data.plan.name);
      }
    } catch (err: any) {
      if (err.response?.status === 401) {
        handleLogout();
      } else {
        setError("Failed to load user profiles.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfiles();
    return () => { if (toastTimer.current) clearTimeout(toastTimer.current); };
  }, []);

  const handleLogout = () => {
    clearAuthSession();
    navigate('/login');
  };

  const handleSelectProfile = (profile: ProfileData) => {
    if (isManageMode) {
      setSelectedProfile(profile);
      setNewDisplayName(profile.display_name);
      setNewIsKids(profile.is_kids_profile);
      setNewLang(profile.language_pref);
      setEditEmoji(profile.avatar_url || '🍿');
      setShowEditModal(true);
    } else {
      localStorage.setItem('selectedProfileId', profile.profile_id);
      localStorage.setItem('selectedProfileName', profile.display_name);
      localStorage.setItem('selectedProfileAvatar', profile.avatar_url || '🍿');
      navigate('/');
    }
  };

  const handleCreateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDisplayName.trim()) return;

    try {
      await api.post('/profiles/', {
        display_name: newDisplayName,
        is_kids_profile: newIsKids,
        language_pref: newLang,
        avatar_url: newEmoji,
      });
      setShowCreateModal(false);
      resetForm();
      fetchProfiles();
      showToast('Profile created successfully!', 'success');
    } catch (err: any) {
      showToast(err.response?.data?.detail || "Could not create profile.", 'error');
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProfile || !newDisplayName.trim()) return;

    try {
      await api.put(`/profiles/${selectedProfile.profile_id}`, {
        display_name: newDisplayName,
        is_kids_profile: newIsKids,
        language_pref: newLang,
        avatar_url: editEmoji,
      });

      const activeProfileId = localStorage.getItem('selectedProfileId');
      if (activeProfileId === selectedProfile.profile_id) {
        localStorage.setItem('selectedProfileName', newDisplayName);
        localStorage.setItem('selectedProfileAvatar', editEmoji);
      }

      setShowEditModal(false);
      setSelectedProfile(null);
      resetForm();
      fetchProfiles();
      showToast('Profile updated successfully!', 'success');
    } catch (err: any) {
      showToast("Failed to update profile details.", 'error');
    }
  };

  /** Step 1: open the confirmation modal — never calls window.confirm */
  const initiateDeleteProfile = (profile: ProfileData) => {
    if (profiles.length <= 1) {
      showToast("Cannot delete your last profile.", 'error');
      return;
    }
    setProfileToDelete(profile);
    setShowDeleteConfirm(true);
  };

  /** Step 2: user confirmed — call the API */
  const confirmDeleteProfile = async () => {
    if (!profileToDelete) return;
    setIsDeleting(true);
    try {
      await api.delete(`/profiles/${profileToDelete.profile_id}`);

      const activeProfileId = localStorage.getItem('selectedProfileId');
      if (activeProfileId === profileToDelete.profile_id) {
        const remaining = profiles.filter(p => p.profile_id !== profileToDelete.profile_id);
        if (remaining.length > 0) {
          localStorage.setItem('selectedProfileId', remaining[0].profile_id);
          localStorage.setItem('selectedProfileName', remaining[0].display_name);
          localStorage.setItem('selectedProfileAvatar', remaining[0].avatar_url || '🍿');
        } else {
          localStorage.removeItem('selectedProfileId');
          localStorage.removeItem('selectedProfileName');
          localStorage.removeItem('selectedProfileAvatar');
        }
      }

      setShowDeleteConfirm(false);
      setShowEditModal(false);
      setSelectedProfile(null);
      setProfileToDelete(null);
      resetForm();
      await fetchProfiles();
      showToast(`"${profileToDelete.display_name}" was deleted.`, 'success');
    } catch (err: any) {
      const detail = err.response?.data?.detail || "Could not delete profile.";
      setShowDeleteConfirm(false);
      showToast(detail, 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const resetForm = () => {
    setNewDisplayName('');
    setNewIsKids(false);
    setNewLang('en');
    setNewEmoji('🍿');
  };

  return (
    <div className="min-h-screen bg-brand-background text-white flex flex-col justify-between font-sans select-none overflow-hidden relative">
      {/* Background glowing halo */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] bg-brand-accent/5 rounded-full blur-[110px] pointer-events-none" />

      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed top-6 right-6 z-[100] flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl border backdrop-blur-md text-sm font-semibold transition-all animate-[fadeIn_0.25s_ease] ${
            toast.type === 'success'
              ? 'bg-emerald-900/80 border-emerald-500/30 text-emerald-200'
              : 'bg-red-900/80 border-red-500/30 text-red-200'
          }`}
        >
          {toast.type === 'success' ? (
            <svg className="w-4 h-4 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-4 h-4 text-red-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          )}
          {toast.message}
        </div>
      )}

      {/* Header */}
      <header className="p-6 flex justify-between items-center relative z-10">
        <h1 className="text-2xl font-black text-brand-accent tracking-wider font-display">
          ZePlay
        </h1>
        <button
          onClick={handleLogout}
          className="px-4 py-2 bg-brand-surface hover:bg-brand-cards border border-white/5 text-xs font-bold uppercase tracking-wider rounded-xl transition-all"
        >
          Sign Out
        </button>
      </header>

      {/* Main Switcher */}
      <main className="flex-grow flex flex-col items-center justify-center py-10 px-4 relative z-10">
        {loading ? (
          <div className="text-sm font-medium text-neutral-450 animate-pulse">Loading profiles...</div>
        ) : (
          <div className="text-center w-full max-w-4xl space-y-12">
            <div className="space-y-2">
              <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight font-display text-white">
                {isManageMode ? 'Manage Profiles' : "Who's watching?"}
              </h2>
              <p className="text-xs text-brand-textMuted font-semibold">Select a space profile below to start streaming.</p>
            </div>

            {error && (
              <div className="bg-red-950/40 border border-red-800/30 text-white px-4 py-2.5 rounded-xl mb-8 max-w-md mx-auto text-xs font-semibold">
                {error}
              </div>
            )}

            <div className="flex flex-wrap justify-center gap-8 md:gap-10">
              {profiles.map((profile) => {
                const isEmoji = profile.avatar_url && EMOJIS.includes(profile.avatar_url);
                const avatarBg = !isEmoji && profile.avatar_url ? profile.avatar_url : 'from-neutral-700 to-neutral-800';

                return (
                  <div
                    key={profile.profile_id}
                    onClick={() => handleSelectProfile(profile)}
                    className="group flex flex-col items-center cursor-pointer relative"
                  >
                    <div className="relative">
                      {/* Avatar container */}
                      <div className="w-28 h-28 md:w-32 md:h-32 rounded-full p-0.5 border border-white/5 group-hover:border-brand-accent/50 group-hover:shadow-[0_0_30px_rgba(59,130,246,0.3)] transition-all duration-300 transform group-hover:scale-105 shadow-2xl">
                        {isEmoji ? (
                          <div className="w-full h-full rounded-full bg-gradient-to-br from-neutral-800 to-neutral-900 border border-white/5 flex items-center justify-center text-5xl select-none">
                            {profile.avatar_url}
                          </div>
                        ) : (
                          <div className={`w-full h-full rounded-full bg-gradient-to-br flex items-center justify-center text-3xl font-extrabold font-display uppercase tracking-wider text-white ${avatarBg}`}>
                            {profile.display_name.substring(0, 1)}
                          </div>
                        )}
                      </div>

                      {/* Manage Overlay */}
                      {isManageMode && (
                        <div className="absolute inset-0 bg-black/60 rounded-full flex items-center justify-center">
                          <div className="w-8 h-8 rounded-full bg-brand-accent text-white flex items-center justify-center shadow-lg">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                          </div>
                        </div>
                      )}
                    </div>

                    <span className="mt-4 text-brand-textMuted group-hover:text-white font-bold text-sm tracking-tight transition-colors duration-200 flex items-center gap-1.5">
                      {profile.display_name}
                      {profile.is_kids_profile && (
                        <span className="text-[8px] bg-brand-accent/15 border border-brand-accent/30 text-brand-accent font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider">KIDS</span>
                      )}
                    </span>
                  </div>
                );
              })}

              {/* Add Profile Card or Upgrade CTA */}
              {profiles.length < maxProfiles ? (
                <div
                  onClick={() => {
                    resetForm();
                    setShowCreateModal(true);
                  }}
                  className="group flex flex-col items-center cursor-pointer"
                >
                  <div className="w-28 h-28 md:w-32 md:h-32 rounded-full border border-dashed border-white/10 hover:border-brand-accent flex items-center justify-center text-3xl text-neutral-600 hover:text-brand-accent hover:bg-brand-surface/20 transition-all duration-300 transform hover:scale-105">
                    +
                  </div>
                  <span className="mt-4 text-neutral-500 group-hover:text-white text-sm font-semibold transition-colors duration-200">
                    Add Profile
                  </span>
                </div>
              ) : planName === 'free' ? (
                /* Free limit upgrade CTA */
                <div className="flex flex-col items-center gap-3">
                  <div className="w-28 h-28 md:w-32 md:h-32 rounded-full border border-dashed border-amber-400/30 bg-amber-500/5 flex items-center justify-center">
                    <svg className="w-10 h-10 text-amber-400/60" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                    </svg>
                  </div>
                  <div className="text-center space-y-2">
                    <p className="text-sm font-bold text-white">Free Plan Limit Reached</p>
                    <p className="text-xs text-brand-textMuted">Upgrade to Premium for up to 4 profiles</p>
                    <button
                      onClick={() => navigate('/subscription')}
                      className="mt-1 px-5 py-2 bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-black font-extrabold rounded-xl transition-all text-xs uppercase tracking-wider"
                    >
                      Upgrade to Premium
                    </button>
                  </div>
                </div>
              ) : null}

            </div>

            {/* Toggle Config Mode Button */}
            <div className="pt-4">
              <button
                onClick={() => setIsManageMode(!isManageMode)}
                className="px-6 py-3 border border-white/5 hover:border-brand-accent bg-brand-surface hover:bg-brand-cards text-brand-textMuted hover:text-white text-[10px] font-bold tracking-widest uppercase rounded-xl transition-all"
              >
                {isManageMode ? 'Exit Configuration' : 'Manage Profiles'}
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Create Profile Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-brand-surface border border-white/5 w-full max-w-md p-8 rounded-2xl shadow-2xl space-y-6">
            <h3 className="text-2xl font-bold font-display text-white">Add Profile</h3>

            <form onSubmit={handleCreateProfile} className="space-y-5">
              <div>
                <label className="block text-[10px] text-brand-textMuted uppercase tracking-widest mb-1.5 font-bold">Display Name</label>
                <input
                  type="text"
                  placeholder="Profile Name"
                  value={newDisplayName}
                  onChange={(e) => setNewDisplayName(e.target.value)}
                  required
                  maxLength={20}
                  className="w-full px-4 py-3 bg-[#101C40] text-white rounded-xl border border-white/10 outline-none focus:border-brand-accent/60 focus:ring-1 focus:ring-brand-accent/20 transition-all text-sm placeholder:text-white/50 caret-brand-accent"
                />
              </div>

              {/* Avatar Selector Grid */}
              <div>
                <label className="block text-[10px] text-brand-textMuted uppercase tracking-widest mb-2 font-bold">Select Avatar Emoji</label>
                <div className="grid grid-cols-7 gap-2 bg-[#101C40] p-3 rounded-xl border border-white/10">
                  {EMOJIS.map(emoji => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setNewEmoji(emoji)}
                      className={`text-2xl p-1.5 rounded-lg hover:bg-white/10 transition-all flex items-center justify-center ${
                        newEmoji === emoji ? 'bg-brand-accent/20 border border-brand-accent/50 scale-110 shadow-md' : 'border border-transparent'
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="kids-opt"
                  checked={newIsKids}
                  onChange={(e) => setNewIsKids(e.target.checked)}
                  className="w-5 h-5 accent-brand-accent cursor-pointer rounded border-white/5"
                />
                <label htmlFor="kids-opt" className="text-xs cursor-pointer select-none text-brand-textMuted font-semibold">
                  Enable Kids Controls
                </label>
              </div>

              <div>
                <label className="block text-[10px] text-brand-textMuted uppercase tracking-widest mb-1.5 font-bold">Language Preference</label>
                <select
                  value={newLang}
                  onChange={(e) => setNewLang(e.target.value)}
                  className="w-full px-4 py-3 bg-[#101C40] text-white rounded-xl outline-none border border-white/10 focus:border-brand-accent/60 focus:ring-1 focus:ring-brand-accent/20 text-sm cursor-pointer placeholder:text-white/50 caret-brand-accent"
                >
                  <option value="en">English</option>
                  <option value="es">Español</option>
                  <option value="fr">Français</option>
                  <option value="de">Deutsch</option>
                </select>
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-brand-accent text-white font-bold rounded-xl hover:bg-blue-600 transition-all text-xs uppercase tracking-wider shadow-md"
                >
                  Create
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-5 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-white font-bold rounded-xl transition-all text-xs uppercase tracking-wider"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Profile Modal */}
      {showEditModal && selectedProfile && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-brand-surface border border-white/5 w-full max-w-md p-8 rounded-2xl shadow-2xl space-y-6">
            <h3 className="text-2xl font-bold font-display text-white">Edit Profile</h3>

            <form onSubmit={handleUpdateProfile} className="space-y-5">
              <div>
                <label className="block text-[10px] text-brand-textMuted uppercase tracking-widest mb-1.5 font-bold">Display Name</label>
                <input
                  type="text"
                  placeholder="Profile Name"
                  value={newDisplayName}
                  onChange={(e) => setNewDisplayName(e.target.value)}
                  required
                  maxLength={20}
                  className="w-full px-4 py-3 bg-[#101C40] text-white rounded-xl border border-white/10 outline-none focus:border-brand-accent/60 focus:ring-1 focus:ring-brand-accent/20 transition-all text-sm placeholder:text-white/50 caret-brand-accent"
                />
              </div>

              {/* Avatar Selector Grid */}
              <div>
                <label className="block text-[10px] text-brand-textMuted uppercase tracking-widest mb-2 font-bold">Select Avatar Emoji</label>
                <div className="grid grid-cols-7 gap-2 bg-[#101C40] p-3 rounded-xl border border-white/10">
                  {EMOJIS.map(emoji => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setEditEmoji(emoji)}
                      className={`text-2xl p-1.5 rounded-lg hover:bg-white/10 transition-all flex items-center justify-center ${
                        editEmoji === emoji ? 'bg-brand-accent/20 border border-brand-accent/50 scale-110 shadow-md' : 'border border-transparent'
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="kids-edit"
                  checked={newIsKids}
                  onChange={(e) => setNewIsKids(e.target.checked)}
                  className="w-5 h-5 accent-brand-accent cursor-pointer rounded border-white/5"
                />
                <label htmlFor="kids-edit" className="text-xs cursor-pointer select-none text-brand-textMuted font-semibold">
                  Enable Kids Controls
                </label>
              </div>

              <div>
                <label className="block text-[10px] text-brand-textMuted uppercase tracking-widest mb-1.5 font-bold">Language Preference</label>
                <select
                  value={newLang}
                  onChange={(e) => setNewLang(e.target.value)}
                  className="w-full px-4 py-3 bg-[#101C40] text-white rounded-xl outline-none border border-white/10 focus:border-brand-accent/60 focus:ring-1 focus:ring-brand-accent/20 text-sm cursor-pointer placeholder:text-white/50 caret-brand-accent"
                >
                  <option value="en">English</option>
                  <option value="es">Español</option>
                  <option value="fr">Français</option>
                  <option value="de">Deutsch</option>
                </select>
              </div>

              <div className="flex justify-between pt-4">
                <div className="flex gap-4">
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-brand-accent text-white font-bold rounded-xl hover:bg-blue-600 transition-all text-xs uppercase tracking-wider shadow-md"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditModal(false);
                      setSelectedProfile(null);
                    }}
                    className="px-5 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-white font-bold rounded-xl transition-all text-xs uppercase tracking-wider"
                  >
                    Cancel
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => initiateDeleteProfile(selectedProfile)}
                  className="px-5 py-2.5 bg-red-700 hover:bg-red-600 text-white font-bold rounded-xl transition-all text-xs uppercase tracking-wider"
                >
                  Delete
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && profileToDelete && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-[60] backdrop-blur-sm">
          <div className="bg-brand-surface border border-red-800/30 w-full max-w-sm p-8 rounded-2xl shadow-2xl space-y-5 text-center">
            {/* Warning Icon */}
            <div className="w-14 h-14 rounded-full bg-red-900/30 border border-red-700/30 flex items-center justify-center mx-auto">
              <svg className="w-7 h-7 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
            </div>

            <div className="space-y-1.5">
              <h3 className="text-lg font-extrabold text-white font-display">Delete Profile?</h3>
              <p className="text-xs text-brand-textMuted leading-relaxed">
                <span className="text-white font-bold">"{profileToDelete.display_name}"</span> and all its watch history, watchlist, and ratings will be permanently removed. This cannot be undone.
              </p>
            </div>

            <div className="flex gap-3 pt-1">
              <button
                onClick={() => { setShowDeleteConfirm(false); setProfileToDelete(null); }}
                disabled={isDeleting}
                className="flex-1 px-4 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-white font-bold rounded-xl transition-all text-xs uppercase tracking-wider disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                id="confirm-delete-profile-btn"
                onClick={confirmDeleteProfile}
                disabled={isDeleting}
                className="flex-1 px-4 py-2.5 bg-red-700 hover:bg-red-600 text-white font-bold rounded-xl transition-all text-xs uppercase tracking-wider disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isDeleting ? (
                  <>
                    <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Deleting...
                  </>
                ) : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="p-6 text-center text-xs text-neutral-600 space-y-1">
        <div>&copy; {new Date().getFullYear()} ZePlay. All rights reserved.</div>
        <div>
          <a
            href="https://www.zeploy.tech"
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand-accent hover:underline font-bold tracking-wider text-[10px]"
          >
            POWERED BY ZEPLOY TECH
          </a>
        </div>
      </footer>
    </div>
  );
};

export default Profiles;
