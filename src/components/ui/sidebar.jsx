import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  Home, Dumbbell, TrendingUp, User, Users, 
  DollarSign, ClipboardCheck, MessageSquare, LogOut, LayoutDashboard, FileText, Brain 
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { createPageUrl } from '@/utils';
import { useAuth } from '@/lib/AuthContext';
import { isPersonal, isCoach, normalizeRole } from '@/lib/roles';
import { buildPersonalCoachTierSelectionUrl } from '@/lib/marketplaceScreenState';
import { useInboxBadgeCount } from '@/hooks/useInboxBadgeCount';
export default function Sidebar({ userRole }) {
  const location = useLocation();
  const { signOut } = useAuth();
  const inboxBadgeCount = useInboxBadgeCount();
  
  // Trainer navigation
  const trainerNavItems = [
    { path: createPageUrl('Home'), page: 'Home', icon: LayoutDashboard, label: 'Dashboard' },
    { path: createPageUrl('Clients'), page: 'Clients', icon: Users, label: 'Clients' },
    { path: createPageUrl('TrainingIntelligence'), page: 'TrainingIntelligence', icon: Brain, label: 'Intelligence' },
    { path: createPageUrl('Programs'), page: 'Programs', icon: FileText, label: 'Programs' },
    { path: createPageUrl('Messages'), page: 'Messages', icon: MessageSquare, label: 'Messages' },
    { path: createPageUrl('Earnings'), page: 'Earnings', icon: DollarSign, label: 'Earnings' },
  ];

  const discoverNavPath = isPersonal(userRole)
    ? buildPersonalCoachTierSelectionUrl({ source: 'from_general_discovery' })
    : '/discover';

  // Client/Solo navigation
  const clientNavItems = [
    { path: createPageUrl('Home'), page: 'Home', icon: Home, label: 'Home' },
    { path: createPageUrl('MyProgram'), page: 'MyProgram', icon: ClipboardCheck, label: 'My programme', roles: ['client'] },
    { path: '/today', page: 'Today', icon: Dumbbell, label: 'Workouts' },
    { path: createPageUrl('Progress'), page: 'Progress', icon: TrendingUp, label: 'Progress' },
    { path: discoverNavPath, page: 'Discover', icon: Users, label: 'Find a coach' },
    { path: createPageUrl('Messages'), page: 'Messages', icon: MessageSquare, label: 'Messages', roles: ['client'] },
    { path: createPageUrl('Profile'), page: 'Profile', icon: User, label: 'Profile' },
  ].filter(item => !item.roles || item.roles.includes(normalizeRole(userRole)));

  const navItems = isCoach(userRole) ? trainerNavItems : clientNavItems;
  const filteredItems = navItems;

  const discoverNavActive =
    location.pathname === '/discover' ||
    location.pathname.startsWith('/marketplace/coach') ||
    location.pathname === '/personal/coach-tier-selection';

  return (
    <aside className="hidden md:flex flex-col w-64 bg-atlas-primary border-r border-atlas-border h-screen fixed left-0 top-0">
      <div className="p-6">
        <Link to={createPageUrl('Home')} className="flex items-center gap-3">
          <span className="text-xl font-bold text-white tracking-tight">Atlas Performance</span>
        </Link>
      </div>
      
      <nav className="flex-1 px-4 py-2 space-y-1">
        {filteredItems.map((item) => {
          const isActive =
            (item.page === 'Discover' && discoverNavActive) ||
            (item.page !== 'Discover' &&
              (location.pathname === item.path ||
                (item.path !== '/app' &&
                  item.path !== '/discover' &&
                  item.path !== '/personal/coach-tier-selection' &&
                  location.pathname.startsWith(item.path))));
          const Icon = item.icon;
          
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium",
                isActive 
                  ? "bg-atlas-accent/10 text-atlas-accent border border-atlas-accent/20" 
                  : "text-slate-400 hover:text-white hover:bg-atlas-surface"
              )}
            >
              <Icon className="w-5 h-5" />
              <span>{item.label}</span>
              {item.page === 'Messages' && inboxBadgeCount > 0 ? (
                <span
                  className="ml-auto inline-flex items-center justify-center rounded-full text-[11px] font-bold text-white"
                  style={{ minWidth: 18, height: 18, padding: '0 5px', background: '#EF4444' }}
                >
                  {inboxBadgeCount > 99 ? '99+' : inboxBadgeCount}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>
      
      <div className="p-4 border-t border-atlas-border">
        <button 
          onClick={() => signOut('/login')}
          className="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all w-full font-medium"
        >
          <LogOut className="w-5 h-5" />
          <span>Log out</span>
        </button>
      </div>
    </aside>
  );
}