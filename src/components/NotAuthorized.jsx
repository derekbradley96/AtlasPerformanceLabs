import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { createPageUrl } from '@/utils';
import { Lock } from 'lucide-react';

export default function NotAuthorized() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <Lock className="w-8 h-8 text-red-400" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">Access Denied</h1>
        <p className="text-slate-400 mb-8">
          You don't have permission to view this page. Only trainers can access this feature.
        </p>
        <Button
          onClick={() => navigate(createPageUrl('Home'))}
          className="bg-blue-500 hover:bg-blue-600"
        >
          Back to Home
        </Button>
      </div>
    </div>
  );
}