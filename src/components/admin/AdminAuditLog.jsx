import React from 'react';
import { base44 } from '@/lib/emptyApi';
import { useQuery } from '@tanstack/react-query';
import { History } from 'lucide-react';
import { CardSkeleton } from '@/components/ui/LoadingState';
import { formatDistanceToNow } from 'date-fns';

export default function AdminAuditLog({ adminEmail }) {
  const isAdmin = adminEmail?.toLowerCase() === 'derekbradley96@gmail.com';

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['audit-log'],
    queryFn: () => base44.entities.AdminAuditLog.list('-created_date', 100),
    enabled: isAdmin,
  });

  if (!isAdmin) {
    return null;
  }

  if (isLoading) return <CardSkeleton count={3} />;

  return (
    <div className="space-y-4">
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl divide-y divide-slate-700/50">
        {logs.map((log) => (
          <div key={log.id} className="p-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-blue-500/10 rounded-lg flex items-center justify-center flex-shrink-0">
                <History className="w-4 h-4 text-blue-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <p className="font-medium text-white text-sm">{log.action_type}</p>
                  <span className="text-xs text-slate-500">
                    {formatDistanceToNow(new Date(log.created_date), { addSuffix: true })}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mb-1">By: {log.admin_email}</p>
                {log.target_type && (
                  <p className="text-xs text-slate-500">Target: {log.target_type}</p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {logs.length === 0 && (
        <div className="text-center py-12">
          <History className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400">No audit logs yet</p>
        </div>
      )}
    </div>
  );
}