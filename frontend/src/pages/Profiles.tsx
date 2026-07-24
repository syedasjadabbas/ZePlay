import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { clearAuthSession } from '../services/api';
import { useModal } from '../components/ModalProvider';
import Footer from '../components/Footer';

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

const PRESET_AVATARS = [
  { id: 'grad-nebula', classes: 'from-indigo-600 via-purple-600 to-pink-500', name: 'Space Nebula' },
  { id: 'grad-sunfire', classes: 'from-amber-500 via-red-500 to-rose-600', name: 'Sunset Glow' },
  { id: 'grad-ocean', classes: 'from-blue-600 via-indigo-700 to-teal-500', name: 'Deep Ocean' },
  { id: 'grad-cyberpunk', classes: 'from-fuchsia-600 via-violet-600 to-cyan-500', name: 'Cyberpunk' },
  { id: 'grad-jade', classes: 'from-emerald-500 via-teal-600 to-cyan-600', name: 'Forest Jade' },
  { id: 'grad-gold', classes: 'from-yellow-500 via-amber-500 to-orange-600', name: 'Golden Aura' },
  { id: 'grad-velvet', classes: 'from-neutral-700 via-neutral-800 to-neutral-900', name: 'Charcoal Velvet' },
  { id: 'grad-aurora', classes: 'from-rose-400 via-pink-400 to-indigo-400', name: 'Aurora Dusk' }
];

const getAvatarClasses = (avatarUrl: string | null) => {
  const found = PRESET_AVATARS.find(p => p.id === avatarUrl);
  return found ? found.classes : 'from-indigo-600 via-purple-600 to-pink-500';
};

