import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { useModal } from '../components/ModalProvider';
import PremiumPoster from '../components/PremiumPoster';

interface MovieOption {
  movie_id: string;
  title: string;
  release_year: number;
}

interface VideoAsset {
  video_id: string;
  movie_id: string | null;
  filename: string;
  original_filename: string;
  storage_path: string;
  file_size_bytes: number;
  mime_type: string;
  status: string;
  format: string;
  playback_url: string;
  hls_url?: string | null;
  error_message?: string | null;
  processing_progress?: number;
  created_at: string;
}

interface AnalyticsStats {
  total_users: number;
  total_profiles: number;
  total_movies: number;
  total_videos: number;
  total_ratings: number;
  total_watch_time: number;
  total_views: number;
  active_users: number;
  free_users: number;
  premium_users: number;
  conversion_rate: number;
  average_rating: number;
  average_watch_time: number;
}

interface ContentRankings {
  most_watched_movies: Array<{ movie_id: string; title: string; thumbnail_url: string; views: number }>;
  highest_rated_movies: Array<{ movie_id: string; title: string; thumbnail_url: string; rating: number }>;
  most_added_watchlist: Array<{ movie_id: string; title: string; thumbnail_url: string; saves: number }>;
  most_popular_genres: Array<{ genre_id: string; name: string; count: number }>;
  most_watched_categories: Array<{ genre_id: string; name: string; views: number }>;
  most_recommended: Array<{ movie_id: string; title: string; thumbnail_url: string }>;
}

interface HealthStats {
  database_status: string;
  cache_status: string;
  cache_stats: {
    hits: number;
    misses: number;
    hit_rate_pct: number;
    keys_count: number;
    engine: string;
  };
  storage_usage_bytes: number;
  total_files: number;
  total_uploaded_files: number;
  total_hls_assets: number;
  total_video_segments: number;
  processing_queue_status: number;
}

interface UserData {
  user_id: string;
  name: string;
  email: string;
  is_verified: boolean;
  is_admin: boolean;
  is_active: boolean;
  subscription_plan: string;
  profile_count: number;
  created_at: string;
}

interface UserActivity {
  profiles: Array<{ profile_id: string; display_name: string; is_kids_profile: boolean; language_pref: string }>;
  watch_history: Array<{ history_id: string; movie_title: string; percentage_watched: number; last_watched: string }>;
  ratings: Array<{ rating_id: string; movie_title: string; score: number; created_at: string }>;
  audit_logs: Array<{ log_id: string; action: string; details: string; created_at: string }>;
}

interface AuditLog {
  log_id: string;
  action: string;
  details: string;
  performed_by: string | null;
  actor_email: string | null;
  metadata: any;
  created_at: string;
}

