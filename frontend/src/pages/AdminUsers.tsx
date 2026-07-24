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

      <div className="flex-1 ml-64 flex flex-col justify-between min-h-screen">
        <TopBar profileName="Admin" />

        <main className="flex-grow pt-24 px-8 md:px-12 pb-20 max-w-7xl mx-auto w-full space-y-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-brand-accent bg-brand-accent/10 px-3 py-1 rounded-full border border-brand-accent/20">
                System Administration
              </span>
              <h1 className="text-3xl md:text-4xl font-black font-display tracking-tight text-white uppercase mt-2">
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
                 className="px-4 py-2.5 bg-brand-cards/40 border border-white/10 focus:border-brand-accent/60 rounded-xl text-xs text-white placeholder:text-neutral-500 focus:outline-none transition-all focus:ring-1 focus:ring-brand-accent/20 w-64"
               />
               <button
                 onClick={() => navigate('/admin/upload')}
                 className="px-4 py-2.5 bg-brand-accent/15 hover:bg-brand-accent/25 text-brand-accent border border-brand-accent/30 rounded-xl text-xs font-bold transition-all btn-premium select-none cursor-pointer"
               >
                 Catalog Ingestion
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
 
           <div className="bg-brand-surface/40 border border-white/5 backdrop-blur-md rounded-3xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.5)] animate-scaleIn">
             {loading ? (
               <div className="p-12 text-center text-brand-textMuted text-sm animate-pulse">
                 Loading platform users...
               </div>
             ) : filteredUsers.length === 0 ? (
               <div className="p-12 text-center text-brand-textMuted text-sm">
                 No matching users found.
               </div>
             ) : (
               <div className="overflow-x-auto">
                 <table className="w-full text-left border-collapse">
                   <thead>
                     <tr className="border-b border-white/5 text-[10px] uppercase font-bold text-brand-textMuted tracking-wider bg-black/20">
                       <th className="p-4 pl-6">User</th>
                       <th className="p-4">Email</th>
                       <th className="p-4">Verification</th>
                       <th className="p-4">Role</th>
                       <th className="p-4">Joined</th>
                       <th className="p-4 pr-6 text-right">Actions</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-white/5 text-xs">
                     {filteredUsers.map((u) => (
                       <tr key={u.user_id} className="hover:bg-white/[0.02] transition-colors">
                         <td className="p-4 pl-6 font-bold text-white flex items-center gap-3">
                           <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-accent to-blue-700 flex items-center justify-center font-black text-xs text-white">
                             {u.name.charAt(0).toUpperCase()}
                           </div>
                           <span>{u.name}</span>
                         </td>
                         <td className="p-4 text-neutral-300 font-mono text-[11px]">{u.email}</td>
                         <td className="p-4">
                           {u.is_verified ? (
                             <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                               Verified
                             </span>
                           ) : (
                             <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20">
                               Pending
                             </span>
                           )}
                         </td>
                         <td className="p-4">
                           {u.is_admin ? (
                             <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase text-brand-accent bg-brand-accent/15 px-2.5 py-0.5 rounded-full border border-brand-accent/30">
                               Admin
                             </span>
                           ) : (
                             <span className="text-[10px] font-semibold text-neutral-400 bg-neutral-800/40 px-2.5 py-0.5 rounded-full border border-white/5">
                               Member
                             </span>
                           )}
                         </td>
                         <td className="p-4 text-neutral-400 text-[11px]">
                           {u.created_at ? new Date(u.created_at).toLocaleDateString() : 'N/A'}
                         </td>
                         <td className="p-4 pr-6 text-right">
                           <button
                             onClick={() => handleToggleAdmin(u)}
                             disabled={updatingUserId === u.user_id}
                             className={`px-4 py-1.5 rounded-xl text-[10px] font-extrabold transition-all border btn-premium select-none cursor-pointer ${
                               u.is_admin
                                 ? 'bg-red-500/10 hover:bg-red-500/25 text-rose-350 border-red-500/20'
                                 : 'bg-brand-accent/15 hover:bg-brand-accent/25 text-brand-accent border-brand-accent/30'
                             }`}
                           >
                             {updatingUserId === u.user_id ? 'Updating...' : u.is_admin ? 'Revoke Admin' : 'Promote to Admin'}
                           </button>
                         </td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default AdminUsers;
