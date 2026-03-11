import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';

export default function EmptyPagePlaceholder({ 
  icon: Icon, 
  title, 
  description 
}) {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen pb-24 flex flex-col items-center justify-center px-4">
      <div className="text-center">
        {Icon && (
          <div className="w-16 h-16 bg-slate-800/50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Icon className="w-8 h-8 text-slate-500" />
          </div>
        )}
        <h1 className="text-2xl font-bold text-white mb-2">{title}</h1>
        <p className="text-slate-400 mb-8 max-w-sm">{description}</p>
        <Button 
          variant="outline" 
          onClick={() => navigate(createPageUrl('Home'))}
          className="border-slate-700"
        >
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Home
        </Button>
      </div>
    </div>
  );
}