import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';

export default function NavigationTracker() {
    const location = useLocation();
    const { isAuthenticated } = useAuth();

    useEffect(() => {
        if (!isAuthenticated) return;
        const pathname = location.pathname || '';
        const segment = pathname.replace(/^\//, '').split('/')[0] || 'home';
        // no-op: analytics disabled; segment available for future tracking
        void segment;
    }, [location.pathname, isAuthenticated]);

    return null;
}