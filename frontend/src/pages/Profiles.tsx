import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { clearAuthSession } from '../services/api';
import { useModal } from '../components/ModalProvider';

interface ProfileData {
  profile_id: string;
  display_name: string;
  avatar_url: string | null;
  is_kids_profile: boolean;
  language_pref: string;
  has_pin?: boolean;
}

interface Toast {
  message: string;
  type: 'success' | 'error';
}

const EMOJIS = ['😀', '😎', '🤖', '👽', '🦁', '🐼', '🐱', '🦊', '🐸', '🐵', '🦄', '🚀', '🎮', '🍿'];


const Profiles: React.FC = () => {
  const { showConfirm } = useModal();
  const [profiles, setProfiles] = useState<ProfileData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isManageMode, setIsManageMode] = useState(false);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<ProfileData | null>(null);

  const [newDisplayName, setNewDisplayName] = useState('');
  const [newIsKids, setNewIsKids] = useState(false);
  const [newLang, setNewLang] = useState('en');
  const [newEmoji, setNewEmoji] = useState('🍿');
  const [editEmoji, setEditEmoji] = useState('🍿');

  // PIN states
  const [newRequirePin, setNewRequirePin] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [showPinPrompt, setShowPinPrompt] = useState(false);
  const [profileToUnlock, setProfileToUnlock] = useState<ProfileData | null>(null);
  const [pinDigits, setPinDigits] = useState<string[]>(['', '', '', '']);
  const [pinError, setPinError] = useState<string | null>(null);
  const [isVerifyingPin, setIsVerifyingPin] = useState(false);

  const pinRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

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
      const cachedUser = JSON.parse(localStorage.getItem('user') || '{}');
      const isAdmin = cachedUser.is_admin === true;
      if (subRes?.data) {
        const status = subRes.data.status;
        const isActive = status === 'active' || status === 'Administrator Account' || isAdmin;
        setMaxProfiles(isActive && subRes.data.plan?.max_profiles ? subRes.data.plan.max_profiles : (isAdmin ? 999 : 1));
        setPlanName(isActive && subRes.data.plan?.name ? subRes.data.plan.name : (isAdmin ? 'premium' : 'free'));
      } else {
        setMaxProfiles(isAdmin ? 999 : 1);
        setPlanName(isAdmin ? 'premium' : 'free');
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
      setNewRequirePin(!!profile.has_pin);
      setNewPin('');
      setShowEditModal(true);
    } else {
      if (profile.has_pin) {
        setProfileToUnlock(profile);
        setPinDigits(['', '', '', '']);
        setPinError(null);
        setShowPinPrompt(true);
        setTimeout(() => {
          pinRefs[0].current?.focus();
        }, 100);
      } else {
        localStorage.setItem('selectedProfileId', profile.profile_id);
        localStorage.setItem('selectedProfileName', profile.display_name);
        localStorage.setItem('selectedProfileAvatar', profile.avatar_url || '🍿');
        navigate('/');
      }
    }
  };

  const handleVerifyPin = async (e?: React.FormEvent, pinOverride?: string) => {
    if (e) e.preventDefault();
    const pinToVerify = pinOverride || pinDigits.join('');
    if (!profileToUnlock || pinToVerify.length !== 4) return;

    setIsVerifyingPin(true);
    setPinError(null);
    try {
      await api.post(`/profiles/${profileToUnlock.profile_id}/verify-pin`, { pin: pinToVerify });
      localStorage.setItem('selectedProfileId', profileToUnlock.profile_id);
      localStorage.setItem('selectedProfileName', profileToUnlock.display_name);
      localStorage.setItem('selectedProfileAvatar', profileToUnlock.avatar_url || '🍿');
      setShowPinPrompt(false);
      setProfileToUnlock(null);
      setPinDigits(['', '', '', '']);
      navigate('/');
    } catch (err: any) {
      setPinError(err.response?.data?.detail || "Incorrect PIN. Please try again.");
      setPinDigits(['', '', '', '']);
      setTimeout(() => {
        pinRefs[0].current?.focus();
      }, 50);
    } finally {
      setIsVerifyingPin(false);
    }
  };

  const handleCreateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDisplayName.trim()) return;
    if (newRequirePin && !/^\d{4}$/.test(newPin)) {
      showToast('PIN must be exactly 4 digits.', 'error');
      return;
    }

    try {
      await api.post('/profiles/', {
        display_name: newDisplayName,
        is_kids_profile: newIsKids,
        language_pref: newLang,
        avatar_url: newEmoji,
        pin: newRequirePin ? newPin : null,
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
    if (newRequirePin && newPin && !/^\d{4}$/.test(newPin)) {
      showToast('PIN must be exactly 4 digits.', 'error');
      return;
    }

    try {
      const payload: any = {
        display_name: newDisplayName,
        is_kids_profile: newIsKids,
        language_pref: newLang,
        avatar_url: editEmoji,
      };

      if (newRequirePin) {
        if (newPin) {
          payload.pin = newPin;
        }
      } else {
        payload.pin = null;
      }

      await api.put(`/profiles/${selectedProfile.profile_id}`, payload);

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
  const initiateDeleteProfile = async (profile: ProfileData) => {
    if (profiles.length <= 1) {
      showToast("Cannot delete your last profile.", 'error');
      return;
    }
    
    const confirm = await showConfirm(
      "Delete Profile?",
      `"${profile.display_name}" and all its watch history, watchlist, and ratings will be permanently removed. This cannot be undone.`,
      "danger",
      "Delete"
    );
    if (!confirm) return;

    try {
      await api.delete(`/profiles/${profile.profile_id}`);

      const activeProfileId = localStorage.getItem('selectedProfileId');
      if (activeProfileId === profile.profile_id) {
        const remaining = profiles.filter(p => p.profile_id !== profile.profile_id);
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

      setShowEditModal(false);
      setSelectedProfile(null);
      resetForm();
      await fetchProfiles();
      showToast(`"${profile.display_name}" was deleted.`, 'success');
    } catch (err: any) {
      const detail = err.response?.data?.detail || "Could not delete profile.";
      showToast(detail, 'error');
    }
  };

  const resetForm = () => {
    setNewDisplayName('');
    setNewIsKids(false);
    setNewLang('en');
    setNewEmoji('🍿');
    setNewRequirePin(false);
    setNewPin('');
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
                      {profile.has_pin && (
                        <span className="text-[10px] opacity-70 group-hover:opacity-100 transition-opacity">🔒</span>
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
                  onChange={(e) => {
                    setNewIsKids(e.target.checked);
                    if (e.target.checked) {
                      setNewRequirePin(false);
                      setNewPin('');
                    }
                  }}
                  className="w-5 h-5 accent-brand-accent cursor-pointer rounded border-white/5"
                />
                <label htmlFor="kids-opt" className="text-xs cursor-pointer select-none text-brand-textMuted font-semibold">
                  Enable Kids Controls
                </label>
              </div>

              {!newIsKids && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="pin-opt"
                      checked={newRequirePin}
                      onChange={(e) => {
                        setNewRequirePin(e.target.checked);
                        if (!e.target.checked) setNewPin('');
                      }}
                      className="w-5 h-5 accent-brand-accent cursor-pointer rounded border-white/5"
                    />
                    <label htmlFor="pin-opt" className="text-xs cursor-pointer select-none text-brand-textMuted font-semibold">
                      Require 4-digit PIN to access profile
                    </label>
                  </div>
                  {newRequirePin && (
                    <div>
                      <label className="block text-[10px] text-brand-textMuted uppercase tracking-widest mb-1.5 font-bold">Profile PIN</label>
                      <input
                        type="password"
                        pattern="\d*"
                        inputMode="numeric"
                        maxLength={4}
                        placeholder="4-digit PIN"
                        value={newPin}
                        onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                        required={newRequirePin}
                        className="w-full px-4 py-3 bg-[#101C40] text-white rounded-xl border border-white/10 outline-none focus:border-brand-accent/60 focus:ring-1 focus:ring-brand-accent/20 transition-all text-sm placeholder:text-white/30 caret-brand-accent font-mono"
                      />
                    </div>
                  )}
                </div>
              )}

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
                  onChange={(e) => {
                    setNewIsKids(e.target.checked);
                    if (e.target.checked) {
                      setNewRequirePin(false);
                      setNewPin('');
                    }
                  }}
                  className="w-5 h-5 accent-brand-accent cursor-pointer rounded border-white/5"
                />
                <label htmlFor="kids-edit" className="text-xs cursor-pointer select-none text-brand-textMuted font-semibold">
                  Enable Kids Controls
                </label>
              </div>

              {!newIsKids && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="pin-edit"
                      checked={newRequirePin}
                      onChange={(e) => {
                        setNewRequirePin(e.target.checked);
                        if (!e.target.checked) setNewPin('');
                      }}
                      className="w-5 h-5 accent-brand-accent cursor-pointer rounded border-white/5"
                    />
                    <label htmlFor="pin-edit" className="text-xs cursor-pointer select-none text-brand-textMuted font-semibold">
                      Require 4-digit PIN to access profile
                    </label>
                  </div>
                  {newRequirePin && (
                    <div>
                      <label className="block text-[10px] text-brand-textMuted uppercase tracking-widest mb-1.5 font-bold">
                        New Profile PIN {selectedProfile.has_pin && '(leave blank to keep current)'}
                      </label>
                      <input
                        type="password"
                        pattern="\d*"
                        inputMode="numeric"
                        maxLength={4}
                        placeholder={selectedProfile.has_pin ? "••••" : "4-digit PIN"}
                        value={newPin}
                        onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                        required={newRequirePin && !selectedProfile.has_pin}
                        className="w-full px-4 py-3 bg-[#101C40] text-white rounded-xl border border-white/10 outline-none focus:border-brand-accent/60 focus:ring-1 focus:ring-brand-accent/20 transition-all text-sm placeholder:text-white/30 caret-brand-accent font-mono"
                      />
                    </div>
                  )}
                </div>
              )}

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

      {/* PIN Prompt Modal */}
      {showPinPrompt && profileToUnlock && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-[70] backdrop-blur-md animate-fadeIn">
          <div className="bg-[#0B1535] border border-white/10 w-full max-w-sm p-8 rounded-3xl shadow-[0_25px_60px_rgba(0,0,0,0.85)] text-center space-y-6 transform animate-scaleIn">
            <div className="space-y-2">
              {/* Profile Avatar display */}
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-neutral-800 to-neutral-900 border border-white/10 flex items-center justify-center text-4xl mx-auto shadow-lg select-none">
                {profileToUnlock.avatar_url || '🍿'}
              </div>
              <h3 className="text-xl font-bold text-white font-display uppercase tracking-wider">
                Profile Locked
              </h3>
              <p className="text-xs text-brand-textMuted max-w-xs mx-auto">
                Enter the 4-digit PIN to access <span className="text-white font-bold">{profileToUnlock.display_name}</span>.
              </p>
            </div>

            <form onSubmit={(e) => handleVerifyPin(e)} className="space-y-6">
              <div className="flex flex-col items-center">
                <div className={`flex gap-3 justify-center ${pinError ? 'animate-shake' : ''}`}>
                  {pinDigits.map((digit, index) => (
                    <input
                      key={index}
                      ref={pinRefs[index]}
                      type="password"
                      pattern="\d*"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '');
                        const newDigits = [...pinDigits];
                        newDigits[index] = val;
                        setPinDigits(newDigits);
                        setPinError(null);
                        
                        if (val && index < 3) {
                          pinRefs[index + 1].current?.focus();
                        }
                        
                        // Auto-submit when last digit is filled
                        if (val && index === 3 && newDigits.every(d => d !== '')) {
                          handleVerifyPin(undefined, newDigits.join(''));
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Backspace') {
                          if (!pinDigits[index] && index > 0) {
                            const newDigits = [...pinDigits];
                            newDigits[index - 1] = '';
                            setPinDigits(newDigits);
                            pinRefs[index - 1].current?.focus();
                          } else {
                            const newDigits = [...pinDigits];
                            newDigits[index] = '';
                            setPinDigits(newDigits);
                          }
                        }
                      }}
                      className="w-12 h-14 text-center bg-[#101C40] text-white border border-white/10 focus:border-brand-accent/60 rounded-xl text-3xl font-bold font-mono focus:outline-none focus:ring-1 focus:ring-brand-accent/20 transition-all shadow-inner"
                      disabled={isVerifyingPin}
                      required
                    />
                  ))}
                </div>
                {pinError && (
                  <p className="text-rose-400 text-xs font-semibold mt-3 animate-pulse">
                    {pinError}
                  </p>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowPinPrompt(false);
                    setProfileToUnlock(null);
                    setPinDigits(['', '', '', '']);
                    setPinError(null);
                  }}
                  className="flex-1 px-4 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-white font-bold rounded-xl transition-all text-xs uppercase tracking-wider"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isVerifyingPin || pinDigits.join('').length !== 4}
                  className="flex-1 px-4 py-2.5 bg-brand-accent hover:bg-blue-600 disabled:bg-brand-accent/40 text-white font-bold rounded-xl transition-all text-xs uppercase tracking-wider flex items-center justify-center gap-1.5"
                >
                  {isVerifyingPin ? 'Verifying...' : 'Unlock'}
                </button>
              </div>
            </form>
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
