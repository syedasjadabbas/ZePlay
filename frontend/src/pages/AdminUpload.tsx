import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';

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
    if (!window.confirm(`Are you sure you want to ${targetAction} user account: ${user.email}?`)) return;

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
    if (!window.confirm(`Are you sure you want to ${targetAction} user: ${user.email} to/from administrator role?`)) return;

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
    if (!window.confirm('Are you sure you want to delete this video asset?')) return;

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
      alert('Failed to delete video asset.');
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
    <div className="min-h-screen bg-brand-background text-white font-sans selection:bg-brand-accent selection:text-white pb-20">

      {/* Top Navbar */}
      <header className="border-b border-white/5 bg-[#070E26]/80 backdrop-blur-xl sticky top-0 z-40 px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link to="/" className="text-2xl font-black text-brand-accent tracking-wider font-display">
            ZEPLAY
          </Link>
          <span className="text-[10px] font-black tracking-widest uppercase bg-brand-accent/10 border border-brand-accent/20 px-3 py-1 rounded-full text-brand-accent">
            Control Center
          </span>
        </div>
        <div className="flex items-center gap-4">
          <Link to="/" className="text-xs font-bold text-neutral-400 hover:text-white transition-colors">
            Exit Panel
          </Link>
          <div className="w-8 h-8 rounded-full bg-brand-accent flex items-center justify-center font-bold text-xs">
            A
          </div>
        </div>
      </header>

      {/* Main Workspace Container */}
      <div className="max-w-7xl mx-auto px-8 pt-10">

        {/* Page Title */}
        <div className="mb-8">
          <h1 className="text-3xl font-black tracking-tight uppercase">Administrative Operations</h1>
          <p className="text-xs text-brand-textMuted mt-1">
            Monitor infrastructure services, manage user access states, audit system event streams, and ingest content catalogs.
          </p>
        </div>

        {/* Dynamic Notification Badges */}
        {error && (
          <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs rounded-2xl flex items-center gap-3">
            <span className="font-extrabold uppercase bg-rose-500 text-white px-2 py-0.5 rounded-lg text-[9px]">ERROR</span>
            <span>{error}</span>
          </div>
        )}
        {successMsg && (
          <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs rounded-2xl flex items-center gap-3">
            <span className="font-extrabold uppercase bg-emerald-500 text-white px-2 py-0.5 rounded-lg text-[9px]">SUCCESS</span>
            <span>{successMsg}</span>
          </div>
        )}

        {/* Dashboard Tabs bar */}
        <div className="flex flex-wrap gap-2 border-b border-white/5 pb-4 mb-8">
          {[
            { id: 'overview', label: 'System Overview' },
            { id: 'content', label: 'Content Analytics' },
            { id: 'users', label: 'User Management' },
            { id: 'ingestion', label: 'Catalog Ingestion' },
            { id: 'movies_manage', label: 'Manage Catalog Movies' },
            { id: 'health', label: 'Infrastructure & Cache' },
            { id: 'audit', label: 'Audit Log Explorer' },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => {
                setActiveTab(t.id as any);
                setError(null);
                setSuccessMsg(null);
              }}
              className={`px-4 py-2 text-xs font-bold rounded-xl border transition-all ${activeTab === t.id
                  ? 'bg-brand-accent/20 border-brand-accent/40 text-brand-accent'
                  : 'bg-brand-surface/40 border-white/5 text-neutral-400 hover:text-white'
                }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab 1: System Overview */}
        {activeTab === 'overview' && analytics && (
          <div className="space-y-8">
            {/* Grid of Key Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { label: 'Total Users', value: analytics.total_users, desc: `${analytics.free_users} Free / ${analytics.premium_users} Premium` },
                { label: 'Total Profiles', value: analytics.total_profiles, desc: 'Across all active accounts' },
                { label: 'Catalog Movies', value: analytics.total_movies, desc: `Ingested HLS Video assets: ${analytics.total_videos}` },
                { label: 'Total Ratings', value: analytics.total_ratings, desc: `Average Rating: ${analytics.average_rating} ★` },
                { label: 'Total Views', value: analytics.total_views, desc: 'Aggregated video playback sessions' },
                { label: 'Total Watch Time', value: `${Math.round(analytics.total_watch_time / 60)} hrs`, desc: 'Accumulated streaming duration' },
                { label: 'Active Viewers', value: analytics.active_users, desc: 'Unique playback users tracked' },
                { label: 'Premium Conversion', value: `${analytics.conversion_rate}%`, desc: 'Ratio of paying subscriber accounts' },
              ].map((m, idx) => (
                <div key={idx} className="bg-[#0B1533]/80 border border-white/5 p-6 rounded-3xl backdrop-blur-md">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-brand-textMuted">{m.label}</span>
                  <div className="text-3xl font-black mt-2 text-white">{m.value}</div>
                  <div className="text-[10px] text-neutral-400 mt-1 font-medium">{m.desc}</div>
                </div>
              ))}
            </div>

            {/* Performance charts mockup */}
            <div className="bg-[#0B1533]/80 border border-white/5 p-6 rounded-3xl backdrop-blur-md">
              <h2 className="text-sm font-black uppercase mb-4 tracking-wider text-brand-accent">Retention & Watch Time Performance</h2>
              <div className="h-64 flex items-end gap-3 pt-6 border-b border-white/5 pb-2">
                {[45, 60, 55, 80, 70, 95, 85, 110, 90, 120, 130, 150].map((val, idx) => (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                    <div
                      style={{ height: `${(val / 150) * 100}%` }}
                      className="w-full bg-gradient-to-t from-brand-accent/40 to-brand-accent rounded-t-lg relative group cursor-pointer"
                    >
                      <div className="opacity-0 group-hover:opacity-100 absolute -top-8 left-1/2 -translate-x-1/2 bg-brand-accent text-white font-black text-[9px] px-2 py-0.5 rounded-md transition-opacity whitespace-nowrap shadow-lg">
                        {val} hrs
                      </div>
                    </div>
                    <span className="text-[8px] font-bold text-neutral-500 uppercase">M{idx + 1}</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between items-center mt-3 text-[10px] text-brand-textMuted">
                <span>Visual distribution represents hourly Watch Time trend over the past 12 months.</span>
                <span className="font-bold text-white">Average User Watch Time: {analytics.average_watch_time} mins</span>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Content Analytics */}
        {activeTab === 'content' && contentRankings && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

            {/* 1. Most Watched Movies */}
            <div className="bg-[#0B1533]/80 border border-white/5 p-6 rounded-3xl backdrop-blur-md">
              <h2 className="text-sm font-black uppercase mb-4 tracking-wider text-brand-accent">Most Watched Movies</h2>
              <div className="space-y-4">
                {contentRankings.most_watched_movies.map((m, idx) => (
                  <div key={m.movie_id} className="flex items-center justify-between border-b border-white/5 pb-3 last:border-b-0 last:pb-0">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-black text-neutral-500 w-4">#{idx + 1}</span>
                      <img src={m.thumbnail_url || 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=100&q=80'} className="w-12 h-8 object-cover rounded-md border border-white/10" alt="" />
                      <span className="text-xs font-bold">{m.title}</span>
                    </div>
                    <span className="text-[10px] font-bold bg-white/5 border border-white/5 px-2.5 py-1 rounded-lg">{m.views} views</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 2. Highest Rated Movies */}
            <div className="bg-[#0B1533]/80 border border-white/5 p-6 rounded-3xl backdrop-blur-md">
              <h2 className="text-sm font-black uppercase mb-4 tracking-wider text-brand-accent">Highest Rated Movies</h2>
              <div className="space-y-4">
                {contentRankings.highest_rated_movies.map((m, idx) => (
                  <div key={m.movie_id} className="flex items-center justify-between border-b border-white/5 pb-3 last:border-b-0 last:pb-0">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-black text-neutral-500 w-4">#{idx + 1}</span>
                      <img src={m.thumbnail_url || 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=100&q=80'} className="w-12 h-8 object-cover rounded-md border border-white/10" alt="" />
                      <span className="text-xs font-bold">{m.title}</span>
                    </div>
                    <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-lg">{m.rating} ★</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 3. Most Added to Watchlist */}
            <div className="bg-[#0B1533]/80 border border-white/5 p-6 rounded-3xl backdrop-blur-md">
              <h2 className="text-sm font-black uppercase mb-4 tracking-wider text-brand-accent">Most Added to Watchlist</h2>
              <div className="space-y-4">
                {contentRankings.most_added_watchlist.map((m, idx) => (
                  <div key={m.movie_id} className="flex items-center justify-between border-b border-white/5 pb-3 last:border-b-0 last:pb-0">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-black text-neutral-500 w-4">#{idx + 1}</span>
                      <img src={m.thumbnail_url || 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=100&q=80'} className="w-12 h-8 object-cover rounded-md border border-white/10" alt="" />
                      <span className="text-xs font-bold">{m.title}</span>
                    </div>
                    <span className="text-[10px] font-bold text-brand-accent bg-brand-accent/10 border border-brand-accent/20 px-2.5 py-1 rounded-lg">+{m.saves} saves</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 4. Category & Genre Popularity */}
            <div className="bg-[#0B1533]/80 border border-white/5 p-6 rounded-3xl backdrop-blur-md space-y-6">
              <div>
                <h2 className="text-sm font-black uppercase mb-3 tracking-wider text-brand-accent">Most Popular Genres</h2>
                <div className="flex flex-wrap gap-2">
                  {contentRankings.most_popular_genres.map((g) => (
                    <span key={g.genre_id} className="text-xs bg-white/5 border border-white/5 px-3 py-1.5 rounded-xl font-bold flex items-center gap-2">
                      {g.name} <span className="text-[10px] text-neutral-400 bg-black/30 px-2 py-0.5 rounded-md font-mono">{g.count}</span>
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <h2 className="text-sm font-black uppercase mb-3 tracking-wider text-brand-accent">Most Watched Categories</h2>
                <div className="space-y-2.5">
                  {contentRankings.most_watched_categories.map((c) => (
                    <div key={c.genre_id} className="flex items-center justify-between text-xs">
                      <span className="font-bold text-neutral-300">{c.name}</span>
                      <span className="font-mono text-neutral-400">{c.views} views</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: User Management */}
        {activeTab === 'users' && (
          <div className="space-y-6">

            {/* Search and Filters */}
            <div className="bg-[#0B1533]/80 border border-white/5 p-6 rounded-3xl backdrop-blur-md flex flex-wrap gap-4 items-center justify-between">
              <input
                type="text"
                placeholder="Search registered users by name or email..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="flex-1 min-w-[280px] px-4 py-2.5 bg-brand-surface border border-white/10 rounded-2xl text-xs text-white placeholder:text-neutral-500 focus:outline-none focus:border-brand-accent"
              />

              <div className="flex flex-wrap gap-3">
                <select
                  value={userPlanFilter}
                  onChange={(e) => setUserPlanFilter(e.target.value)}
                  className="px-4 py-2.5 bg-brand-surface border border-white/10 rounded-xl text-xs text-neutral-400 focus:outline-none focus:text-white"
                >
                  <option value="">All Subscription Plans</option>
                  <option value="free">Free Tier</option>
                  <option value="premium">Premium Tier</option>
                </select>

                <select
                  value={userStatusFilter}
                  onChange={(e) => setUserStatusFilter(e.target.value)}
                  className="px-4 py-2.5 bg-brand-surface border border-white/10 rounded-xl text-xs text-neutral-400 focus:outline-none focus:text-white"
                >
                  <option value="">All Statuses</option>
                  <option value="active">Active Only</option>
                  <option value="disabled">Disabled Only</option>
                </select>

                <select
                  value={userVerifyFilter}
                  onChange={(e) => setUserVerifyFilter(e.target.value)}
                  className="px-4 py-2.5 bg-brand-surface border border-white/10 rounded-xl text-xs text-neutral-400 focus:outline-none focus:text-white"
                >
                  <option value="">All Verification States</option>
                  <option value="verified">Verified Only</option>
                  <option value="pending">Pending Verification</option>
                </select>
              </div>
            </div>

            {/* List and Details Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

              {/* Users table list */}
              <div className="lg:col-span-2 bg-[#0B1533]/80 border border-white/5 rounded-3xl overflow-hidden backdrop-blur-md">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-white/5 text-[9px] uppercase font-bold text-brand-textMuted tracking-wider bg-black/20">
                        <th className="p-4 pl-6">User / Account</th>
                        <th className="p-4">Verification</th>
                        <th className="p-4">Subscription</th>
                        <th className="p-4">Status</th>
                        <th className="p-4 pr-6 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-xs">
                      {users.map((u) => (
                        <tr key={u.user_id} className={`hover:bg-white/[0.02] transition-colors cursor-pointer ${selectedUserDetail?.user_id === u.user_id ? 'bg-white/[0.03]' : ''}`} onClick={() => handleViewUserDetail(u)}>
                          <td className="p-4 pl-6">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-accent to-blue-700 flex items-center justify-center font-black text-xs text-white">
                                {u.name.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <span className="font-bold block">{u.name} {u.is_admin && <span className="text-[9px] bg-brand-accent/20 border border-brand-accent/30 text-brand-accent px-1.5 py-0.2 rounded-md ml-1.5 uppercase font-black">Admin</span>}</span>
                                <span className="text-[10px] text-neutral-400 block font-mono">{u.email}</span>
                              </div>
                            </div>
                          </td>
                          <td className="p-4">
                            {u.is_verified ? (
                              <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">Verified</span>
                            ) : (
                              <span className="text-[9px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">Pending</span>
                            )}
                          </td>
                          <td className="p-4 font-bold text-neutral-300 uppercase text-[10px]">{u.subscription_plan}</td>
                          <td className="p-4">
                            {u.is_active ? (
                              <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">Active</span>
                            ) : (
                              <span className="text-[9px] font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20">Disabled</span>
                            )}
                          </td>
                          <td className="p-4 pr-6 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => handleToggleUserActive(u)}
                                disabled={updatingUserId === u.user_id}
                                className={`px-2.5 py-1.5 rounded-xl text-[10px] font-extrabold border transition-all ${u.is_active
                                    ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border-rose-500/20'
                                    : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border-emerald-500/20'
                                  }`}
                              >
                                {u.is_active ? 'Disable' : 'Enable'}
                              </button>
                              <button
                                onClick={() => handleToggleAdminRole(u)}
                                disabled={updatingUserId === u.user_id}
                                className={`px-2.5 py-1.5 rounded-xl text-[10px] font-extrabold border transition-all ${u.is_admin
                                    ? 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border-white/5'
                                    : 'bg-brand-accent/20 hover:bg-brand-accent/30 text-brand-accent border-brand-accent/30'
                                  }`}
                              >
                                {u.is_admin ? 'Revoke Admin' : 'Make Admin'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* User detail activity panels */}
              <div className="bg-[#0B1533]/80 border border-white/5 p-6 rounded-3xl backdrop-blur-md space-y-6">
                <h3 className="text-xs font-black uppercase text-brand-accent tracking-wider">Audit Details & Activity</h3>

                {!selectedUserDetail ? (
                  <div className="text-center py-20 text-xs text-neutral-500">
                    Select a user from the list to audit watch history, ratings, and profile statistics.
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Core details */}
                    <div className="border-b border-white/5 pb-4">
                      <h4 className="text-sm font-black text-white">{selectedUserDetail.name}</h4>
                      <p className="text-[10px] text-neutral-400 font-mono mt-0.5">{selectedUserDetail.email}</p>
                      <div className="grid grid-cols-2 gap-4 mt-4 text-[10px]">
                        <div>
                          <span className="text-neutral-500 block">Subscription Tier</span>
                          <span className="font-bold text-white uppercase mt-0.5 block">{selectedUserDetail.subscription_plan}</span>
                        </div>
                        <div>
                          <span className="text-neutral-500 block">Profiles Registered</span>
                          <span className="font-bold text-white mt-0.5 block">{selectedUserDetail.profile_count} / {selectedUserDetail.subscription_plan === 'premium' ? 4 : 1}</span>
                        </div>
                      </div>
                    </div>

                    {/* Activity log loading */}
                    {loadingActivity && (
                      <div className="text-center py-10 text-xs text-neutral-500 animate-pulse">
                        Loading activity logs...
                      </div>
                    )}

                    {/* User Activity Content */}
                    {userActivity && (
                      <div className="space-y-6">
                        {/* Profiles list */}
                        <div>
                          <span className="text-[9px] uppercase font-bold text-neutral-500 block mb-2">Registered Profile Personas</span>
                          <div className="flex flex-wrap gap-2">
                            {userActivity.profiles.map((p) => (
                              <span key={p.profile_id} className="text-[10px] bg-white/5 border border-white/5 px-2.5 py-1 rounded-xl font-bold flex items-center gap-1.5">
                                <span>{p.is_kids_profile ? '🧒' : '🍿'}</span>
                                <span>{p.display_name}</span>
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Recent Watch history */}
                        <div>
                          <span className="text-[9px] uppercase font-bold text-neutral-500 block mb-2">Recent Playback Sessions</span>
                          {userActivity.watch_history.length === 0 ? (
                            <span className="text-[10px] text-neutral-500 block italic">No history records found.</span>
                          ) : (
                            <div className="space-y-2">
                              {userActivity.watch_history.map((h) => (
                                <div key={h.history_id} className="flex justify-between items-center text-[10px] border-b border-white/5 pb-2">
                                  <span className="font-bold text-neutral-300 truncate max-w-[150px]">{h.movie_title}</span>
                                  <span className="text-neutral-400 font-mono">{h.percentage_watched}% watched</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* User Ratings */}
                        <div>
                          <span className="text-[9px] uppercase font-bold text-neutral-500 block mb-2">Content Ratings Submitted</span>
                          {userActivity.ratings.length === 0 ? (
                            <span className="text-[10px] text-neutral-500 block italic">No reviews submitted yet.</span>
                          ) : (
                            <div className="space-y-2">
                              {userActivity.ratings.map((r) => (
                                <div key={r.rating_id} className="flex justify-between items-center text-[10px]">
                                  <span className="font-bold text-neutral-300">{r.movie_title}</span>
                                  <span className="text-amber-400 font-bold">{r.score} ★</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Performed Audit logs */}
                        <div>
                          <span className="text-[9px] uppercase font-bold text-neutral-500 block mb-2">Security/Operation Events</span>
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
                                  <p className="text-neutral-400 text-[9px] mt-0.5 leading-snug">{l.details}</p>
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

        {/* Tab 4: Ingestion (Existing logic intact) */}
        {activeTab === 'ingestion' && (
          <div className="space-y-8 animate-fadeIn">

            {/* Catalog Upload Form */}
            <div className="bg-[#0B1533]/80 border border-white/5 p-8 rounded-3xl backdrop-blur-md">
              <h2 className="text-lg font-black uppercase mb-6 tracking-wide text-brand-accent">Ingest Video Catalog</h2>
              <form onSubmit={handleUpload} className="space-y-6">

                {/* Select Movie Linkage */}
                <div>
                  <label className="text-[10px] font-black uppercase text-brand-textMuted block mb-2 tracking-wider">
                    Link to Catalog Movie Entry (Optional)
                  </label>
                  <select
                    value={selectedMovieId}
                    onChange={(e) => setSelectedMovieId(e.target.value)}
                    className="w-full px-4 py-3 bg-brand-surface border border-white/10 rounded-2xl text-xs text-white focus:outline-none focus:border-brand-accent focus:ring-1 focus:ring-brand-accent transition-all cursor-pointer"
                  >
                    <option value="">Unlinked (Orphan Video Asset)</option>
                    {movies.map((m) => (
                      <option key={m.movie_id} value={m.movie_id}>
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
                    className="border-2 border-dashed border-white/10 hover:border-brand-accent/50 bg-brand-surface/30 hover:bg-brand-surface/50 rounded-2xl p-8 text-center cursor-pointer transition-all duration-300"
                  >
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      accept="video/*"
                      className="hidden"
                    />
                    <div className="text-3xl mb-3">🎬</div>
                    {file ? (
                      <div>
                        <span className="text-xs font-bold text-white block truncate max-w-md mx-auto">{file.name}</span>
                        <span className="text-[10px] text-brand-textMuted block mt-1 font-mono">{formatFileSize(file.size)}</span>
                      </div>
                    ) : (
                      <div>
                        <span className="text-xs font-bold text-neutral-300 block">Drag & drop your movie file here, or click to browse</span>
                        <span className="text-[10px] text-brand-textMuted block mt-1">Supports MP4, MKV, AVI, MOV formats</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Upload Status */}
                {uploading && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-[10px] font-bold text-brand-accent">
                      <span>Ingesting catalog video file...</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <div className="w-full bg-white/5 h-2.5 rounded-full overflow-hidden border border-white/5">
                      <div
                        style={{ width: `${uploadProgress}%` }}
                        className="bg-brand-accent h-full rounded-full transition-all duration-300"
                      />
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={uploading || !file}
                  className="w-full py-4 bg-brand-accent text-white hover:bg-brand-accent-hover disabled:bg-neutral-800 disabled:text-neutral-500 disabled:cursor-not-allowed rounded-2xl text-xs font-black uppercase tracking-wider transition-all shadow-xl"
                >
                  {uploading ? 'Processing Video...' : 'Ingest and Process Asset'}
                </button>
              </form>
            </div>

            {/* List of Ingested Videos */}
            <div className="bg-[#0B1533]/80 border border-white/5 rounded-3xl overflow-hidden backdrop-blur-md">
              <div className="p-6 border-b border-white/5 flex items-center justify-between bg-black/10">
                <h3 className="text-sm font-black uppercase tracking-wider text-brand-accent">Ingested Video Assets</h3>
                <span className="text-[10px] font-bold text-brand-textMuted">Total Ingested Assets: {videos.length}</span>
              </div>

              {videos.length === 0 ? (
                <div className="p-12 text-center text-brand-textMuted text-xs font-semibold">
                  No ingested video assets found in storage.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-white/5 text-[9px] uppercase font-bold text-brand-textMuted tracking-wider bg-black/20">
                        <th className="p-4 pl-6">Original Filename</th>
                        <th className="p-4">Linked Catalog Item</th>
                        <th className="p-4">Size</th>
                        <th className="p-4">Status</th>
                        <th className="p-4 pr-6 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-xs">
                      {videos.map((v) => (
                        <tr key={v.video_id} className="hover:bg-white/[0.01] transition-colors">
                          <td className="p-4 pl-6">
                            <span className="font-bold text-white block truncate max-w-xs">{v.original_filename}</span>
                            <span className="text-[9px] text-neutral-400 font-mono block mt-0.5 truncate max-w-xs">{v.filename}</span>
                          </td>
                          <td className="p-4 font-bold text-neutral-300">{getMovieTitle(v.movie_id)}</td>
                          <td className="p-4 font-mono text-[10px] text-neutral-400">{formatFileSize(v.file_size_bytes)}</td>
                          <td className="p-4">
                            {v.status === 'completed' ? (
                              <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">COMPLETED</span>
                            ) : v.status === 'processing' ? (
                              <span className="text-[9px] font-bold text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20 animate-pulse">PROCESSING {v.processing_progress ? `${v.processing_progress}%` : ''}</span>
                            ) : v.status === 'uploaded' ? (
                              <span className="text-[9px] font-bold text-blue-400 bg-blue-500/10 px-2.5 py-0.5 rounded-full border border-blue-500/20">UPLOADED</span>
                            ) : (
                              <span className="text-[9px] font-bold text-rose-400 bg-rose-500/10 px-2.5 py-0.5 rounded-full border border-rose-500/20">FAILED</span>
                            )}
                          </td>
                          <td className="p-4 pr-6 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {v.status === 'completed' && (
                                <button
                                  onClick={() => setActivePreviewVideo(v)}
                                  className="px-2.5 py-1.5 bg-white/5 hover:bg-white/10 border border-white/5 text-[10px] font-extrabold rounded-xl transition-all"
                                >
                                  Preview
                                </button>
                              )}
                              <button
                                onClick={() => handleProcessHLS(v.video_id)}
                                disabled={processingId === v.video_id || v.status === 'processing'}
                                className="px-2.5 py-1.5 bg-brand-accent/20 hover:bg-brand-accent/30 text-brand-accent border border-brand-accent/30 disabled:opacity-50 text-[10px] font-extrabold rounded-xl transition-all"
                              >
                                {processingId === v.video_id ? 'Processing...' : 'Reprocess HLS'}
                              </button>
                              <button
                                onClick={() => handleDeleteVideo(v.video_id)}
                                className="px-2.5 py-1.5 bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/20 text-[10px] font-extrabold rounded-xl transition-all"
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Video Playback Preview Modal */}
            {activePreviewVideo && (
              <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-50 p-8">
                <div className="bg-[#0B1533] border border-white/10 max-w-3xl w-full rounded-3xl overflow-hidden shadow-2xl relative">
                  <button
                    onClick={() => setActivePreviewVideo(null)}
                    className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-black/60 border border-white/10 hover:bg-brand-accent hover:border-brand-accent text-white flex items-center justify-center font-bold transition-all"
                  >
                    ×
                  </button>
                  <div className="p-6 border-b border-white/5">
                    <h3 className="text-sm font-black uppercase text-brand-accent tracking-wide">{activePreviewVideo.original_filename}</h3>
                    <p className="text-[10px] text-neutral-400 mt-1 font-mono">Status: HLS Adaptive Streaming Ready</p>
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
                    <span>UUID: {activePreviewVideo.video_id}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab: Manage Catalog Movies */}
        {activeTab === 'movies_manage' && (
          <div className="space-y-8 animate-fadeIn">
            <div className="bg-[#0B1533]/80 border border-white/5 p-6 rounded-3xl backdrop-blur-md">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-sm font-black uppercase tracking-wider text-brand-accent">Catalog Movies Directory</h2>
                <span className="text-[10px] font-bold text-brand-textMuted">Total Catalog Movies: {catalogMovies.length}</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {catalogMovies.map((m) => (
                  <div key={m.movie_id} className="bg-brand-surface border border-white/5 p-5 rounded-2xl flex flex-col justify-between space-y-4">
                    <div className="flex gap-4">
                      <div className="w-20 h-28 bg-black/40 rounded-xl overflow-hidden flex-shrink-0 border border-white/10 relative group">
                        {m.thumbnail_url ? (
                          <img src={m.thumbnail_url} className="w-full h-full object-cover" alt="" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-xs text-neutral-600">No Poster</div>
                        )}
                      </div>
                      <div className="space-y-2 flex-grow min-w-0">
                        <h4 className="text-xs font-black text-white uppercase truncate">{m.title}</h4>
                        <p className="text-[10px] text-neutral-400 font-mono">{m.release_year} • {m.duration_minutes} mins</p>
                        <p className="text-[10px] text-brand-textMuted line-clamp-3 leading-relaxed">{m.description}</p>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => handleStartEdit(m)}
                        className="flex-1 py-2 bg-brand-accent/20 hover:bg-brand-accent/30 text-brand-accent border border-brand-accent/30 text-[10px] font-extrabold rounded-xl transition-all"
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
                <div className="bg-[#0B1533] border border-white/10 max-w-lg w-full rounded-3xl overflow-hidden shadow-2xl relative">
                  <button
                    onClick={() => setEditingMovie(null)}
                    className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-black/60 border border-white/10 hover:bg-brand-accent hover:border-brand-accent text-white flex items-center justify-center font-bold transition-all"
                  >
                    ×
                  </button>

                  <div className="p-6 border-b border-white/5">
                    <h3 className="text-sm font-black uppercase text-brand-accent tracking-wide">Edit Movie Metadata</h3>
                    <p className="text-[10px] text-neutral-400 mt-1 font-mono">ID: {editingMovie.movie_id}</p>
                  </div>

                  <form onSubmit={handleSaveMovie} className="p-6 space-y-4">
                    <div>
                      <label className="text-[9px] font-black uppercase text-brand-textMuted block mb-1.5">Movie Title / Rename</label>
                      <input
                        type="text"
                        required
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className="w-full px-4 py-2.5 bg-brand-surface border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-brand-accent"
                      />
                    </div>

                    <div>
                      <label className="text-[9px] font-black uppercase text-brand-textMuted block mb-1.5">Description</label>
                      <textarea
                        required
                        rows={3}
                        value={editDesc}
                        onChange={(e) => setEditDesc(e.target.value)}
                        className="w-full px-4 py-2.5 bg-brand-surface border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-brand-accent resize-none"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[9px] font-black uppercase text-brand-textMuted block mb-1.5">Release Year</label>
                        <input
                          type="number"
                          required
                          value={editYear}
                          onChange={(e) => setEditYear(parseInt(e.target.value))}
                          className="w-full px-4 py-2.5 bg-brand-surface border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-brand-accent"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-black uppercase text-brand-textMuted block mb-1.5">Duration (mins)</label>
                        <input
                          type="number"
                          required
                          value={editDuration}
                          onChange={(e) => setEditDuration(parseInt(e.target.value))}
                          className="w-full px-4 py-2.5 bg-brand-surface border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-brand-accent"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[9px] font-black uppercase text-brand-textMuted block mb-1.5">Upload / Replace Poster Image</label>
                      <div className="flex gap-4 items-center">
                        <div className="w-16 h-24 bg-black/40 border border-white/10 rounded-xl overflow-hidden flex-shrink-0 relative group">
                          {editPosterPreview ? (
                            <img src={editPosterPreview} className="w-full h-full object-cover" alt="Poster Preview" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-[9px] text-neutral-600">No Preview</div>
                          )}
                          {editPosterPreview && (
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity pointer-events-none">
                              <span className="text-[8px] font-black uppercase tracking-wider text-white">Preview</span>
                            </div>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => posterInputRef.current?.click()}
                          className="px-4 py-2.5 bg-white/5 hover:bg-white/10 text-neutral-300 text-[10px] font-black uppercase rounded-xl border border-white/10 transition-all"
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

                    <div className="pt-4 flex gap-3">
                      <button
                        type="submit"
                        disabled={savingMovie}
                        className="flex-1 py-3 bg-brand-accent text-white font-black uppercase text-xs rounded-xl shadow-lg hover:bg-brand-accent-hover transition-colors"
                      >
                        {savingMovie ? 'Saving Changes...' : 'Save Changes'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingMovie(null)}
                        className="px-5 py-3 bg-white/5 hover:bg-white/10 text-neutral-300 text-xs font-bold rounded-xl transition-all"
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

              <div className="bg-[#0B1533]/80 border border-white/5 p-6 rounded-3xl backdrop-blur-md flex items-center gap-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg ${health.database_status === 'healthy' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}`}>
                  {health.database_status === 'healthy' ? '✓' : '!'}
                </div>
                <div>
                  <span className="text-[9px] uppercase font-bold text-neutral-400">Database Engine</span>
                  <div className="text-sm font-black text-white uppercase mt-0.5">{health.database_status}</div>
                  <span className="text-[8px] text-neutral-500 block">SQLite production-ready replication</span>
                </div>
              </div>

              <div className="bg-[#0B1533]/80 border border-white/5 p-6 rounded-3xl backdrop-blur-md flex items-center gap-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg ${health.cache_status === 'healthy' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'}`}>
                  ⚡
                </div>
                <div>
                  <span className="text-[9px] uppercase font-bold text-neutral-400">Memory Cache Layer</span>
                  <div className="text-sm font-black text-white uppercase mt-0.5">{health.cache_status}</div>
                  <span className="text-[8px] text-neutral-500 block">FastAPI database result cache</span>
                </div>
              </div>

              <div className="bg-[#0B1533]/80 border border-white/5 p-6 rounded-3xl backdrop-blur-md flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-brand-accent/15 text-brand-accent border border-brand-accent/20 flex items-center justify-center font-bold text-sm">
                  🗄
                </div>
                <div>
                  <span className="text-[9px] uppercase font-bold text-neutral-400">Physical storage usage</span>
                  <div className="text-sm font-black text-white mt-0.5">{formatFileSize(health.storage_usage_bytes)}</div>
                  <span className="text-[8px] text-neutral-500 block">Across {health.total_files} catalog files</span>
                </div>
              </div>
            </div>

            {/* Storage details & segment metrics */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

              {/* Detailed Cache Statistics */}
              <div className="bg-[#0B1533]/80 border border-white/5 p-6 rounded-3xl backdrop-blur-md space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black uppercase text-brand-accent tracking-wider">Cache Layer Statistics</h3>
                  <button
                    onClick={handleClearCache}
                    disabled={clearingCache}
                    className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/25 border border-rose-500/20 hover:border-rose-500/40 text-rose-300 text-[10px] font-black rounded-xl transition-all"
                  >
                    {clearingCache ? 'Clearing Cache...' : 'Flush Cache'}
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-6 pt-4 text-xs">
                  <div>
                    <span className="text-neutral-500 block">Total Cache Hit Ratio</span>
                    <span className="text-2xl font-black text-white block mt-1">{health.cache_stats.hit_rate_pct}%</span>
                  </div>
                  <div>
                    <span className="text-neutral-500 block">Cached Keys In Memory</span>
                    <span className="text-2xl font-black text-white block mt-1">{health.cache_stats.keys_count}</span>
                  </div>
                  <div>
                    <span className="text-neutral-500 block">Hits Count</span>
                    <span className="text-base font-bold text-emerald-400 block mt-1">{health.cache_stats.hits} hits</span>
                  </div>
                  <div>
                    <span className="text-neutral-500 block">Misses Count</span>
                    <span className="text-base font-bold text-rose-400 block mt-1">{health.cache_stats.misses} misses</span>
                  </div>
                </div>
              </div>

              {/* Segment & Ingestion assets */}
              <div className="bg-[#0B1533]/80 border border-white/5 p-6 rounded-3xl backdrop-blur-md space-y-6">
                <h3 className="text-xs font-black uppercase text-brand-accent tracking-wider">Asset segmentation metrics</h3>
                <div className="space-y-4 pt-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-neutral-400 font-medium">HLS segmented files (.ts)</span>
                    <span className="font-mono text-white font-bold">{health.total_video_segments} files</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-neutral-400 font-medium">Ingested raw videos (MP4)</span>
                    <span className="font-mono text-white font-bold">{health.total_uploaded_files} files</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-neutral-400 font-medium">Active HLS Master playlists</span>
                    <span className="font-mono text-white font-bold">{health.total_hls_assets} playlists</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-neutral-400 font-medium">Transcoding worker queue status</span>
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black ${health.processing_queue_status > 0 ? 'bg-amber-500/10 text-amber-400 animate-pulse' : 'bg-white/5 text-neutral-400'}`}>
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
            <div className="bg-[#0B1533]/80 border border-white/5 p-6 rounded-3xl backdrop-blur-md flex flex-wrap gap-4 items-center justify-between">
              <div className="flex flex-wrap gap-3 items-center">
                <label className="text-[10px] font-black uppercase text-brand-textMuted tracking-wider">Filter Action</label>
                <select
                  value={auditActionFilter}
                  onChange={(e) => {
                    setAuditActionFilter(e.target.value);
                    setAuditOffset(0);
                  }}
                  className="px-4 py-2.5 bg-brand-surface border border-white/10 rounded-xl text-xs text-neutral-400 focus:outline-none focus:text-white"
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
                  className="px-3 py-2 bg-brand-surface border border-white/5 hover:bg-brand-surface/80 rounded-xl text-xs disabled:opacity-50"
                >
                  ◄ Previous Page
                </button>
                <button
                  disabled={auditLogs.length < auditLimit}
                  onClick={() => setAuditOffset((prev) => prev + auditLimit)}
                  className="px-3 py-2 bg-brand-surface border border-white/5 hover:bg-brand-surface/80 rounded-xl text-xs disabled:opacity-50"
                >
                  Next Page ►
                </button>
              </div>
            </div>

            {/* Logs Table */}
            <div className="bg-[#0B1533]/80 border border-white/5 rounded-3xl overflow-hidden backdrop-blur-md">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-white/5 text-[9px] uppercase font-bold text-brand-textMuted tracking-wider bg-black/20">
                      <th className="p-4 pl-6">Timestamp</th>
                      <th className="p-4">Action</th>
                      <th className="p-4">Operation Details</th>
                      <th className="p-4">Actor Email</th>
                      <th className="p-4 pr-6">Metadata Payload</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-xs font-medium">
                    {auditLogs.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-12 text-center text-brand-textMuted italic">
                          No audit event logs found matching the filter criteria.
                        </td>
                      </tr>
                    ) : (
                      auditLogs.map((l) => (
                        <tr key={l.log_id} className="hover:bg-white/[0.01] transition-colors">
                          <td className="p-4 pl-6 font-mono text-[10px] text-neutral-400">
                            {new Date(l.created_at).toLocaleString()}
                          </td>
                          <td className="p-4">
                            <span className="text-[9px] font-black uppercase text-brand-accent bg-brand-accent/15 px-2 py-0.5 rounded-md border border-brand-accent/20">
                              {l.action}
                            </span>
                          </td>
                          <td className="p-4 text-neutral-200">{l.details}</td>
                          <td className="p-4 font-mono text-[10px] text-neutral-300">
                            {l.actor_email || <span className="text-neutral-500 italic">system / anonymous</span>}
                          </td>
                          <td className="p-4 pr-6 font-mono text-[9px] text-neutral-400 max-w-xs truncate">
                            {l.metadata ? JSON.stringify(l.metadata) : 'None'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminUpload;