const AdminUpload: React.FC = () => {
  const { showAlert, showConfirm } = useModal();
  const [activeTab, setActiveTab] = useState<'overview' | 'content' | 'users' | 'ingestion' | 'movies_manage' | 'health' | 'audit'>('overview');

  // States for ingestion
  const [file, setFile] = useState<File | null>(null);
  const [selectedMovieId, setSelectedMovieId] = useState<string>('');
  const [movies, setMovies] = useState<MovieOption[]>([]);
  const [videos, setVideos] = useState<VideoAsset[]>([]);
  const [uploading, setUploading] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [activePreviewVideo, setActivePreviewVideo] = useState<VideoAsset | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // States for Catalog Movie Management
  const [catalogMovies, setCatalogMovies] = useState<any[]>([]);
  const [editingMovie, setEditingMovie] = useState<any | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editYear, setEditYear] = useState(2026);
  const [editDuration, setEditDuration] = useState(120);
  const [editPosterFile, setEditPosterFile] = useState<File | null>(null);
  const [editPosterPreview, setEditPosterPreview] = useState('');
  const [savingMovie, setSavingMovie] = useState(false);
  const posterInputRef = useRef<HTMLInputElement>(null);

  // States for Analytics & Health
  const [analytics, setAnalytics] = useState<AnalyticsStats | null>(null);
  const [contentRankings, setContentRankings] = useState<ContentRankings | null>(null);
  const [health, setHealth] = useState<HealthStats | null>(null);
  const [clearingCache, setClearingCache] = useState(false);

  // States for User Management
  const [users, setUsers] = useState<UserData[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [userPlanFilter, setUserPlanFilter] = useState('');
  const [userStatusFilter, setUserStatusFilter] = useState('');
  const [userVerifyFilter, setUserVerifyFilter] = useState<string>('');
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [selectedUserDetail, setSelectedUserDetail] = useState<UserData | null>(null);
  const [userActivity, setUserActivity] = useState<UserActivity | null>(null);
  const [loadingActivity, setLoadingActivity] = useState(false);

  // States for Audit Logs
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [auditActionFilter, setAuditActionFilter] = useState('');
  const auditLimit = 50;
  const [auditOffset, setAuditOffset] = useState(0);

  // General Notification
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    fetchMovies();
    fetchVideos();
    fetchAnalytics();
    fetchContentRankings();
    fetchHealth();
    fetchUsersList();
    fetchAuditLogs();

    const interval = setInterval(() => {
      fetchVideos();
      fetchHealth();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  // Fetch functions
  const fetchMovies = async () => {
    try {
      const response = await api.get('/catalog/movies');
      setMovies(response.data);
      setCatalogMovies(response.data);
    } catch (err) {
      console.error('Failed to load movies catalog', err);
    }
  };

  const handleStartEdit = (movie: any) => {
    setEditingMovie(movie);
    setEditTitle(movie.title);
    setEditDesc(movie.description);
    setEditYear(movie.release_year);
    setEditDuration(movie.duration_minutes);
    setEditPosterFile(null);
    setEditPosterPreview(movie.thumbnail_url || '');
  };

  const handlePosterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setEditPosterFile(file);
      setEditPosterPreview(URL.createObjectURL(file));
    }
  };

  const handleSaveMovie = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMovie) return;
    try {
      setSavingMovie(true);
      setError(null);
      setSuccessMsg(null);

      let currentThumbnail = editPosterPreview;
      if (editPosterFile) {
        const formData = new FormData();
        formData.append('file', editPosterFile);
        const posterRes = await api.post(`/admin/movies/${editingMovie.movie_id}/poster`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        currentThumbnail = posterRes.data.thumbnail_url;
      }

      await api.put(`/admin/movies/${editingMovie.movie_id}`, {
        title: editTitle,
        description: editDesc,
        release_year: editYear,
        duration_minutes: editDuration,
        thumbnail_url: currentThumbnail,
        video_url: editingMovie.video_url || 'placeholder'
      });

      setSuccessMsg('Movie catalog entry successfully updated!');
      setEditingMovie(null);
      fetchMovies();
    } catch (err: any) {
      console.error('Failed to save movie', err);
      setError(err.response?.data?.detail || 'Failed to save movie metadata.');
    } finally {
      setSavingMovie(false);
    }
  };

  const fetchVideos = async () => {
    try {
      const response = await api.get('/videos');
      setVideos(response.data);
    } catch (err) {
      console.error('Failed to load video assets', err);
    }
  };

  const fetchAnalytics = async () => {
    try {
      const response = await api.get('/admin/analytics');
      setAnalytics(response.data);
    } catch (err) {
      console.error('Failed to load analytics', err);
    }
  };

  const fetchContentRankings = async () => {
    try {
      const response = await api.get('/admin/content-analytics');
      setContentRankings(response.data);
    } catch (err) {
      console.error('Failed to load content rankings', err);
    }
  };

  const fetchHealth = async () => {
    try {
      const response = await api.get('/admin/health');
      setHealth(response.data);
    } catch (err) {
      console.error('Failed to load health statistics', err);
    }
  };

  const fetchUsersList = async () => {
    try {
      const params: any = {};
      if (userSearch) params.q = userSearch;
      if (userPlanFilter) params.plan = userPlanFilter;
      if (userStatusFilter) params.status = userStatusFilter;
      if (userVerifyFilter) params.is_verified = userVerifyFilter === 'verified';

      const response = await api.get('/admin/users', { params });
      setUsers(response.data);
    } catch (err) {
      console.error('Failed to load users list', err);
    }
  };

  const fetchAuditLogs = async () => {
    try {
      const params: any = { limit: auditLimit, offset: auditOffset };
      if (auditActionFilter) params.action = auditActionFilter;

      const response = await api.get('/admin/audit-logs', { params });
      setAuditLogs(response.data);
    } catch (err) {
      console.error('Failed to load audit logs', err);
    }
  };

  useEffect(() => {
    fetchUsersList();
  }, [userSearch, userPlanFilter, userStatusFilter, userVerifyFilter]);

  useEffect(() => {
    fetchAuditLogs();
  }, [auditActionFilter, auditLimit, auditOffset]);

  // Operations
  const handleClearCache = async () => {
    try {
      setClearingCache(true);
      setError(null);
      setSuccessMsg(null);
      await api.post('/admin/cache/clear');
      setSuccessMsg('Redis & memory cache cleared successfully!');
      fetchHealth();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to clear cache.');
    } finally {
      setClearingCache(false);
    }
  };

  const handleToggleUserActive = async (user: UserData) => {
    const targetAction = user.is_active ? 'disable' : 'enable';
    const confirm = await showConfirm(
      "Toggle User Account Status",
      `Are you sure you want to ${targetAction} user account: ${user.email}?`,
      user.is_active ? 'danger' : 'info',
      user.is_active ? 'Disable' : 'Enable'
    );
    if (!confirm) return;

    try {
      setUpdatingUserId(user.user_id);
      setError(null);
      setSuccessMsg(null);
      await api.post(`/admin/users/${user.user_id}/status`, { is_active: !user.is_active });
      setSuccessMsg(`User ${user.email} account has been ${user.is_active ? 'disabled' : 'enabled'} successfully.`);
      fetchUsersList();
      fetchAnalytics();
      fetchAuditLogs();
      if (selectedUserDetail?.user_id === user.user_id) {
        handleViewUserDetail(user);
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to toggle user status.');
    } finally {
      setUpdatingUserId(null);
    }
  };

  const handleToggleAdminRole = async (user: UserData) => {
    const targetAction = user.is_admin ? 'demote' : 'promote';
    const confirm = await showConfirm(
      "Modify Administrator Role",
      `Are you sure you want to ${targetAction} user: ${user.email} to/from administrator role?`,
      user.is_admin ? 'danger' : 'info',
      user.is_admin ? 'Demote' : 'Promote'
    );
    if (!confirm) return;

    try {
      setUpdatingUserId(user.user_id);
      setError(null);
      setSuccessMsg(null);
      if (user.is_admin) {
        await api.post(`/admin/users/${user.user_id}/demote`);
        setSuccessMsg(`Revoked administrative status from ${user.email}.`);
      } else {
        await api.post(`/admin/users/${user.user_id}/promote`);
        setSuccessMsg(`Successfully promoted ${user.email} to administrator.`);
      }
      fetchUsersList();
      fetchAuditLogs();
      if (selectedUserDetail?.user_id === user.user_id) {
        handleViewUserDetail({ ...user, is_admin: !user.is_admin });
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to modify user role.');
    } finally {
      setUpdatingUserId(null);
    }
  };

  const handleViewUserDetail = async (user: UserData) => {
    setSelectedUserDetail(user);
    setLoadingActivity(true);
    setUserActivity(null);
    try {
      const response = await api.get(`/admin/users/${user.user_id}/activity`);
      setUserActivity(response.data);
    } catch (err) {
      console.error('Failed to load user activity details', err);
    } finally {
      setLoadingActivity(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError(null);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
      setError(null);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError('Please select a video file to upload.');
      return;
    }

    setError(null);
    setSuccessMsg(null);
    setUploading(true);
    setUploadProgress(0);

    const formData = new FormData();
    formData.append('file', file);
    if (selectedMovieId) {
      formData.append('movie_id', selectedMovieId);
    }

    try {
      await api.post('/videos/admin/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setUploadProgress(percent);
          }
        },
      });

      setSuccessMsg(`Video file '${file.name}' uploaded and processed into HLS VOD format!`);
      setFile(null);
      setSelectedMovieId('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      fetchVideos();
      fetchAnalytics();
      fetchHealth();
      fetchAuditLogs();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to upload video asset. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleProcessHLS = async (videoId: string) => {
    setProcessingId(videoId);
    setError(null);
    setSuccessMsg(null);

    setVideos((prev) =>
      prev.map((v) => (v.video_id === videoId ? { ...v, status: 'processing' } : v))
    );

    try {
      await api.post(`/videos/admin/${videoId}/process-hls`);
      setSuccessMsg('HLS VOD processing successfully triggered.');
      await fetchVideos();
      fetchHealth();
      fetchAuditLogs();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to trigger HLS processing.');
      await fetchVideos();
    } finally {
      setProcessingId(null);
    }
  };

  const handleDeleteVideo = async (videoId: string) => {
    const confirm = await showConfirm(
      "Delete Video Asset",
      "Are you sure you want to delete this video asset?",
      "danger",
      "Delete"
    );
    if (!confirm) return;

    try {
      await api.delete(`/videos/admin/${videoId}`);
      setVideos((prev) => prev.filter((v) => v.video_id !== videoId));
      if (activePreviewVideo?.video_id === videoId) {
        setActivePreviewVideo(null);
      }
      fetchAnalytics();
      fetchHealth();
      fetchAuditLogs();
    } catch (err) {
      showAlert("Error", "Failed to delete video asset.", "danger");
    }
  };

  // Helper utilities
  const formatFileSize = (bytes: number): string => {
    if (!bytes || bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getMovieTitle = (movieId: string | null): string => {
    if (!movieId) return 'Unlinked';
    const found = movies.find((m) => m.movie_id === movieId);
    return found ? `${found.title} (${found.release_year})` : 'Unlinked';
  };

  return (
    <div className="min-h-screen bg-brand-background text-white font-sans selection:bg-brand-accent selection:text-white pb-20 relative overflow-hidden">
      {/* Cinematic ambient background glow circles */}
      <div className="absolute top-[-10%] right-[-10%] w-[50vw] h-[50vw] rounded-full bg-brand-accent/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[20%] left-[-10%] w-[40vw] h-[40vw] rounded-full bg-blue-500/5 blur-[100px] pointer-events-none" />

      {/* Top Navbar */}
      <header className="border-b border-white/5 bg-[#060b18]/65 backdrop-blur-xl sticky top-0 z-40 px-8 py-4 flex items-center justify-between shadow-[0_4px_30px_rgba(0,0,0,0.4)]">
        <div className="flex items-center gap-6">
          <Link to="/" className="text-xl font-black text-brand-accent tracking-widest font-display uppercase hover:scale-[1.01] transition-transform select-none">
            ZEPLAY STUDIO
          </Link>
          <span className="text-[9px] font-black tracking-widest uppercase bg-brand-accent/15 border border-brand-accent/35 px-3 py-1 rounded-full text-brand-accent shadow-inner">
            Media Hub Console
          </span>
        </div>
        <div className="flex items-center gap-4">
          <Link 
            to="/" 
            className="px-4 py-2.5 border border-white/10 hover:border-white/20 bg-white/5 hover:bg-white/10 text-xs font-black uppercase tracking-wider rounded-xl transition-all active:scale-95 cursor-pointer flex items-center gap-1.5 shadow-md"
          >
            <span>Exit Studio</span>
            <svg className="w-3.5 h-3.5 text-neutral-450" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </Link>
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-accent to-blue-750 flex items-center justify-center font-black text-xs text-white shadow-md shadow-blue-500/20 select-none">
            A
          </div>
        </div>
      </header>

      {/* Main Workspace Container */}
      <div className="max-w-7xl mx-auto px-8 pt-10 relative z-10 space-y-8">

        {/* Page Title */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-black tracking-tight uppercase font-display leading-none text-white">Studio Workspace</h1>
            <p className="text-xs text-brand-textMuted mt-2 font-medium max-w-xl">
              Publish and edit media catalog titles, ingest raw video streams, observe database engine cache states, and manage member user credentials.
            </p>
          </div>
        </div>

        {/* Dynamic Notification Badges */}
        {error && (
          <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs rounded-2xl flex items-center gap-3 animate-scaleIn shadow-lg">
            <span className="font-extrabold uppercase bg-rose-500 text-white px-2.5 py-0.5 rounded-lg text-[9px] tracking-wider">ERROR</span>
            <span className="font-semibold">{error}</span>
          </div>
        )}
        {successMsg && (
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs rounded-2xl flex items-center gap-3 animate-scaleIn shadow-lg">
            <span className="font-extrabold uppercase bg-emerald-500 text-white px-2.5 py-0.5 rounded-lg text-[9px] tracking-wider">SUCCESS</span>
            <span className="font-semibold">{successMsg}</span>
          </div>
        )}

        {/* Dashboard Tabs bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 select-none">
          {[
            { id: 'overview', label: 'Overview', icon: '📊', desc: 'System metrics' },
            { id: 'content', label: 'Analytics', icon: '📈', desc: 'Ratings & Views' },
            { id: 'users', label: 'Users', icon: '👥', desc: 'Access Control' },
            { id: 'ingestion', label: 'Ingestion', icon: '📤', desc: 'Video assets' },
            { id: 'movies_manage', label: 'Catalog', icon: '🎬', desc: 'Movies directory' },
            { id: 'health', label: 'Services', icon: '⚡', desc: 'DB & Redis health' },
            { id: 'audit', label: 'Security', icon: '🛡️', desc: 'Audit trails' },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => {
                setActiveTab(t.id as any);
                setError(null);
                setSuccessMsg(null);
              }}
              className={`flex flex-col items-start p-4 rounded-2xl border transition-all duration-300 text-left group cursor-pointer hover:-translate-y-0.5 active:scale-98 ${activeTab === t.id
                  ? 'bg-brand-accent/15 border-brand-accent/50 text-white shadow-[0_10px_25px_rgba(59,130,246,0.12)] font-black'
                  : 'bg-[#0b1225]/40 border-white/5 text-neutral-400 hover:border-white/12 hover:text-white'
                }`}
            >
              <span className="text-xl mb-2 group-hover:scale-110 transition-transform duration-250">{t.icon}</span>
              <span className="text-xs font-extrabold uppercase tracking-wider block leading-none">{t.label}</span>
              <span className="text-[9px] text-neutral-500 font-bold block mt-1.5 uppercase tracking-tight">{t.desc}</span>
            </button>
          ))}
        </div>

        {/* Tab 1: System Overview */}
        {activeTab === 'overview' && analytics && (
          <div className="space-y-8 animate-fadeIn">
            {/* Grid of Key Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { label: 'Total Users', value: analytics.total_users, desc: `${analytics.free_users} Free / ${analytics.premium_users} Premium`, icon: '👥', color: 'from-blue-500/20 to-indigo-500/5' },
                { label: 'Total Profiles', value: analytics.total_profiles, desc: 'Across all active accounts', icon: '👤', color: 'from-purple-500/20 to-pink-500/5' },
                { label: 'Catalog Movies', value: analytics.total_movies, desc: `Ingested HLS Assets: ${analytics.total_videos}`, icon: '🎬', color: 'from-amber-500/20 to-orange-500/5' },
                { label: 'Total Views', value: analytics.total_views, desc: 'Aggregated video playback sessions', icon: '👁', color: 'from-emerald-500/20 to-teal-500/5' },
                { label: 'Total Watch Time', value: `${Math.round(analytics.total_watch_time / 60)} hrs`, desc: 'Accumulated streaming duration', icon: '⏱', color: 'from-cyan-500/20 to-blue-500/5' },
                { label: 'Active Viewers', value: analytics.active_users, desc: 'Unique playback users tracked', icon: '🔥', color: 'from-rose-500/20 to-red-500/5' },
                { label: 'Premium Conversion', value: `${analytics.conversion_rate}%`, desc: 'Ratio of paying subscriber accounts', icon: '💎', color: 'from-violet-500/20 to-fuchsia-500/5' },
              ].map((m, idx) => (
                <div key={idx} className="bg-gradient-to-br from-[#0c142c]/90 to-[#070b16]/95 border border-white/10 p-6 rounded-3xl backdrop-blur-xl shadow-xl flex items-center justify-between group hover:border-brand-accent/40 hover:shadow-[0_10px_30px_rgba(59,130,246,0.1)] transition-all duration-300">
                  <div className="space-y-2">
                    <span className="text-[9px] uppercase font-black tracking-[0.2em] text-neutral-450">{m.label}</span>
                    <div className="text-3xl font-black text-white font-display tracking-tight group-hover:text-brand-accent transition-colors">{m.value}</div>
                    <div className="text-[10px] text-neutral-500 font-semibold">{m.desc}</div>
                  </div>
                  <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${m.color} border border-white/5 flex items-center justify-center text-xl shadow-inner group-hover:scale-110 transition-transform duration-300`}>
                    {m.icon}
                  </div>
                </div>
              ))}
            </div>

            {/* Retention & Watch Time Performance */}
            <div className="bg-gradient-to-br from-[#0c142c]/90 to-[#070b16]/95 border border-white/10 p-6 rounded-3xl backdrop-blur-xl shadow-xl">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-sm font-black uppercase tracking-wider text-brand-accent font-display">Retention & Watch Time Performance</h2>
                  <p className="text-[10px] text-neutral-500 mt-1 font-semibold">Analytical distribution represents hourly Watch Time trend over the past 12 months</p>
                </div>
                <div className="bg-white/5 border border-white/10 px-3 py-1.5 rounded-xl text-xs font-bold text-amber-400">
                  Average User Watch Time: {analytics.average_watch_time} mins
                </div>
              </div>
              <div className="h-64 flex items-end gap-3 pt-6 border-b border-white/5 pb-2">
                {[45, 60, 55, 80, 70, 95, 85, 110, 90, 120, 130, 150].map((val, idx) => (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-2 h-full justify-end group">
                    <div
                      style={{ height: `${(val / 150) * 100}%` }}
                      className="w-full bg-gradient-to-t from-brand-accent/20 via-brand-accent/50 to-brand-accent rounded-t-lg relative cursor-pointer hover:shadow-[0_0_15px_rgba(59,130,246,0.5)] transition-all duration-300"
                    >
                      <div className="opacity-0 group-hover:opacity-100 absolute -top-10 left-1/2 -translate-x-1/2 bg-[#0c142c] border border-brand-accent/30 text-white font-black text-[10px] px-2.5 py-1 rounded-xl transition-all whitespace-nowrap shadow-2xl z-10">
                        {val} hrs
                      </div>
                    </div>
                    <span className="text-[9px] font-black text-neutral-500 uppercase tracking-wider mt-1">{['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][idx]}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Content Analytics */}
        {activeTab === 'content' && contentRankings && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-fadeIn">
            {/* 1. Most Watched Movies */}
            <div className="bg-gradient-to-br from-[#0c142c]/90 to-[#070b16]/95 border border-white/10 p-6 rounded-3xl backdrop-blur-xl shadow-xl">
              <h2 className="text-sm font-black uppercase mb-5 tracking-wider text-brand-accent font-display">Most Watched Movies</h2>
              <div className="space-y-4">
                {contentRankings.most_watched_movies.map((m, idx) => (
                  <div key={m.movie_id} className="flex items-center justify-between border-b border-white/5 pb-3.5 last:border-b-0 last:pb-0 group">
                    <div className="flex items-center gap-4">
                      <span className={`text-xs font-black w-5 text-center ${idx === 0 ? 'text-amber-400' : idx === 1 ? 'text-neutral-400' : idx === 2 ? 'text-amber-600' : 'text-neutral-500'}`}>
                        #{idx + 1}
                      </span>
                      <div className="w-14 h-9 bg-neutral-905 rounded-lg overflow-hidden border border-white/10 flex-shrink-0 relative flex items-center justify-center">
                        {m.thumbnail_url ? (
                          <img src={m.thumbnail_url} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" alt="" />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-neutral-850 to-neutral-950 flex items-center justify-center text-[8px] font-black text-neutral-500">ZEPLAY</div>
                        )}
                      </div>
                      <span className="text-xs font-bold text-white group-hover:text-brand-accent transition-colors">{m.title}</span>
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-wider bg-white/5 border border-white/10 px-3 py-1 rounded-xl text-neutral-350">{m.views} views</span>
                  </div>
                ))}
              </div>
            </div>



            {/* 3. Most Added to Watchlist */}
            <div className="bg-gradient-to-br from-[#0c142c]/90 to-[#070b16]/95 border border-white/10 p-6 rounded-3xl backdrop-blur-xl shadow-xl">
              <h2 className="text-sm font-black uppercase mb-5 tracking-wider text-brand-accent font-display">Most Added to Watchlist</h2>
              <div className="space-y-4">
                {contentRankings.most_added_watchlist.map((m, idx) => (
                  <div key={m.movie_id} className="flex items-center justify-between border-b border-white/5 pb-3.5 last:border-b-0 last:pb-0 group">
                    <div className="flex items-center gap-4">
                      <span className={`text-xs font-black w-5 text-center ${idx === 0 ? 'text-amber-400' : idx === 1 ? 'text-neutral-400' : idx === 2 ? 'text-amber-600' : 'text-neutral-500'}`}>
                        #{idx + 1}
                      </span>
                      <div className="w-14 h-9 bg-neutral-905 rounded-lg overflow-hidden border border-white/10 flex-shrink-0 relative flex items-center justify-center">
                        {m.thumbnail_url ? (
                          <img src={m.thumbnail_url} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" alt="" />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-neutral-850 to-neutral-950 flex items-center justify-center text-[8px] font-black text-neutral-500">ZEPLAY</div>
                        )}
                      </div>
                      <span className="text-xs font-bold text-white group-hover:text-brand-accent transition-colors">{m.title}</span>
                    </div>
                    <span className="text-[10px] font-black text-brand-accent bg-brand-accent/10 border border-brand-accent/20 px-3 py-1 rounded-xl">+{m.saves} saves</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 4. Category & Genre Popularity */}
            <div className="bg-gradient-to-br from-[#0c142c]/90 to-[#070b16]/95 border border-white/10 p-6 rounded-3xl backdrop-blur-xl shadow-xl space-y-6">
              <div>
                <h2 className="text-sm font-black uppercase mb-4 tracking-wider text-brand-accent font-display">Genre Popularity</h2>
                <div className="flex flex-wrap gap-2.5">
                  {contentRankings.most_popular_genres.map((g) => (
                    <span key={g.genre_id} className="text-xs bg-white/[0.03] border border-white/10 px-3.5 py-2 rounded-xl font-extrabold flex items-center gap-2.5 hover:bg-white/[0.08] transition-colors">
                      <span>{g.name}</span> 
                      <span className="text-[9px] text-neutral-450 bg-black/45 px-2 py-0.5 rounded-md font-mono">{g.count} titles</span>
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <h2 className="text-sm font-black uppercase mb-4 tracking-wider text-brand-accent font-display">Most Watched Categories</h2>
                <div className="space-y-3">
                  {contentRankings.most_watched_categories.map((c) => (
                    <div key={c.genre_id} className="flex items-center justify-between text-xs border-b border-white/5 pb-2.5 last:border-none last:pb-0">
                      <span className="font-bold text-neutral-300">{c.name}</span>
                      <span className="font-mono font-black text-neutral-450 bg-white/5 px-2 py-0.5 rounded">{c.views} views</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: User Management */}
        {activeTab === 'users' && (
          <div className="space-y-6 animate-fadeIn">
            {/* Search and Filters */}
            <div className="bg-gradient-to-br from-[#0c142c]/90 to-[#070b16]/95 border border-white/10 p-6 rounded-3xl backdrop-blur-xl flex flex-wrap gap-4 items-center justify-between shadow-lg">
              <input
                type="text"
                placeholder="Search registered users by name or email..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="flex-1 min-w-[280px] px-4 py-3 bg-[#050913]/60 border border-white/10 rounded-2xl text-xs text-white placeholder:text-neutral-500 focus:outline-none focus:border-brand-accent transition-all input-premium"
              />

              <div className="flex flex-wrap gap-3">
                <select
                  value={userPlanFilter}
                  onChange={(e) => setUserPlanFilter(e.target.value)}
                  className="px-4 py-3 bg-[#050913]/60 border border-white/10 rounded-2xl text-xs text-neutral-400 focus:outline-none focus:text-white cursor-pointer"
                >
                  <option value="">All Subscription Plans</option>
                  <option value="free">Free Tier</option>
                  <option value="premium">Premium Tier</option>
                </select>

                <select
                  value={userStatusFilter}
                  onChange={(e) => setUserStatusFilter(e.target.value)}
                  className="px-4 py-3 bg-[#050913]/60 border border-white/10 rounded-2xl text-xs text-neutral-400 focus:outline-none focus:text-white cursor-pointer"
                >
                  <option value="">All Statuses</option>
                  <option value="active">Active Only</option>
                  <option value="disabled">Disabled Only</option>
                </select>

                <select
                  value={userVerifyFilter}
                  onChange={(e) => setUserVerifyFilter(e.target.value)}
                  className="px-4 py-3 bg-[#050913]/60 border border-white/10 rounded-2xl text-xs text-neutral-400 focus:outline-none focus:text-white cursor-pointer"
                >
                  <option value="">All Verification States</option>
                  <option value="verified">Verified Only</option>
                  <option value="pending">Pending Verification</option>
                </select>
              </div>
            </div>

            {/* List and Details Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Users list rendered as a stack of gorgeous user cards */}
              <div className="lg:col-span-2 space-y-4 pr-1 overflow-y-auto max-h-[650px] scrollbar-hide">
                {users.length === 0 ? (
                  <div className="p-12 text-center text-brand-textMuted bg-[#0c142c]/60 border border-white/5 rounded-3xl text-sm font-semibold">
                    No matching users found in directory.
                  </div>
                ) : (
                  users.map((u) => (
                    <div
                      key={u.user_id}
                      onClick={() => handleViewUserDetail(u)}
                      className={`p-5 rounded-[24px] border transition-all duration-300 cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                        selectedUserDetail?.user_id === u.user_id
                          ? 'bg-brand-accent/10 border-brand-accent/40 shadow-lg shadow-brand-accent/5'
                          : 'bg-gradient-to-br from-[#0c142c]/90 to-[#070b16]/95 border-white/5 hover:border-white/15'
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-brand-accent to-blue-700 flex items-center justify-center font-black text-lg text-white shadow-md shadow-blue-500/10 shrink-0">
                          {u.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-extrabold text-sm text-white truncate">{u.name}</span>
                            {u.is_admin && (
                              <span className="text-[8px] bg-brand-accent/15 border border-brand-accent/30 text-brand-accent px-2 py-0.5 rounded-full uppercase font-black tracking-widest shrink-0">Admin</span>
                            )}
                            <span className={`text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border shrink-0 ${
                              u.subscription_plan === 'premium'
                                ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                                : 'bg-neutral-800 border-neutral-750 text-neutral-450'
                            }`}>
                              {u.subscription_plan}
                            </span>
                          </div>
                          <span className="text-[10px] text-neutral-450 font-mono block select-text truncate">{u.email}</span>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4 sm:self-center self-end" onClick={(e) => e.stopPropagation()}>
                        <div className="flex flex-col items-end gap-1.5 mr-1 shrink-0">
                          <span className="text-[8px] text-neutral-500 font-bold uppercase tracking-wider">Verification</span>
                          {u.is_verified ? (
                            <span className="text-[9px] font-black text-emerald-400 bg-emerald-500/10 px-2 rounded-md border border-emerald-500/20">Verified</span>
                          ) : (
                            <span className="text-[9px] font-black text-amber-400 bg-amber-500/10 px-2 rounded-md border border-amber-500/20">Pending</span>
                          )}
                        </div>

                        <div className="flex flex-col items-end gap-1.5 mr-3 shrink-0">
                          <span className="text-[8px] text-neutral-500 font-bold uppercase tracking-wider">Status</span>
                          {u.is_active ? (
                            <span className="text-[9px] font-black text-emerald-400 bg-emerald-500/10 px-2 rounded-md border border-emerald-500/20">Active</span>
                          ) : (
                            <span className="text-[9px] font-black text-rose-400 bg-rose-500/10 px-2 rounded-md border border-rose-500/20">Disabled</span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => handleToggleUserActive(u)}
                            disabled={updatingUserId === u.user_id}
                            className={`px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-wider border transition-all active:scale-95 cursor-pointer ${
                              u.is_active
                                ? 'bg-rose-500/10 hover:bg-rose-500/25 text-rose-300 border-rose-500/20'
                                : 'bg-emerald-500/10 hover:bg-emerald-500/25 text-emerald-300 border-emerald-500/20'
                            }`}
                          >
                            {u.is_active ? 'Disable' : 'Enable'}
                          </button>
                          <button
                            onClick={() => handleToggleAdminRole(u)}
                            disabled={updatingUserId === u.user_id}
                            className={`px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-wider border transition-all active:scale-95 cursor-pointer ${
                              u.is_admin
                                ? 'bg-neutral-800 hover:bg-neutral-750 text-neutral-350 border-white/5'
                                : 'bg-brand-accent/20 hover:bg-brand-accent/30 text-brand-accent border-brand-accent/30'
                            }`}
                          >
                            {u.is_admin ? 'Revoke' : 'Promote'}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* User detail activity panels */}
              <div className="bg-gradient-to-br from-[#0c142c]/90 to-[#070b16]/95 border border-white/10 p-6 rounded-3xl backdrop-blur-xl shadow-xl space-y-6">
                <h3 className="text-xs font-black uppercase text-brand-accent tracking-wider font-display">User Audit Details & Activity</h3>

                {!selectedUserDetail ? (
                  <div className="text-center py-24 text-xs text-neutral-500">
                    Select a user from the directory deck to audit watch history, ratings, and profile logs.
                  </div>
                ) : (
                  <div className="space-y-6 animate-fadeIn">
                    {/* Core details */}
                    <div className="border-b border-white/5 pb-4 space-y-3">
                      <div>
                        <h4 className="text-sm font-black text-white">{selectedUserDetail.name}</h4>
                        <p className="text-[10px] text-neutral-450 font-mono mt-0.5">{selectedUserDetail.email}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-4 pt-1 text-[10px]">
                        <div>
                          <span className="text-neutral-500 block uppercase font-bold tracking-wider">Subscription Plan</span>
                          <span className="font-extrabold text-white uppercase mt-1 block">{selectedUserDetail.subscription_plan}</span>
                        </div>
                        <div>
                          <span className="text-neutral-500 block uppercase font-bold tracking-wider">Profiles</span>
                          <span className="font-extrabold text-white mt-1 block">{selectedUserDetail.profile_count} / {selectedUserDetail.subscription_plan === 'premium' ? 4 : 1}</span>
                        </div>
                      </div>
                    </div>

                    {/* Activity log loading */}
                    {loadingActivity && (
                      <div className="text-center py-12 text-xs text-neutral-500 animate-pulse">
                        Loading activity logs...
                      </div>
                    )}

                    {/* User Activity Content */}
                    {userActivity && (
                      <div className="space-y-6">
                        {/* Profiles list */}
                        <div>
                          <span className="text-[9px] uppercase font-bold text-neutral-500 block mb-2 tracking-wider">Registered Profile Personas</span>
                          <div className="flex flex-wrap gap-2">
                            {userActivity.profiles.map((p) => (
                              <span key={p.profile_id} className="text-[10px] bg-white/[0.03] border border-white/5 px-2.5 py-1 rounded-xl font-bold flex items-center gap-1.5">
                                <span>{p.is_kids_profile ? '🧒' : '🍿'}</span>
                                <span>{p.display_name}</span>
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Recent Watch history */}
                        <div>
                          <span className="text-[9px] uppercase font-bold text-neutral-500 block mb-2 tracking-wider">Recent Playback Sessions</span>
                          {userActivity.watch_history.length === 0 ? (
                            <span className="text-[10px] text-neutral-500 block italic">No history records found.</span>
                          ) : (
                            <div className="space-y-2">
                              {userActivity.watch_history.map((h) => (
                                <div key={h.history_id} className="flex justify-between items-center text-[10px] border-b border-white/5 pb-2">
                                  <span className="font-bold text-neutral-300 truncate max-w-[150px]">{h.movie_title}</span>
                                  <span className="text-neutral-450 font-mono">{h.percentage_watched}% watched</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* User Ratings */}
                        <div>
                          <span className="text-[9px] uppercase font-bold text-neutral-500 block mb-2 tracking-wider">Content Ratings Submitted</span>
                          {userActivity.ratings.length === 0 ? (
                            <span className="text-[10px] text-neutral-500 block italic">No reviews submitted yet.</span>
                          ) : (
                            <div className="space-y-2">
                              {userActivity.ratings.map((r) => (
                                <div key={r.rating_id} className="flex justify-between items-center text-[10px]">
                                  <span className="font-bold text-neutral-300">{r.movie_title}</span>
                                  <span className="text-amber-400 font-bold">★ {r.score}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Performed Audit logs */}
                        <div>
                          <span className="text-[9px] uppercase font-bold text-neutral-500 block mb-2 tracking-wider">Security Events Feed</span>
                          {userActivity.audit_logs.length === 0 ? (
                            <span className="text-[10px] text-neutral-500 block italic">No security events triggered.</span>
                          ) : (
                            <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                              {userActivity.audit_logs.map((l) => (
                                <div key={l.log_id} className="text-[10px] border-b border-white/5 pb-2 last:border-b-0">
                                  <div className="flex justify-between font-bold text-brand-accent">
                                    <span>{l.action}</span>
                                    <span className="text-neutral-500 font-mono text-[8px]">{new Date(l.created_at).toLocaleDateString()}</span>
                                  </div>
                                  <p className="text-neutral-450 text-[9px] mt-0.5 leading-snug">{l.details}</p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Ingestion */}
        {activeTab === 'ingestion' && (
          <div className="space-y-8 animate-fadeIn">
            {/* Catalog Upload Form */}
            <div className="bg-gradient-to-br from-[#0c142c]/90 to-[#070b16]/95 border border-white/10 p-8 rounded-[32px] backdrop-blur-xl shadow-2xl space-y-6">
              <h2 className="text-lg font-extrabold uppercase tracking-wide text-brand-accent font-display">Ingest Video Catalog</h2>
              <form onSubmit={handleUpload} className="space-y-6">
                {/* Select Movie Linkage */}
                <div>
                  <label className="text-[10px] font-black uppercase text-brand-textMuted block mb-2 tracking-wider">
                    Link to Catalog Movie Entry (Optional)
                  </label>
                  <select
                    value={selectedMovieId}
                    onChange={(e) => setSelectedMovieId(e.target.value)}
                    className="w-full px-4 py-3 bg-[#050913]/60 border border-white/10 focus:border-brand-accent/50 focus:ring-1 focus:ring-brand-accent/15 rounded-2xl text-xs text-white focus:outline-none transition-all cursor-pointer select-none input-premium font-semibold"
                  >
                    <option value="" className="bg-[#0b1225] text-white">Unlinked (Orphan Video Asset)</option>
                    {movies.map((m) => (
                      <option key={m.movie_id} value={m.movie_id} className="bg-[#0b1225] text-white font-sans font-semibold">
                        {m.title} ({m.release_year})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Drag and Drop Zone */}
                <div>
                  <label className="text-[10px] font-black uppercase text-brand-textMuted block mb-2 tracking-wider">
                    Video File Asset
                  </label>
                  <div
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-white/10 hover:border-brand-accent/30 bg-black/15 hover:bg-brand-accent/5 rounded-2xl p-10 text-center cursor-pointer transition-all duration-350 ease-[var(--ease-out-premium)] active:scale-[0.99] select-none"
                  >
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      accept="video/*"
                      className="hidden"
                    />
                    <div className="text-4xl mb-3">📤</div>
                    {file ? (
                      <div className="space-y-1">
                        <span className="text-xs font-bold text-white block truncate max-w-md mx-auto">{file.name}</span>
                        <span className="text-[10px] text-neutral-450 block font-mono font-bold">{formatFileSize(file.size)}</span>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <span className="text-xs font-bold text-neutral-350 block">Drag & drop your movie file here, or click to browse</span>
                        <span className="text-[10px] text-neutral-500 block font-semibold">Supports MP4, MKV, AVI, MOV formats</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Upload Status */}
                {uploading && (
                  <div className="space-y-2 animate-pulse">
                    <div className="flex justify-between text-[10px] font-extrabold uppercase text-brand-accent tracking-wider">
                      <span>Ingesting catalog video file...</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <div className="w-full bg-white/5 h-2.5 rounded-full overflow-hidden border border-white/5">
                      <div
                        style={{ width: `${uploadProgress}%` }}
                        className="bg-brand-accent h-full rounded-full transition-all duration-300 shadow-[0_0_8px_rgba(59,130,246,0.7)]"
                      />
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={uploading || !file}
                  className="w-full py-4 bg-brand-accent text-white hover:bg-blue-600 disabled:bg-neutral-800/40 disabled:text-neutral-600 disabled:border-transparent disabled:cursor-not-allowed rounded-2xl text-xs font-extrabold uppercase tracking-widest transition-all shadow-xl btn-premium select-none cursor-pointer active:scale-[0.98]"
                >
                  {uploading ? 'Processing Video...' : 'Ingest and Process Asset'}
                </button>
              </form>
            </div>

            {/* List of Ingested Videos (Redesigned as Grid of Assets) */}
            <div className="bg-gradient-to-br from-[#0c142c]/90 to-[#070b16]/95 border border-white/10 rounded-[32px] overflow-hidden backdrop-blur-xl shadow-2xl">
              <div className="p-6 border-b border-white/5 flex items-center justify-between bg-black/15">
                <h3 className="text-xs font-black uppercase tracking-wider text-brand-accent font-display">Ingested Video Assets</h3>
                <span className="text-[9px] font-black uppercase tracking-widest bg-white/5 border border-white/10 px-3 py-1 rounded-full text-brand-textMuted">Total Assets: {videos.length}</span>
              </div>

              {videos.length === 0 ? (
                <div className="p-16 text-center text-brand-textMuted text-xs font-semibold">
                  No ingested video assets found in storage.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6">
                  {videos.map((v) => (
                    <div key={v.video_id} className="bg-black/30 border border-white/5 hover:border-white/15 p-5 rounded-2xl flex flex-col justify-between space-y-4 transition-all duration-300">
                      <div className="space-y-3">
                        <div className="flex justify-between items-start gap-4">
                          <div className="min-w-0">
                            <span className="font-extrabold text-sm text-white block truncate" title={v.original_filename}>
                              {v.original_filename}
                            </span>
                            <span className="text-[9px] text-neutral-500 font-mono block truncate mt-0.5" title={v.filename}>
                              {v.filename}
                            </span>
                          </div>
                          
                          {/* Ingestion Status Badges */}
                          <div>
                            {v.status === 'completed' ? (
                              <span className="text-[8px] font-black tracking-widest text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20 block text-center">COMPLETED</span>
                            ) : v.status === 'processing' ? (
                              <span className="text-[8px] font-black tracking-widest text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20 block text-center animate-pulse">PROCESSING</span>
                            ) : v.status === 'uploaded' ? (
                              <span className="text-[8px] font-black tracking-widest text-blue-400 bg-blue-500/10 px-2.5 py-1 rounded-full border border-blue-500/20 block text-center">UPLOADED</span>
                            ) : (
                              <span className="text-[8px] font-black tracking-widest text-rose-400 bg-rose-500/10 px-2.5 py-1 rounded-full border border-rose-500/20 block text-center">FAILED</span>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 text-[10px]">
                          <div>
                            <span className="text-neutral-500 block uppercase font-bold tracking-wider">Linked Catalog Item</span>
                            <span className="font-extrabold text-neutral-250 mt-1 block truncate">{getMovieTitle(v.movie_id)}</span>
                          </div>
                          <div>
                            <span className="text-neutral-500 block uppercase font-bold tracking-wider">File Size</span>
                            <span className="font-mono text-neutral-300 mt-1 block">{formatFileSize(v.file_size_bytes)}</span>
                          </div>
                        </div>

                        {/* Processing progress bar */}
                        {v.status === 'processing' && (
                          <div className="space-y-1.5 pt-1">
                            <div className="flex justify-between text-[8px] font-extrabold uppercase text-amber-400 tracking-wider">
                              <span>Transcoding HLS ABR Segments...</span>
                              <span>{v.processing_progress ? `${v.processing_progress}%` : '0%'}</span>
                            </div>
                            <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden border border-white/5">
                              <div
                                style={{ width: `${v.processing_progress || 0}%` }}
                                className="bg-amber-400 h-full rounded-full transition-all duration-300 shadow-[0_0_8px_rgba(245,158,11,0.5)]"
                              />
                            </div>
                          </div>
                        )}

                        {v.error_message && (
                          <div className="bg-rose-500/10 border border-rose-500/20 text-rose-300 text-[10px] p-2.5 rounded-xl block leading-normal mt-2">
                            <span className="font-bold">Error:</span> {v.error_message}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/5">
                        {v.status === 'completed' && (
                          <button
                            type="button"
                            onClick={() => setActivePreviewVideo(v)}
                            className="px-3.5 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-[9px] font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer active:scale-95 btn-premium"
                          >
                            Preview
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleProcessHLS(v.video_id)}
                          disabled={processingId === v.video_id || v.status === 'processing'}
                          className="px-3.5 py-2 bg-brand-accent/15 hover:bg-brand-accent/25 text-brand-accent border border-brand-accent/30 disabled:opacity-50 text-[9px] font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer active:scale-95"
                        >
                          {processingId === v.video_id ? 'Processing...' : 'Reprocess HLS'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteVideo(v.video_id)}
                          className="px-3.5 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/25 text-[9px] font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer active:scale-95"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Video Playback Preview Modal */}
            {activePreviewVideo && (
              <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-50 p-8">
                <div className="bg-[#080d19]/95 border border-white/10 max-w-3xl w-full rounded-3xl overflow-hidden shadow-2xl relative transform animate-scaleIn">
                  <button
                    onClick={() => setActivePreviewVideo(null)}
                    className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-black/60 border border-white/10 hover:bg-brand-accent hover:border-brand-accent text-white flex items-center justify-center font-bold transition-all active:scale-90 cursor-pointer"
                  >
                    ×
                  </button>
                  <div className="p-6 border-b border-white/5 bg-black/10">
                    <h3 className="text-sm font-black uppercase text-brand-accent tracking-wider font-display">{activePreviewVideo.original_filename}</h3>
                    <p className="text-[10px] text-neutral-450 mt-1 font-mono font-bold">Status: HLS Adaptive Streaming Ready</p>
                  </div>
                  <div className="aspect-video bg-black flex items-center justify-center">
                    <video
                      controls
                      autoPlay
                      className="w-full h-full object-contain"
                      src={`/api/videos/${activePreviewVideo.video_id}/stream`}
                    />
                  </div>
                  <div className="p-6 border-t border-white/5 bg-black/25 flex items-center justify-between text-[10px] text-brand-textMuted">
                    <span>Mime-Type: {activePreviewVideo.mime_type}</span>
                    <span className="font-mono">UUID: {activePreviewVideo.video_id}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab: Manage Catalog Movies */}
        {activeTab === 'movies_manage' && (
          <div className="space-y-8 animate-fadeIn">
            <div className="bg-gradient-to-br from-[#0c142c]/90 to-[#070b16]/95 border border-white/10 p-6 rounded-3xl backdrop-blur-xl">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-sm font-black uppercase tracking-wider text-brand-accent font-display">Catalog Movies Directory</h2>
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-brand-textMuted bg-white/5 border border-white/10 px-2.5 py-1 rounded-full">Total: {catalogMovies.length}</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {catalogMovies.map((m) => (
                  <div key={m.movie_id} className="bg-gradient-to-br from-[#0c142c]/90 to-[#070b16]/95 border border-white/10 hover:border-brand-accent/30 p-5 rounded-[24px] flex flex-col justify-between space-y-4 transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_20px_45px_rgba(0,0,0,0.5)] group relative">
                    <div className="flex gap-4">
                      {/* Movie poster preview using PremiumPoster fallback if needed */}
                      <div className="w-20 h-28 bg-[#040811] rounded-xl overflow-hidden flex-shrink-0 border border-white/10 relative flex items-center justify-center">
                        <img 
                          src={m.thumbnail_url} 
                          className="absolute inset-0 w-full h-full object-cover z-10" 
                          alt="" 
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                        <div className="absolute inset-0 flex items-center justify-center p-2">
                          <PremiumPoster title={m.title} aspectRatio="portrait" />
                        </div>
                      </div>
                      
                      <div className="space-y-1.5 flex-grow min-w-0">
                        <h4 className="text-sm font-black text-white uppercase truncate font-display group-hover:text-brand-accent transition-colors">{m.title}</h4>
                        <div className="flex items-center gap-1.5 text-[9px] text-neutral-450 font-bold uppercase font-sans">
                          <span className="text-brand-accent">{m.release_year}</span>
                          <span>•</span>
                          <span>{m.duration_minutes}m</span>
                          <span>•</span>
                          <span className="bg-white/5 border border-white/10 px-1 rounded text-[7px] text-white">4K</span>
                        </div>
                        <p className="text-[10px] text-neutral-450 line-clamp-3 leading-relaxed mt-1">{m.description}</p>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-white/5">
                      <button
                        type="button"
                        onClick={() => handleStartEdit(m)}
                        className="w-full py-2.5 bg-brand-accent/15 hover:bg-brand-accent/25 text-brand-accent hover:text-white border border-brand-accent/25 hover:border-brand-accent/50 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer select-none active:scale-[0.98] btn-premium"
                      >
                        Edit Metadata & Poster
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Movie Edit Modal */}
            {editingMovie && (
              <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-50 p-8">
                <div className="bg-[#0b1225] border border-white/10 max-w-lg w-full rounded-[32px] overflow-hidden shadow-2xl relative transform animate-scaleIn">
                  <button
                    onClick={() => setEditingMovie(null)}
                    className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-black/60 border border-white/10 hover:bg-brand-accent hover:border-brand-accent text-white flex items-center justify-center font-bold transition-all active:scale-90"
                  >
                    ×
                  </button>

                  <div className="p-6 border-b border-white/5 bg-black/10">
                    <h3 className="text-sm font-black uppercase text-brand-accent tracking-wide font-display">Edit Movie Metadata</h3>
                    <p className="text-[9px] text-neutral-450 mt-1 font-mono">ID: {editingMovie.movie_id}</p>
                  </div>

                  <form onSubmit={handleSaveMovie} className="p-6 space-y-5">
                    <div>
                      <label className="text-[9px] font-black uppercase text-brand-textMuted block mb-1.5 tracking-wider">Movie Title</label>
                      <input
                        type="text"
                        required
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className="w-full px-4 py-3 bg-[#050913]/60 border border-white/10 rounded-2xl text-xs text-white focus:outline-none focus:border-brand-accent transition-all input-premium"
                      />
                    </div>

                    <div>
                      <label className="text-[9px] font-black uppercase text-brand-textMuted block mb-1.5 tracking-wider">Description</label>
                      <textarea
                        required
                        rows={3}
                        value={editDesc}
                        onChange={(e) => setEditDesc(e.target.value)}
                        className="w-full px-4 py-3 bg-[#050913]/60 border border-white/10 rounded-2xl text-xs text-white focus:outline-none focus:border-brand-accent transition-all resize-none input-premium"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[9px] font-black uppercase text-brand-textMuted block mb-1.5 tracking-wider">Release Year</label>
                        <input
                          type="number"
                          required
                          value={editYear}
                          onChange={(e) => setEditYear(parseInt(e.target.value))}
                          className="w-full px-4 py-3 bg-[#050913]/60 border border-white/10 rounded-2xl text-xs text-white focus:outline-none focus:border-brand-accent transition-all input-premium"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-black uppercase text-brand-textMuted block mb-1.5 tracking-wider">Duration (mins)</label>
                        <input
                          type="number"
                          required
                          value={editDuration}
                          onChange={(e) => setEditDuration(parseInt(e.target.value))}
                          className="w-full px-4 py-3 bg-[#050913]/60 border border-white/10 rounded-2xl text-xs text-white focus:outline-none focus:border-brand-accent transition-all input-premium"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[9px] font-black uppercase text-brand-textMuted block mb-2 tracking-wider">Upload / Replace Poster Image</label>
                      <div className="flex gap-4 items-center">
                        <div className="w-16 h-24 bg-black/40 border border-white/10 rounded-xl overflow-hidden flex-shrink-0 relative group flex items-center justify-center">
                          {editPosterPreview ? (
                            <img src={editPosterPreview} className="w-full h-full object-cover" alt="" />
                          ) : (
                            <div className="text-[8px] text-neutral-600 font-bold">No Image</div>
                          )}
                          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                            <span className="text-[8px] font-black uppercase tracking-wider text-white">Preview</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => posterInputRef.current?.click()}
                          className="px-4 py-2.5 bg-white/5 hover:bg-white/10 text-neutral-300 text-[9px] font-black uppercase tracking-wider rounded-xl border border-white/10 transition-all cursor-pointer select-none active:scale-95"
                        >
                          Choose Poster Image
                        </button>
                        <input
                          type="file"
                          ref={posterInputRef}
                          accept="image/*"
                          onChange={handlePosterChange}
                          className="hidden"
                        />
                      </div>
                    </div>

                    <div className="pt-4 flex gap-4">
                      <button
                        type="submit"
                        disabled={savingMovie}
                        className="flex-1 py-3.5 bg-brand-accent text-white font-extrabold uppercase text-xs tracking-wider rounded-2xl shadow-xl hover:bg-blue-650 transition-colors active:scale-98 cursor-pointer select-none btn-premium"
                      >
                        {savingMovie ? 'Saving Changes...' : 'Save Changes'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingMovie(null)}
                        className="px-6 py-3.5 bg-white/5 hover:bg-white/10 text-neutral-300 text-xs font-extrabold rounded-2xl border border-white/10 transition-all cursor-pointer select-none active:scale-98"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 5: Infrastructure & Cache */}
        {activeTab === 'health' && health && (
          <div className="space-y-8 animate-fadeIn">
            {/* Status indicators */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-gradient-to-br from-[#0c142c]/90 to-[#070b16]/95 border border-white/10 p-6 rounded-3xl backdrop-blur-xl flex items-center gap-4 shadow-xl">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg ${health.database_status === 'healthy' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.1)]' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}`}>
                  {health.database_status === 'healthy' ? '✓' : '!'}
                </div>
                <div>
                  <span className="text-[9px] uppercase font-bold text-neutral-500 tracking-wider">Database Engine</span>
                  <div className="text-sm font-black text-white uppercase mt-0.5">{health.database_status}</div>
                  <span className="text-[8px] text-neutral-500 block">SQLite production-ready replication</span>
                </div>
              </div>

              <div className="bg-gradient-to-br from-[#0c142c]/90 to-[#070b16]/95 border border-white/10 p-6 rounded-3xl backdrop-blur-xl flex items-center gap-4 shadow-xl">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg ${health.cache_status === 'healthy' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.1)]' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'}`}>
                  ⚡
                </div>
                <div>
                  <span className="text-[9px] uppercase font-bold text-neutral-500 tracking-wider">Memory Cache Layer</span>
                  <div className="text-sm font-black text-white uppercase mt-0.5">{health.cache_status}</div>
                  <span className="text-[8px] text-neutral-500 block">FastAPI database result cache</span>
                </div>
              </div>

              <div className="bg-gradient-to-br from-[#0c142c]/90 to-[#070b16]/95 border border-white/10 p-6 rounded-3xl backdrop-blur-xl flex items-center gap-4 shadow-xl">
                <div className="w-12 h-12 rounded-2xl bg-brand-accent/15 text-brand-accent border border-brand-accent/20 flex items-center justify-center font-bold text-lg shadow-inner">
                  🗄
                </div>
                <div>
                  <span className="text-[9px] uppercase font-bold text-neutral-500 tracking-wider">Physical Storage Usage</span>
                  <div className="text-sm font-black text-white mt-0.5">{formatFileSize(health.storage_usage_bytes)}</div>
                  <span className="text-[8px] text-neutral-500 block">Across {health.total_files} catalog files</span>
                </div>
              </div>
            </div>

            {/* Storage details & segment metrics */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Detailed Cache Statistics */}
              <div className="bg-gradient-to-br from-[#0c142c]/90 to-[#070b16]/95 border border-white/10 p-6 rounded-3xl backdrop-blur-xl shadow-xl space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black uppercase text-brand-accent tracking-wider font-display">Cache Layer Statistics</h3>
                  <button
                    onClick={handleClearCache}
                    disabled={clearingCache}
                    className="px-3.5 py-2 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-350 text-[9px] font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer active:scale-95"
                  >
                    {clearingCache ? 'Clearing Cache...' : 'Flush Cache'}
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-6 pt-2 text-xs">
                  <div>
                    <span className="text-neutral-500 block uppercase font-bold tracking-wider">Cache Hit Ratio</span>
                    <span className="text-2xl font-black text-white block mt-1">{health.cache_stats.hit_rate_pct}%</span>
                  </div>
                  <div>
                    <span className="text-neutral-500 block uppercase font-bold tracking-wider">Keys In Memory</span>
                    <span className="text-2xl font-black text-white block mt-1">{health.cache_stats.keys_count}</span>
                  </div>
                  <div>
                    <span className="text-neutral-500 block uppercase font-bold tracking-wider">Hits Count</span>
                    <span className="text-base font-bold text-emerald-450 block mt-1">{health.cache_stats.hits} hits</span>
                  </div>
                  <div>
                    <span className="text-neutral-500 block uppercase font-bold tracking-wider">Misses Count</span>
                    <span className="text-base font-bold text-rose-400 block mt-1">{health.cache_stats.misses} misses</span>
                  </div>
                </div>
              </div>

              {/* Segment & Ingestion assets */}
              <div className="bg-gradient-to-br from-[#0c142c]/90 to-[#070b16]/95 border border-white/10 p-6 rounded-3xl backdrop-blur-xl shadow-xl space-y-6">
                <h3 className="text-xs font-black uppercase text-brand-accent tracking-wider font-display">Asset Segmentation Metrics</h3>
                <div className="space-y-4 pt-2">
                  <div className="flex justify-between items-center text-xs border-b border-white/5 pb-2">
                    <span className="text-neutral-450 font-semibold">HLS segmented files (.ts)</span>
                    <span className="font-mono text-white font-black">{health.total_video_segments} files</span>
                  </div>
                  <div className="flex justify-between items-center text-xs border-b border-white/5 pb-2">
                    <span className="text-neutral-450 font-semibold">Ingested raw videos (MP4)</span>
                    <span className="font-mono text-white font-black">{health.total_uploaded_files} files</span>
                  </div>
                  <div className="flex justify-between items-center text-xs border-b border-white/5 pb-2">
                    <span className="text-neutral-450 font-semibold">Active HLS Master playlists</span>
                    <span className="font-mono text-white font-black">{health.total_hls_assets} playlists</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-neutral-450 font-semibold">Transcoding worker queue status</span>
                    <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${health.processing_queue_status > 0 ? 'bg-amber-500/10 text-amber-400 border border-amber-500/25 animate-pulse' : 'bg-white/5 text-neutral-550 border border-white/5'}`}>
                      {health.processing_queue_status > 0 ? `${health.processing_queue_status} processing` : 'idle'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 6: Audit Log Explorer */}
        {activeTab === 'audit' && (
          <div className="space-y-6 animate-fadeIn">
            {/* Filter controls */}
            <div className="bg-gradient-to-br from-[#0c142c]/90 to-[#070b16]/95 border border-white/10 p-6 rounded-3xl backdrop-blur-xl flex flex-wrap gap-4 items-center justify-between shadow-lg">
              <div className="flex flex-wrap gap-3 items-center">
                <label className="text-[10px] font-black uppercase text-brand-textMuted tracking-wider">Filter Action</label>
                <select
                  value={auditActionFilter}
                  onChange={(e) => {
                    setAuditActionFilter(e.target.value);
                    setAuditOffset(0);
                  }}
                  className="px-4 py-3 bg-[#050913]/60 border border-white/10 rounded-2xl text-xs text-neutral-400 focus:outline-none focus:text-white cursor-pointer"
                >
                  <option value="">All Platform Actions</option>
                  <option value="user_creation">User Creation</option>
                  <option value="user_enable">User Enabled</option>
                  <option value="user_disable">User Disabled</option>
                  <option value="admin_promotion">Admin Promotion</option>
                  <option value="admin_removal">Admin Removal</option>
                  <option value="video_upload">Video Upload</option>
                  <option value="video_delete">Video Delete</option>
                  <option value="profile_create">Profile Create</option>
                  <option value="profile_delete">Profile Delete</option>
                  <option value="subscription_upgrade">Subscription Upgrade</option>
                  <option value="subscription_downgrade">Subscription Downgrade</option>
                  <option value="subscription_cancel">Subscription Cancel</option>
                </select>
              </div>

              <div className="flex gap-2">
                <button
                  disabled={auditOffset === 0}
                  onClick={() => setAuditOffset((prev) => Math.max(0, prev - auditLimit))}
                  className="px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/5 text-xs text-white font-extrabold uppercase rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  ◄ Previous Page
                </button>
                <button
                  disabled={auditLogs.length < auditLimit}
                  onClick={() => setAuditOffset((prev) => prev + auditLimit)}
                  className="px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/5 text-xs text-white font-extrabold uppercase rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  Next Page ►
                </button>
              </div>
            </div>

            {/* Timeline Feed of Logs */}
            <div className="bg-gradient-to-br from-[#0c142c]/90 to-[#070b16]/95 border border-white/10 rounded-3xl p-6 backdrop-blur-xl shadow-xl space-y-6">
              <h3 className="text-xs font-black uppercase text-brand-accent tracking-wider font-display">Live Audit Log Feed</h3>
              
              <div className="space-y-6 relative before:absolute before:left-3.5 before:top-2 before:bottom-2 before:w-[1px] before:bg-white/5">
                {auditLogs.length === 0 ? (
                  <div className="p-12 text-center text-brand-textMuted italic text-xs font-semibold">
                    No audit event logs found matching the filter criteria.
                  </div>
                ) : (
                  auditLogs.map((l) => {
                    // Determine visual icon based on action
                    let actionIcon = '⚙️';
                    let iconBg = 'bg-neutral-850 text-neutral-450 border border-white/5';
                    
                    if (l.action.includes('delete') || l.action.includes('disable') || l.action.includes('removal')) {
                      actionIcon = '⚠️';
                      iconBg = 'bg-rose-500/10 text-rose-400 border border-rose-500/20';
                    } else if (l.action.includes('upload') || l.action.includes('creation') || l.action.includes('upgrade') || l.action.includes('promote')) {
                      actionIcon = '🚀';
                      iconBg = 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
                    } else if (l.action.includes('subscription')) {
                      actionIcon = '💳';
                      iconBg = 'bg-blue-500/10 text-blue-400 border border-blue-500/20';
                    }
                    
                    return (
                      <div key={l.log_id} className="relative pl-10 flex flex-col md:flex-row md:items-center justify-between gap-4 group">
                        {/* Timeline point */}
                        <div className={`absolute left-0 top-0.5 w-7.5 h-7.5 rounded-lg flex items-center justify-center text-xs z-10 shadow-md ${iconBg} select-none`}>
                          {actionIcon}
                        </div>
                        
                        <div className="space-y-1">
                          <div className="flex items-center gap-2.5 flex-wrap">
                            <span className="text-[10px] font-black uppercase tracking-wider text-brand-accent">{l.action}</span>
                            <span className="text-[8px] text-neutral-500 font-mono font-bold">{new Date(l.created_at).toLocaleString()}</span>
                          </div>
                          <p className="text-xs text-white font-medium leading-relaxed">{l.details}</p>
                          <div className="flex items-center gap-1.5 text-[9px] text-neutral-550 font-mono">
                            <span className="text-neutral-500">Performed by:</span>
                            <span className="text-neutral-450">{l.actor_email || 'system / anonymous'}</span>
                          </div>
                        </div>
                        
                        {l.metadata && (
                          <div className="md:self-center self-start">
                            <span className="font-mono text-[9px] text-neutral-500 bg-black/45 border border-white/5 px-2.5 py-1.5 rounded-xl max-w-[240px] truncate block select-all" title={typeof l.metadata === 'string' ? l.metadata : JSON.stringify(l.metadata)}>
                              {typeof l.metadata === 'string' ? l.metadata : JSON.stringify(l.metadata)}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminUpload;
