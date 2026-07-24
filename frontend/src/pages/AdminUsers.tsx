import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import Sidebar from '../components/Sidebar';
import TopBar from '../components/TopBar';
import { useModal } from '../components/ModalProvider';

interface UserData {
  user_id: string;
  name: string;
  email: string;
  is_verified: boolean;
  is_admin: boolean;
  subscription_plan: string;
  created_at: string;
}

const AdminUsers: React.FC = () => {
  const { showConfirm } = useModal();
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await api.get('/admin/users');
      setUsers(response.data);
    } catch (err: any) {
      setMessage({
        type: 'error',
        text: err.response?.data?.detail || 'Failed to fetch platform users list.'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleToggleAdmin = async (user: UserData) => {
    const targetAction = user.is_admin ? 'revoke admin privileges from' : 'promote to admin';
    const confirm = await showConfirm(
      "Modify Access Privileges",
      `Are you sure you want to ${targetAction} ${user.email}?`,
      user.is_admin ? 'danger' : 'info',
      user.is_admin ? 'Revoke Admin' : 'Promote'
    );
    if (!confirm) return;

    try {
      setUpdatingUserId(user.user_id);
      setMessage(null);
      await api.put(`/admin/users/${user.user_id}/role`, { is_admin: !user.is_admin });
      setMessage({
        type: 'success',
        text: `User ${user.email} ${user.is_admin ? 'demoted to regular user' : 'promoted to admin'} successfully.`
      });
      await fetchUsers();
    } catch (err: any) {
      setMessage({
        type: 'error',
        text: err.response?.data?.detail || 'Failed to update user role.'
      });
    } finally {
      setUpdatingUserId(null);
    }
  };

  const filteredUsers = users.filter(
    u => u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-transparent text-white flex font-sans select-none">
      <Sidebar />

      <div className="flex-1 ml-56 flex flex-col justify-between min-h-screen">
        <TopBar profileName="Admin" />

        <main className="flex-grow pt-24 px-8 md:px-12 pb-20 max-w-7xl mx-auto w-full space-y-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-black font-display tracking-tighter text-white uppercase mt-2">
                User Management
              </h1>
              <p className="text-xs text-brand-textMuted font-medium mt-1">
                View platform accounts and manage administrator access privileges.
              </p>
            </div>

             <div className="flex items-center gap-3">
               <input
                 type="text"
                 placeholder="Search users by name or email..."
                 value={search}
                 onChange={(e) => setSearch(e.target.value)}
                 className="px-4 py-2.5 bg-black/40 rounded-2xl text-xs text-white placeholder:text-neutral-500 focus:outline-none transition-all w-64"
               />
               <button
                 onClick={() => navigate('/admin/upload')}
                 className="px-4 py-2.5 bg-brand-accent hover:bg-blue-600 text-white rounded-2xl text-xs font-black uppercase tracking-wider transition-all btn-premium select-none cursor-pointer flex items-center gap-1 active:scale-95"
               >
                 <span>Catalog Ingestion</span>
                 <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                   <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                 </svg>
               </button>
             </div>
           </div>
 
           {message && (
             <div className={`p-4 rounded-2xl text-xs font-semibold flex items-center gap-3 border animate-scaleIn ${
               message.type === 'success' 
                 ? 'bg-emerald-950/40 border-emerald-800/30 text-emerald-300' 
                 : 'bg-red-950/40 border-red-800/30 text-rose-300'
             }`}>
               <span>{message.text}</span>
             </div>
           )}
 
            <div className="animate-scaleIn">
              {loading ? (
                <div className="p-12 text-center text-brand-textMuted text-sm animate-pulse bg-neutral-900/40 rounded-3xl">
                  Loading platform users...
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="p-12 text-center text-brand-textMuted text-sm bg-neutral-900/40 rounded-3xl">
                  No matching users found.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredUsers.map((u) => (
                    <div 
                      key={u.user_id} 
                      className="bg-[#0c142c]/90 p-5 rounded-[24px] flex flex-col justify-between space-y-4 transition-all duration-300 hover:scale-[1.02] group"
                    >
                      <div className="space-y-3">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-2xl bg-brand-accent flex items-center justify-center font-black text-lg text-white group-hover:scale-105 transition-transform duration-250 shrink-0 animate-[scaleIn_0.3s]">
                            {u.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0 space-y-0.5">
                            <span className="font-extrabold text-sm text-white truncate block">{u.name}</span>
                            <span className="text-[10px] text-neutral-455 font-mono block truncate" title={u.email}>{u.email}</span>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 text-[10px] pt-1">
                          <div className="space-y-1">
                            <span className="text-neutral-500 block uppercase font-bold tracking-wider">Verification</span>
                            {u.is_verified ? (
                              <span className="inline-flex items-center gap-1 font-black text-emerald-400">
                                Verified
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 font-black text-amber-400">
                                Pending
                              </span>
                            )}
                          </div>
                          
                          <div className="space-y-1">
                            <span className="text-neutral-500 block uppercase font-bold tracking-wider">Plan & Role</span>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className={`font-black uppercase tracking-wider text-[9px] ${
                                u.subscription_plan === 'premium'
                                  ? 'text-amber-400'
                                  : 'text-neutral-450'
                              }`}>
                                {u.subscription_plan || 'free'}
                              </span>
                              {u.is_admin && (
                                <span className="font-black uppercase tracking-wider text-brand-accent text-[8px]">
                                  Admin
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="text-[10px] text-neutral-450 flex justify-between items-center pt-2">
                          <span className="font-semibold uppercase tracking-wider text-[8px] text-neutral-500">Joined Platform</span>
                          <span className="font-mono text-neutral-350 font-bold">
                            {u.created_at ? new Date(u.created_at).toLocaleDateString() : 'N/A'}
                          </span>
                        </div>
                      </div>

                      <div className="pt-2">
                        <button
                          onClick={() => handleToggleAdmin(u)}
                          disabled={updatingUserId === u.user_id}
                          className={`w-full py-2.5 rounded-xl text-[10px] font-extrabold uppercase tracking-wider transition-all select-none cursor-pointer ${
                            u.is_admin
                              ? 'bg-red-500/10 hover:bg-red-500/25 text-rose-300 border border-red-500/20'
                              : 'bg-brand-accent/15 hover:bg-brand-accent/25 text-brand-accent border border-brand-accent/30'
                          }`}
                        >
                          {updatingUserId === u.user_id ? 'Updating...' : u.is_admin ? 'Revoke Access' : 'Promote to Admin'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
        </main>
      </div>
    </div>
  );
};

export default AdminUsers;
