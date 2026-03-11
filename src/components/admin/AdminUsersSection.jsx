import React, { useState } from 'react';
import { base44 } from '@/lib/emptyApi';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, User, Ban } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CardSkeleton } from '@/components/ui/LoadingState';
import { toast } from 'sonner';

export default function AdminUsersSection({ adminEmail }) {
  const isAdmin = adminEmail?.toLowerCase() === 'derekbradley96@gmail.com';

  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => base44.entities.User.list('-created_date'),
    enabled: isAdmin,
  });

  const logAction = async (action, targetId, oldValue, newValue) => {
    await base44.entities.AdminAuditLog.create({
      admin_email: adminEmail,
      action_type: action,
      target_type: 'User',
      target_id: targetId,
      old_value: JSON.stringify(oldValue),
      new_value: JSON.stringify(newValue),
      timestamp: new Date().toISOString()
    });
  };

  const _updateUserMutation = useMutation({
    mutationFn: async ({ userId, data, oldData }) => {
      await base44.asServiceRole.entities.User.update(userId, data);
      await logAction('user_updated', userId, oldData, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success('User updated');
    }
  });

  const filteredUsers = users.filter(u => {
    const matchesSearch = u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      u.email?.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === 'all' || u.user_type === filter;
    return matchesSearch && matchesFilter;
  });

  if (!isAdmin) {
    return null;
  }

  if (isLoading) return <CardSkeleton count={3} />;

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search users..."
            className="pl-10 bg-slate-800 border-slate-700"
          />
        </div>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
        >
          <option value="all">All Users</option>
          <option value="trainer">Trainers</option>
          <option value="client">Clients</option>
          <option value="general">Solo</option>
        </select>
      </div>

      <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl divide-y divide-slate-700/50">
        {filteredUsers.map((user) => (
          <div key={user.id} className="p-4 hover:bg-slate-800/70 transition-colors">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3 flex-1">
                <div className="w-10 h-10 bg-slate-700 rounded-xl flex items-center justify-center">
                  <User className="w-5 h-5 text-slate-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-medium text-white">{user.full_name}</p>
                    {user.user_type && (
                      <Badge className={
                        user.user_type === 'trainer' ? 'bg-blue-500/20 text-blue-400' :
                        user.user_type === 'client' ? 'bg-purple-500/20 text-purple-400' :
                        'bg-slate-500/20 text-slate-400'
                      }>
                        {user.user_type}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-slate-400">{user.email}</p>
                  <p className="text-xs text-slate-500 mt-1">
                    Joined {new Date(user.created_date).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  disabled
                  className="text-slate-500"
                >
                  <Ban className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredUsers.length === 0 && (
        <div className="text-center py-12">
          <p className="text-slate-400">No users found</p>
        </div>
      )}
    </div>
  );
}