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
  created_at: string;
}

interface SystemStats {
  total_users: number;
  total_admins: number;
  total_movies: number;
  total_videos: number;
  total_storage_bytes: number;
  total_free_users: number;
  total_premium_users: number;
  conversion_percentage: number;
}

interface CacheStats {
  hits: number;
  misses: number;
  hit_rate_pct: number;
  total_keys: number;
  redis_connected: boolean;
  cache_engine: string;
}

interface RegisteredUser {
  user_id: string;
  name: string;
  email: string;
  is_verified: boolean;
  is_admin: boolean;
  subscription_plan: string;
  created_at: string | null;
}

const AdminUpload: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [selectedMovieId, setSelectedMovieId] = useState<string>('');
  const [movies, setMovies] = useState<MovieOption[]>([]);
  const [videos, setVideos] = useState<VideoAsset[]>([]);
  const [registeredUsers] = useState<RegisteredUser[]>([]);
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [cacheStats, setCacheStats] = useState<CacheStats | null>(null);
  const [clearingCache, setClearingCache] = useState(false);
  
  const [uploading, setUploading] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [activePreviewVideo, setActivePreviewVideo] = useState<VideoAsset | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchMovies();
    fetchVideos();
    fetchStats();
    fetchCacheStats();
  }, []);

  const fetchMovies = async () => {
    try {
      const response = await api.get('/catalog/movies');
      setMovies(response.data);
    } catch (err) {
      console.error('Failed to load movies catalog', err);
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

  const fetchStats = async () => {
    try {
      const response = await api.get('/admin/stats');
      setStats(response.data);
    } catch (err) {
      console.error('Failed to load system stats', err);
    }
  };

  const fetchCacheStats = async () => {
    try {
      const response = await api.get('/admin/cache/stats');
      setCacheStats(response.data);
    } catch (err) {
      console.error('Failed to load cache stats', err);
    }
  };

  const handleClearCache = async () => {
    try {
      setClearingCache(true);
      await api.post('/admin/cache/clear');
      setSuccessMsg('Redis & memory cache cleared successfully!');
      fetchCacheStats();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to clear cache.');
    } finally {
      setClearingCache(false);
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
      fetchStats();
    } catch (err: any) {
      setError(
        err.response?.data?.detail || 'Failed to upload video asset. Please try again.'
      );
    } finally {
      setUploading(false);
    }
  };

  const handleProcessHLS = async (videoId: string) => {
    setProcessingId(videoId);
    setError(null);
    setSuccessMsg(null);

    // Immediately transition state in UI to 'processing' for instant feedback
    setVideos((prev) =>
      prev.map((v) => (v.video_id === videoId ? { ...v, status: 'processing' } : v))
    );

    try {
      await api.post(`/videos/admin/${videoId}/process-hls`);
      setSuccessMsg(`HLS VOD processing successfully triggered and completed.`);
      await fetchVideos();
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
      fetchStats();
    } catch (err) {
      alert('Failed to delete video asset.');
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (!bytes || bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFullPlaybackUrl = (playbackPath: string): string => {
    const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
    return `${baseUrl.replace('/api', '')}${playbackPath}`;
  };

  const getMovieTitle = (movieId: string | null): string => {
    if (!movieId) return 'Unlinked';
    const found = movies.find((m) => m.movie_id === movieId);
    return found ? `${found.title} (${found.release_year})` : 'Unlinked';
  };

  const renderStatusBadge = (status: string) => {
    const s = status.toLowerCase();
    switch (s) {
      case 'completed':
      case 'ready':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            COMPLETED (HLS)
          </span>
        );
      case 'processing':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold uppercase bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
            PROCESSING
          </span>
        );
      case 'uploaded':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold uppercase bg-blue-500/10 text-brand-accent border border-blue-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-accent" />
            UPLOADED
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold uppercase bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
            FAILED
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-extrabold uppercase bg-blue-500/10 text-brand-accent border border-blue-500/20">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen bg-brand-background text-white font-sans selection:bg-brand-accent selection:text-white pb-20">
      
      {/* Top Navbar */}
      <header className="border-b border-white/5 bg-[#070E26]/80 backdrop-blur-xl sticky top-0 z-40 px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link to="/" className="text-2xl font-black text-brand-accent tracking-wider font-display">
            ZePlay
          </Link>
          <div className="flex items-center gap-2">
            <span className="text-xs font-extrabold px-3 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30 flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              Admin Dashboard
            </span>
          </div>
        </div>
        <Link
          to="/"
          className="text-xs font-bold text-brand-textMuted hover:text-white transition-colors duration-200"
        >
          ← Back to Catalog
        </Link>
      </header>

      <main className="max-w-6xl mx-auto px-6 pt-10 space-y-10">
        
        {/* Page Title & Header */}
        <div>
          <h1 className="text-3xl font-black font-display tracking-tight text-white mb-2">
            HLS Video Ingestion & Processing Control
          </h1>
          <p className="text-xs text-brand-textMuted font-medium">
            Manage video assets, trigger FFmpeg HLS VOD segmentation, inspect status state transitions, and monitor storage infrastructure.
          </p>
        </div>

        {/* System Stats Cards */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div
            className="p-5 rounded-2xl border border-white/5 space-y-1"
            style={{ background: 'linear-gradient(135deg, rgba(16,28,64,0.6) 0%, rgba(11,21,53,0.8) 100%)' }}
          >
            <div className="flex justify-between items-center text-brand-textMuted">
              <span className="text-xs font-bold uppercase tracking-wider">Ingested Videos</span>
              <svg className="w-5 h-5 text-brand-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="text-3xl font-black font-display text-white">
              {stats ? stats.total_videos : videos.length}
            </p>
            <p className="text-[10px] text-emerald-400 font-semibold">HLS Transcoded Stream Assets</p>
          </div>

          <div
            className="p-5 rounded-2xl border border-white/5 space-y-1"
            style={{ background: 'linear-gradient(135deg, rgba(16,28,64,0.6) 0%, rgba(11,21,53,0.8) 100%)' }}
          >
            <div className="flex justify-between items-center text-brand-textMuted">
              <span className="text-xs font-bold uppercase tracking-wider">Storage Consumed</span>
              <svg className="w-5 h-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
              </svg>
            </div>
            <p className="text-3xl font-black font-display text-white">
              {stats ? formatFileSize(stats.total_storage_bytes) : formatFileSize(videos.reduce((a, v) => a + (v.file_size_bytes || 0), 0))}
            </p>
            <p className="text-[10px] text-brand-textMuted font-semibold">Local Storage Disk</p>
          </div>

          <div
            className="p-5 rounded-2xl border border-white/5 space-y-1"
            style={{ background: 'linear-gradient(135deg, rgba(16,28,64,0.6) 0%, rgba(11,21,53,0.8) 100%)' }}
          >
            <div className="flex justify-between items-center text-brand-textMuted">
              <span className="text-xs font-bold uppercase tracking-wider">Catalog Titles</span>
              <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
              </svg>
            </div>
            <p className="text-3xl font-black font-display text-white">
              {stats ? stats.total_movies : movies.length}
            </p>
            <p className="text-[10px] text-amber-400 font-semibold">Active Catalog Movies</p>
          </div>

          <div
            className="p-5 rounded-2xl border border-white/5 space-y-1"
            style={{ background: 'linear-gradient(135deg, rgba(16,28,64,0.6) 0%, rgba(11,21,53,0.8) 100%)' }}
          >
            <div className="flex justify-between items-center text-brand-textMuted">
              <span className="text-xs font-bold uppercase tracking-wider">Users & Admins</span>
              <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <p className="text-3xl font-black font-display text-white">
              {stats ? stats.total_users : '1+'}
            </p>
            <p className="text-[10px] text-emerald-400 font-semibold">
              {stats ? `${stats.total_admins} Admin Role(s)` : 'Admin Authorized'}
            </p>
          </div>

          <div
            className="p-5 rounded-2xl border border-white/5 space-y-1"
            style={{ background: 'linear-gradient(135deg, rgba(16,28,64,0.6) 0%, rgba(11,21,53,0.8) 100%)' }}
          >
            <div className="flex justify-between items-center text-brand-textMuted">
              <span className="text-xs font-bold uppercase tracking-wider">Premium Conversion</span>
              <svg className="w-5 h-5 text-amber-500" fill="currentColor" viewBox="0 0 24 24">
                <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
              </svg>
            </div>
            <p className="text-3xl font-black font-display text-white">
              {stats ? `${stats.conversion_percentage}%` : '0%'}
            </p>
            <p className="text-[10px] text-amber-400 font-semibold">
              {stats ? `${stats.total_premium_users} Premium / ${stats.total_free_users} Free` : 'Loading Conversion'}
            </p>
          </div>
        </section>

        {/* Redis Cache Control & Statistics Panel */}
        <section
          className="p-6 rounded-3xl border border-white/5 space-y-6"
          style={{ background: 'linear-gradient(135deg, rgba(16,28,64,0.7) 0%, rgba(11,21,53,0.9) 100%)' }}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-extrabold uppercase tracking-widest text-white">
                  Redis Caching Layer Statistics
                </span>
                <span className={`text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full border ${
                  cacheStats?.redis_connected
                    ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                    : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                }`}>
                  {cacheStats?.cache_engine || 'Connecting...'}
                </span>
              </div>
              <p className="text-xs text-brand-textMuted mt-1">
                Real-time API response caching metrics across Homepage, Recommendations, Catalog, and Movie Details VOD.
              </p>
            </div>

            <button
              onClick={handleClearCache}
              disabled={clearingCache}
              className="px-5 py-2.5 bg-rose-600/80 hover:bg-rose-600 text-white font-bold rounded-xl text-xs transition-all flex items-center gap-2 shadow-lg shadow-rose-600/20 disabled:opacity-50"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              {clearingCache ? 'Clearing...' : 'Clear Cache'}
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white/5 border border-white/5 p-4 rounded-xl">
              <span className="text-[10px] font-extrabold uppercase text-neutral-400 block">Cache Hit Rate</span>
              <span className="text-2xl font-black text-emerald-400 font-display">
                {cacheStats ? `${cacheStats.hit_rate_pct}%` : '0%'}
              </span>
            </div>
            <div className="bg-white/5 border border-white/5 p-4 rounded-xl">
              <span className="text-[10px] font-extrabold uppercase text-neutral-400 block">Cache Hits</span>
              <span className="text-2xl font-black text-brand-accent font-display">
                {cacheStats ? cacheStats.hits : 0}
              </span>
            </div>
            <div className="bg-white/5 border border-white/5 p-4 rounded-xl">
              <span className="text-[10px] font-extrabold uppercase text-neutral-400 block">Cache Misses</span>
              <span className="text-2xl font-black text-amber-400 font-display">
                {cacheStats ? cacheStats.misses : 0}
              </span>
            </div>
            <div className="bg-white/5 border border-white/5 p-4 rounded-xl">
              <span className="text-[10px] font-extrabold uppercase text-neutral-400 block">Keys Cached</span>
              <span className="text-2xl font-black text-indigo-400 font-display">
                {cacheStats ? cacheStats.total_keys : 0}
              </span>
            </div>
          </div>
        </section>

        {/* Upload Form Panel */}
        <section
          className="rounded-2xl p-8 shadow-2xl relative overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, rgba(11,21,53,0.92) 0%, rgba(7,14,38,0.96) 100%)',
            border: '1px solid rgba(255,255,255,0.07)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
          }}
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold font-display text-white">Upload & Auto-Process Video Asset</h2>
            <span className="text-[10px] font-mono text-emerald-400 uppercase bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
              FFmpeg HLS VOD Pipeline
            </span>
          </div>

          {error && (
            <div
              className="text-xs text-red-200 rounded-xl p-3.5 mb-6 font-semibold"
              style={{ background: 'rgba(127,29,29,0.4)', border: '1px solid rgba(239,68,68,0.25)' }}
            >
              {error}
            </div>
          )}

          {successMsg && (
            <div
              className="text-xs text-emerald-300 rounded-xl p-3.5 mb-6 font-semibold"
              style={{ background: 'rgba(6,78,59,0.4)', border: '1px solid rgba(16,185,129,0.25)' }}
            >
              {successMsg}
            </div>
          )}

          <form onSubmit={handleUpload} className="space-y-6">
            
            {/* Drag & Drop Zone */}
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-white/15 hover:border-brand-accent/60 rounded-2xl p-10 text-center cursor-pointer transition-all duration-200 group"
              style={{ background: 'rgba(16,28,64,0.4)' }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*,.mp4,.webm,.mov,.mkv"
                onChange={handleFileChange}
                className="hidden"
              />

              <div className="w-14 h-14 rounded-full bg-brand-accent/10 border border-brand-accent/20 flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-200">
                <svg className="w-7 h-7 text-brand-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>

              {file ? (
                <div>
                  <p className="text-sm font-bold text-white mb-1">{file.name}</p>
                  <p className="text-xs text-brand-textMuted">{formatFileSize(file.size)} • Click or drag to replace</p>
                </div>
              ) : (
                <div>
                  <p className="text-sm font-bold text-white mb-1">
                    Drag & drop your video file here, or <span className="text-brand-accent underline">browse</span>
                  </p>
                  <p className="text-xs text-brand-textMuted">
                    Supports MP4, WebM, MOV, MKV files (Auto HLS Segmentation)
                  </p>
                </div>
              )}
            </div>

            {/* Movie Selector */}
            <div>
              <label className="block text-[10px] text-brand-textMuted uppercase tracking-widest mb-2 font-bold">
                Link to Movie Title (Optional)
              </label>
              <select
                value={selectedMovieId}
                onChange={(e) => setSelectedMovieId(e.target.value)}
                className="w-full px-4 py-3 text-white rounded-xl text-sm outline-none transition-all duration-200 cursor-pointer"
                style={{
                  background: 'rgba(16,28,64,0.8)',
                  border: '1px solid rgba(255,255,255,0.09)',
                }}
              >
                <option value="" className="bg-[#0B1535]">-- Unlinked Asset --</option>
                {movies.map((m) => (
                  <option key={m.movie_id} value={m.movie_id} className="bg-[#0B1535]">
                    {m.title} ({m.release_year})
                  </option>
                ))}
              </select>
            </div>

            {/* Progress Bar */}
            {uploading && (
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-brand-textMuted font-bold">
                  <span>Uploading & generating HLS VOD playlist...</span>
                  <span className="text-brand-accent">{uploadProgress}%</span>
                </div>
                <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden border border-white/10">
                  <div
                    className="bg-gradient-to-r from-blue-500 to-indigo-500 h-full transition-all duration-150 rounded-full"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={uploading || !file}
              className="w-full py-3.5 text-white font-bold rounded-xl text-sm transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)',
                boxShadow: '0 8px 24px rgba(59,130,246,0.3)',
              }}
            >
              {uploading ? 'Ingesting & Transcoding to HLS...' : 'Upload & Generate HLS Stream'}
            </button>
          </form>
        </section>

        {/* Uploaded Videos Table */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold font-display text-white">
              Uploaded Videos & HLS Registry ({videos.length})
            </h2>
            <button
              onClick={fetchVideos}
              className="text-xs text-brand-accent font-semibold hover:underline flex items-center gap-1"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh Table
            </button>
          </div>

          {videos.length === 0 ? (
            <div className="text-center py-12 bg-[#0B1535]/40 rounded-2xl border border-white/5 text-brand-textMuted text-xs">
              No video assets ingested yet. Upload a file above to populate the registry.
            </div>
          ) : (
            <div className="rounded-2xl border border-white/10 overflow-hidden bg-[#070E26]/60 backdrop-blur-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-white/10 bg-white/[0.02] text-[11px] font-bold text-brand-textMuted uppercase tracking-wider">
                      <th className="py-4 px-6">File Name</th>
                      <th className="py-4 px-6">Linked Title</th>
                      <th className="py-4 px-6">Status State</th>
                      <th className="py-4 px-6">Format / Stream Pointer</th>
                      <th className="py-4 px-6 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-xs font-medium">
                    {videos.map((v) => (
                      <tr key={v.video_id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="py-4 px-6">
                          <div className="font-bold text-white max-w-xs truncate" title={v.original_filename}>
                            {v.original_filename}
                          </div>
                          <div className="text-[10px] text-brand-textMuted font-mono truncate max-w-xs" title={v.video_id}>
                            Size: {formatFileSize(v.file_size_bytes)} • ID: {v.video_id}
                          </div>
                        </td>

                        <td className="py-4 px-6">
                          <span className="text-xs text-neutral-300 font-semibold">
                            {getMovieTitle(v.movie_id)}
                          </span>
                        </td>

                        <td className="py-4 px-6">
                          {renderStatusBadge(v.status)}
                          {v.error_message && (
                            <p className="text-[10px] text-rose-400 mt-1 max-w-xs truncate" title={v.error_message}>
                              {v.error_message}
                            </p>
                          )}
                        </td>

                        <td className="py-4 px-6">
                          <div className="text-white font-semibold flex items-center gap-1.5">
                            <span className="text-[10px] font-mono font-black uppercase px-2 py-0.5 rounded bg-blue-500/10 text-brand-accent border border-blue-500/20">
                              {v.format}
                            </span>
                            <span className="text-xs">{v.mime_type}</span>
                          </div>
                          <div className="text-[10px] text-brand-textMuted font-mono truncate max-w-xs mt-0.5">
                            {v.hls_url || v.playback_url}
                          </div>
                        </td>

                        <td className="py-4 px-6 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleProcessHLS(v.video_id)}
                              disabled={processingId === v.video_id}
                              className="px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 font-bold text-xs rounded-lg transition-all flex items-center gap-1 disabled:opacity-50"
                            >
                              {processingId === v.video_id ? 'Transcoding...' : 'Process HLS'}
                            </button>
                            <button
                              onClick={() => setActivePreviewVideo(v)}
                              className="px-3 py-1.5 bg-brand-accent/10 hover:bg-brand-accent/20 border border-brand-accent/30 text-brand-accent font-bold text-xs rounded-lg transition-all flex items-center gap-1"
                            >
                              Preview
                            </button>
                            <button
                              onClick={() => handleDeleteVideo(v.video_id)}
                              className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 font-bold text-xs rounded-lg transition-all"
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
            </div>
          )}
        </section>

        {/* Section 5: Registered Users Management */}
        <section className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-bold text-white font-display flex items-center gap-2">
                <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
                Registered Platform Users ({registeredUsers.length})
              </h2>
              <p className="text-xs text-brand-textMuted">
                Admin visibility into registered accounts, verification status, and subscription plans
              </p>
            </div>
          </div>

          <div
            className="rounded-2xl border border-white/10 overflow-hidden shadow-xl"
            style={{ background: 'rgba(16,28,64,0.5)', backdropFilter: 'blur(16px)' }}
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-white/10 bg-white/5 text-neutral-400 font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-3.5 px-4">User</th>
                    <th className="py-3.5 px-4">User ID</th>
                    <th className="py-3.5 px-4">Verification</th>
                    <th className="py-3.5 px-4">Role</th>
                    <th className="py-3.5 px-4">Plan</th>
                    <th className="py-3.5 px-4">Registered Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-neutral-300">
                  {registeredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-neutral-500">
                        No registered users found.
                      </td>
                    </tr>
                  ) : (
                    registeredUsers.map((u) => (
                      <tr key={u.user_id} className="hover:bg-white/5 transition-colors">
                        <td className="py-3.5 px-4 font-semibold text-white">
                          <div>{u.name}</div>
                          <div className="text-[11px] text-brand-textMuted font-mono">{u.email}</div>
                        </td>
                        <td className="py-3.5 px-4 font-mono text-[10px] text-neutral-400">{u.user_id}</td>
                        <td className="py-3.5 px-4">
                          {u.is_verified ? (
                            <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-lg text-[10px] font-bold">
                              ✓ Verified
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded-lg text-[10px] font-bold">
                              Unverified
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          {u.is_admin ? (
                            <span className="px-2.5 py-1 bg-purple-500/15 text-purple-300 border border-purple-500/30 rounded-lg text-[10px] font-bold">
                              Admin
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 bg-white/5 text-neutral-400 border border-white/10 rounded-lg text-[10px] font-bold">
                              User
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 uppercase font-bold text-[10px] text-brand-accent">
                          {u.subscription_plan}
                        </td>
                        <td className="py-3.5 px-4 text-neutral-400 text-[11px]">
                          {u.created_at ? new Date(u.created_at).toLocaleDateString() : 'N/A'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

      </main>

      {/* Footer */}
      <footer className="p-6 text-center text-xs text-neutral-500 border-t border-white/5 bg-[#081225]/40 backdrop-blur-sm space-y-1 mt-12">
        <div>&copy; {new Date().getFullYear()} ZePlay Platform. All rights reserved.</div>
        <div>
          <a
            href="https://zeploy.tech"
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand-accent hover:underline font-bold tracking-wider"
          >
            POWERED BY ZEPLOY TECH
          </a>
        </div>
      </footer>

      {/* Video Player Modal */}
      {activePreviewVideo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="relative w-full max-w-4xl bg-[#0B1535] border border-white/10 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold text-white font-display">
                  Stream Preview: {activePreviewVideo.original_filename}
                </h3>
                <p className="text-xs text-brand-textMuted">
                  Endpoint: {activePreviewVideo.hls_url || activePreviewVideo.playback_url}
                </p>
              </div>
              <button
                onClick={() => setActivePreviewVideo(null)}
                className="text-neutral-400 hover:text-white font-bold text-lg px-2"
              >
                ✕
              </button>
            </div>

            <div className="aspect-video bg-black rounded-xl overflow-hidden border border-white/5">
              <video
                controls
                autoPlay
                className="w-full h-full"
                src={getFullPlaybackUrl(activePreviewVideo.hls_url || activePreviewVideo.playback_url)}
              >
                Your browser does not support video playback.
              </video>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default AdminUpload;