const getAvatarIcon = (avatarUrl: string | null) => {
  switch (avatarUrl) {
    case 'grad-nebula': return '👩‍🚀';
    case 'grad-sunfire': return '😎';
    case 'grad-ocean': return '🐬';
    case 'grad-cyberpunk': return '🤖';
    case 'grad-jade': return '🐼';
    case 'grad-gold': return '👑';
    case 'grad-velvet': return '🎭';
    case 'grad-aurora': return '🦄';
    default: return '🍿';
  }
};


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
  const [newEmoji, setNewEmoji] = useState('grad-nebula');
  const [editEmoji, setEditEmoji] = useState('grad-nebula');

  // PIN states
  const [newRequirePin, setNewRequirePin] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [showPinPrompt, setShowPinPrompt] = useState(false);
  const [profileToUnlock, setProfileToUnlock] = useState<ProfileData | null>(null);
  const [pinDigits, setPinDigits] = useState<string[]>(['', '', '', '']);
  const [pinError, setPinError] = useState<string | null>(null);
  const [isVerifyingPin, setIsVerifyingPin] = useState(false);
  const [pinAction, setPinAction] = useState<'unlock' | 'delete'>('unlock');

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

  const handleKeypadPress = (num: string) => {
    if (isVerifyingPin) return;
    setPinDigits(prev => {
      const idx = prev.findIndex(d => d === '');
      if (idx !== -1) {
        const next = [...prev];
        next[idx] = num;
        const updatedPin = next.join('');
        if (updatedPin.length === 4) {
          setTimeout(() => handleVerifyPin(undefined, updatedPin), 150);
        }
        return next;
      }
      return prev;
    });
  };

  const handleBackspace = () => {
    if (isVerifyingPin) return;
    setPinDigits(prev => {
      const next = [...prev];
      for (let i = 3; i >= 0; i--) {
        if (next[i] !== '') {
          next[i] = '';
          break;
        }
      }
      return next;
    });
  };

  useEffect(() => {
    if (!showPinPrompt) return;
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        handleKeypadPress(e.key);
      } else if (e.key === 'Backspace') {
        handleBackspace();
      } else if (e.key === 'Escape') {
        setShowPinPrompt(false);
        setProfileToUnlock(null);
        setPinDigits(['', '', '', '']);
        setPinError(null);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [showPinPrompt, isVerifyingPin]);

  const handleVerifyPin = async (e?: React.FormEvent, pinOverride?: string) => {
    if (e) e.preventDefault();
    const pinToVerify = pinOverride || pinDigits.join('');
    if (!profileToUnlock || pinToVerify.length !== 4) return;

    setIsVerifyingPin(true);
    setPinError(null);
    try {
      await api.post(`/profiles/${profileToUnlock.profile_id}/verify-pin`, { pin: pinToVerify });
      
      if (pinAction === 'delete') {
        const targetProfile = profileToUnlock;
        setShowPinPrompt(false);
        setProfileToUnlock(null);
        setPinDigits(['', '', '', '']);
        await executeProfileDeletion(targetProfile);
      } else {
        localStorage.setItem('selectedProfileId', profileToUnlock.profile_id);
        localStorage.setItem('selectedProfileName', profileToUnlock.display_name);
        localStorage.setItem('selectedProfileAvatar', profileToUnlock.avatar_url || '🍿');
        setShowPinPrompt(false);
        setProfileToUnlock(null);
        setPinDigits(['', '', '', '']);
        navigate('/');
      }
    } catch (err: any) {
      setPinError(err.response?.data?.detail || "Incorrect PIN. Please try again.");
      setPinDigits(['', '', '', '']);
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

    if (profile.has_pin) {
      setShowEditModal(false);
      setProfileToUnlock(profile);
      setPinAction('delete');
      setPinDigits(['', '', '', '']);
      setPinError(null);
      setShowPinPrompt(true);
    } else {
      setShowEditModal(false);
      await executeProfileDeletion(profile);
    }
  };

  const executeProfileDeletion = async (profile: ProfileData) => {
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
                const avatarBg = getAvatarClasses(profile.avatar_url);

                return (
                  <div
                    key={profile.profile_id}
                    onClick={() => handleSelectProfile(profile)}
                    className="group flex flex-col items-center cursor-pointer relative"
                  >
                    <div className="relative">
                      {/* Avatar container */}
                      <div className="w-28 h-28 md:w-32 md:h-32 rounded-md transition-all duration-300 transform group-hover:scale-105 active:scale-98 overflow-hidden relative">
                        <div className={`w-full h-full rounded-md bg-gradient-to-br flex items-center justify-center text-5xl text-white/95 ${avatarBg} shadow-inner relative`}>
                          {getAvatarIcon(profile.avatar_url)}
                        </div>
                      </div>

                      {/* Manage Overlay */}
                      {isManageMode && (
                        <div className="absolute inset-0 bg-black/65 rounded-md flex items-center justify-center transition-opacity duration-200">
                          <div className="w-9 h-9 rounded-lg bg-[#E50914] text-white flex items-center justify-center shadow-lg transform scale-110 active:scale-95 cursor-pointer">
                            <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                          </div>
                        </div>
                      )}
                    </div>

                    <span className="mt-4 text-brand-textMuted group-hover:text-white font-bold text-sm tracking-tight transition-colors duration-200 flex items-center gap-1.5">
                      {profile.display_name}
                      {profile.is_kids_profile && (
                        <span className="text-[8px] text-brand-accent font-extrabold uppercase tracking-wider">KIDS</span>
                      )}
                      {profile.has_pin && (
                        <span className="text-[10px] opacity-75 group-hover:opacity-100 transition-opacity">🔒</span>
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
                  <div className="w-28 h-28 md:w-32 md:h-32 rounded-md border border-dashed border-neutral-700 flex items-center justify-center text-4xl text-neutral-600 hover:text-white transition-all duration-300 transform hover:scale-105 active:scale-98 bg-white/[0.02]">
                    +
                  </div>
                  <span className="mt-4 text-neutral-500 group-hover:text-white text-sm font-bold transition-colors duration-200">
                    Add Profile
                  </span>
                </div>
              ) : planName === 'free' ? (
                /* Free limit upgrade CTA */
                <div className="flex flex-col items-center gap-3">
                  <div className="w-28 h-28 md:w-32 md:h-32 rounded-md border-2 border-dashed border-amber-500/20 bg-amber-500/5 flex items-center justify-center">
                    <svg className="w-10 h-10 text-amber-400/60" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                    </svg>
                  </div>
                  <div className="text-center space-y-2">
                    <p className="text-sm font-bold text-white">Free Plan Limit Reached</p>
                    <p className="text-xs text-brand-textMuted font-semibold">Upgrade to Premium for up to 4 profiles</p>
                    <button
                      onClick={() => navigate('/subscription')}
                      className="mt-1 px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-black font-extrabold rounded-xl transition-all text-xs uppercase tracking-wider hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
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
                className="px-6 py-3.5 bg-neutral-900 border border-white/5 hover:bg-neutral-800 text-brand-textMuted hover:text-white text-[10px] font-black tracking-widest uppercase rounded-lg transition-all cursor-pointer"
              >
                {isManageMode ? 'Exit Configuration' : 'Manage Profiles'}
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Create Profile Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center p-4 z-50 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[#141414] border border-white/5 w-full max-w-md p-8 rounded-xl space-y-6 transform animate-scaleIn">
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
                  className="w-full px-4 py-3 bg-white/[0.04] text-white rounded-lg outline-none transition-all text-sm placeholder:text-white/50 caret-brand-accent animate-fadeIn"
                />
              </div>

              {/* Avatar Selector Grid */}
              <div>
                <label className="block text-[10px] text-brand-textMuted uppercase tracking-widest mb-2 font-bold">Select Profile Icon Color</label>
                <div className="grid grid-cols-4 gap-3 bg-white/[0.02] p-4 rounded-lg">
                  {PRESET_AVATARS.map(avatar => (
                    <button
                      key={avatar.id}
                      type="button"
                      onClick={() => setNewEmoji(avatar.id)}
                      className={`h-12 rounded-xl bg-gradient-to-br ${avatar.classes} hover:scale-105 active:scale-95 transition-all cursor-pointer relative shadow-inner`}
                      title={avatar.name}
                    >
                      {newEmoji === avatar.id && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/35 rounded-xl border-2 border-brand-accent animate-scaleIn">
                          <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      )}
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
                        className="w-full px-4 py-3 bg-brand-background/40 text-white rounded-2xl outline-none transition-all text-sm placeholder:text-white/30 caret-brand-accent font-mono"
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
                  className="w-full px-4 py-3 bg-white/[0.04] text-white rounded-lg outline-none text-sm cursor-pointer placeholder:text-white/50 caret-brand-accent"
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
                  className="px-5 py-2.5 bg-[#E50914] text-white font-bold rounded-lg hover:bg-red-600 transition-all text-xs uppercase tracking-wider cursor-pointer"
                >
                  Create
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-5 py-2.5 bg-white/5 hover:bg-white/10 text-white font-bold rounded-lg transition-all text-xs uppercase tracking-wider cursor-pointer"
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
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center p-4 z-50 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[#141414] border border-white/5 w-full max-w-md p-8 rounded-xl space-y-6 transform animate-scaleIn">
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
                  className="w-full px-4 py-3 bg-white/[0.04] text-white rounded-lg outline-none transition-all text-sm placeholder:text-white/50 caret-brand-accent"
                />
              </div>

              {/* Avatar Selector Grid */}
              <div>
                <label className="block text-[10px] text-brand-textMuted uppercase tracking-widest mb-2 font-bold">Select Profile Icon Color</label>
                <div className="grid grid-cols-4 gap-3 bg-white/[0.02] p-4 rounded-lg">
                  {PRESET_AVATARS.map(avatar => (
                    <button
                      key={avatar.id}
                      type="button"
                      onClick={() => setEditEmoji(avatar.id)}
                      className={`h-12 rounded-xl bg-gradient-to-br ${avatar.classes} hover:scale-105 active:scale-95 transition-all cursor-pointer relative shadow-inner`}
                      title={avatar.name}
                    >
                      {editEmoji === avatar.id && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/35 rounded-xl border-2 border-brand-accent animate-scaleIn">
                          <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      )}
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
                        className="w-full px-4 py-3 bg-brand-background/40 text-white rounded-2xl outline-none transition-all text-sm placeholder:text-white/30 caret-brand-accent font-mono"
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
                  className="w-full px-4 py-3 bg-white/[0.04] text-white rounded-lg outline-none text-sm cursor-pointer placeholder:text-white/50 caret-brand-accent"
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
                    className="px-5 py-2.5 bg-[#E50914] text-white font-bold rounded-lg hover:bg-red-600 transition-all text-xs uppercase tracking-wider cursor-pointer"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditModal(false);
                      setSelectedProfile(null);
                    }}
                    className="px-5 py-2.5 bg-white/5 hover:bg-white/10 text-white font-bold rounded-lg transition-all text-xs uppercase tracking-wider cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => initiateDeleteProfile(selectedProfile)}
                  className="px-5 py-2.5 bg-neutral-900 border border-white/5 hover:bg-neutral-800 text-red-500 font-bold rounded-lg transition-all text-xs uppercase tracking-wider cursor-pointer"
                >
                  Delete
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PIN Prompt — Netflix-style clean profile lock */}
      {showPinPrompt && profileToUnlock && (
        <div className="fixed inset-0 bg-[#000000] flex flex-col items-center justify-center z-[70] animate-fadeIn">
          <div className="w-full max-w-xs px-6 text-center space-y-10">
            {/* Profile avatar */}
            <div className="space-y-4">
              <div className={`w-20 h-20 mx-auto rounded-md bg-gradient-to-br ${getAvatarClasses(profileToUnlock.avatar_url)} flex items-center justify-center text-4xl text-white select-none`}>
                {getAvatarIcon(profileToUnlock.avatar_url)}
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">{profileToUnlock.display_name}</h2>
                <p className="text-sm text-neutral-500 mt-1">Enter your PIN to continue</p>
              </div>
            </div>

            {/* PIN dots */}
            <div className="flex flex-col items-center gap-6">
              <div className={`flex gap-4 ${pinError ? 'animate-shake' : ''}`}>
                {pinDigits.map((digit, index) => (
                  <div
                    key={index}
                    className={`rounded-full transition-all duration-200 ${
                      digit !== ''
                        ? 'w-4 h-4 bg-white'
                        : 'w-4 h-4 border-2 border-neutral-600'
                    }`}
                  />
                ))}
              </div>

              {pinError && (
                <p className="text-sm text-red-400">{pinError}</p>
              )}

              {/* Numpad */}
              <div className="grid grid-cols-3 gap-3 w-full max-w-[240px]">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(num => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => handleKeypadPress(num)}
                    className="h-14 rounded-2xl bg-white/[0.06] hover:bg-white/10 text-white text-xl font-semibold active:scale-95 transition-all duration-100 cursor-pointer select-none"
                  >
                    {num}
                  </button>
                ))}

                {/* Cancel */}
                <button
                  type="button"
                  onClick={() => {
                    setShowPinPrompt(false);
                    setProfileToUnlock(null);
                    setPinDigits(['', '', '', '']);
                    setPinError(null);
                  }}
                  className="h-14 text-neutral-500 hover:text-white text-sm font-medium transition-colors cursor-pointer select-none"
                >
                  Cancel
                </button>

                {/* 0 */}
                <button
                  type="button"
                  onClick={() => handleKeypadPress('0')}
                  className="h-14 rounded-2xl bg-white/[0.06] hover:bg-white/10 text-white text-xl font-semibold active:scale-95 transition-all duration-100 cursor-pointer select-none"
                >
                  0
                </button>

                {/* Backspace */}
                <button
                  type="button"
                  onClick={handleBackspace}
                  className="h-14 rounded-2xl bg-white/[0.06] hover:bg-white/10 flex items-center justify-center active:scale-95 transition-all duration-100 cursor-pointer select-none"
                >
                  <svg className="w-5 h-5 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M3 12l6.414 6.414a2 2 0 001.414.586H19a2 2 0 002-2V7a2 2 0 00-2-2h-8.172a2 2 0 00-1.414.586L3 12z" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
};

export default Profiles;
