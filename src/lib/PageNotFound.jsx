import { useLocation, useNavigate } from 'react-router-dom';
import { Home, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/AuthContext';
import { getDashboardPathForRole } from '@/lib/routeInventory';

export default function PageNotFound({}) {
    const location = useLocation();
    const navigate = useNavigate();
    const pageName = location.pathname.substring(1);
    const { user, role } = useAuth();
    const isAdmin = role === 'admin' || user?.role === 'admin';
    const homePath = getDashboardPathForRole(role) || '/home';

    return (
        <div className="min-h-screen flex flex-col justify-center p-6 bg-atlas-bg text-atlas-text">
            <div className="w-full space-y-4">
                    <p className="text-slate-400 text-sm">Page not found</p>
                    <p className="text-slate-500 text-sm">
                        <span className="text-slate-400">"{pageName}"</span> could not be found.
                    </p>

                    {isAdmin && (
                        <div className="mt-4 p-3 bg-amber-500/10 rounded-xl border border-amber-500/30 text-left">
                            <p className="text-xs font-medium text-amber-300">Admin</p>
                            <p className="text-xs text-amber-300/70 mt-0.5">
                                This page may not be implemented yet.
                            </p>
                        </div>
                    )}
                    <div className="pt-4 flex gap-3 flex-wrap">
                        <Button 
                            onClick={() => navigate(-1)}
                            variant="outline"
                            size="sm"
                            className="border-slate-600 text-slate-300"
                        >
                            <ArrowLeft className="w-4 h-4 mr-1.5" />
                            Back
                        </Button>
                        <Button 
                            onClick={() => navigate(homePath)}
                            size="sm"
                            className="bg-atlas-accent"
                        >
                            <Home className="w-4 h-4 mr-1.5" />
                            Home
                        </Button>
                    </div>
            </div>
        </div>
    )
}