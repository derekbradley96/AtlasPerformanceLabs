import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { normalizeRole } from '@/lib/roles';
import {
  Home, Dumbbell, TrendingUp, MoreHorizontal, User,
  Users, MessageSquare, FileText, DollarSign, BookOpen, ClipboardList,
} from 'lucide-react';

export default function BottomNav({ userRole }) {
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (tab) => {
    if (tab.path) return location.pathname === tab.path;
    return location.pathname === createPageUrl(tab.page);
  };

  const handleNav = (tab) => {
    if (tab.path) navigate(tab.path);
    else navigate(createPageUrl(tab.page));
  };

  // Client Navigation
  const clientTabs = [
    { name: 'Home', icon: Home, page: 'Home' },
    { name: 'My Program', icon: BookOpen, page: 'MyProgram' },
    { name: 'Progress', icon: TrendingUp, page: 'Progress' },
    { name: 'Messages', icon: MessageSquare, page: 'Messages' },
    { name: 'More', icon: MoreHorizontal, page: 'More' },
  ];

  // Personal user — direct access to program builder
  const soloTabs = [
    { name: 'Home', icon: Home, page: 'Home' },
    { name: 'My Plan', icon: ClipboardList, path: '/program-builder', page: 'program-builder' },
    { name: 'Workouts', icon: Dumbbell, page: 'Workout' },
    { name: 'Progress', icon: TrendingUp, page: 'Progress' },
    { name: 'More', icon: MoreHorizontal, page: 'More' },
  ];

  // Coach Navigation
  const trainerTabs = [
    { name: 'Home', icon: Home, page: 'Home' },
    { name: 'Clients', icon: Users, page: 'Clients' },
    { name: 'Build', icon: ClipboardList, path: '/program-builder', page: 'program-builder' },
    { name: 'Programs', icon: FileText, page: 'Programs' },
    { name: 'More', icon: MoreHorizontal, page: 'More' },
  ];

  // General user (no role assigned yet)
  const generalTabs = [
    { name: 'Home', icon: Home, page: 'Home' },
    { name: 'Workout', icon: Dumbbell, page: 'Workout' },
    { name: 'Progress', icon: TrendingUp, page: 'Progress' },
    { name: 'Profile', icon: User, page: 'Profile' },
    { name: 'More', icon: MoreHorizontal, page: 'More' },
  ];

  const norm = normalizeRole(userRole);
  const tabs =
    norm === 'coach' ? trainerTabs :
    norm === 'client' ? clientTabs :
    norm === 'personal' ? soloTabs :
    generalTabs;

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur-lg border-t border-slate-800 z-50">
      <div className="grid grid-cols-5 h-16">
        {tabs.map((tab) => {
          const active = isActive(tab);
          return (
            <button
              key={tab.page || tab.path}
              onClick={() => handleNav(tab)}
              className={`flex flex-col items-center justify-center gap-1 transition-colors ${
                active
                  ? 'text-blue-400'
                  : 'text-slate-400 hover:text-slate-300'
              }`}
            >
              <tab.icon className={`w-5 h-5 ${active ? 'stroke-[2.5]' : 'stroke-2'}`} />
              <span className="text-[10px] font-medium">{tab.name}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
