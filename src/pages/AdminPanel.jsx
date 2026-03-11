import React from 'react';
import { PageLoader } from '@/components/ui/LoadingState';
import { useAuth } from '@/lib/AuthContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Shield, Users, DollarSign, Palette, FileText, BarChart3, History, Store, ToggleLeft } from 'lucide-react';
import AdminUsersSection from '@/components/admin/AdminUsersSection';
import AdminTrainersSection from '@/components/admin/AdminTrainersSection';
import AdminBillingSettings from '@/components/admin/AdminBillingSettings';
import AdminCMSContent from '@/components/admin/AdminCMSContent';
import AdminThemeSettings from '@/components/admin/AdminThemeSettings';
import AdminAnalytics from '@/components/admin/AdminAnalytics';
import AdminAuditLog from '@/components/admin/AdminAuditLog';
import AdminMarketplaceSettings from '@/components/admin/AdminMarketplaceSettings';
import AdminFeatureFlags from '@/components/admin/AdminFeatureFlags';

export default function AdminPanel() {
  const { user: authUser, isDemoMode, isLoadingAuth } = useAuth();
  const displayUser = authUser;
  const loading = !isDemoMode && isLoadingAuth;

  if (!isDemoMode && loading) return <PageLoader />;
  if (!displayUser) return <PageLoader />;

  const isAdmin = displayUser?.email?.toLowerCase() === 'derekbradley96@gmail.com';

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-20 h-20 bg-red-500/10 rounded-3xl flex items-center justify-center mb-6 mx-auto">
            <Shield className="w-10 h-10 text-red-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-3">Access Denied</h2>
          <p className="text-slate-400">You don't have permission to access this area.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 pb-24">
      <div className="p-4 md:p-6 border-b border-slate-800">
        <div className="flex items-center gap-3 mb-2">
          <Shield className="w-8 h-8 text-purple-400" />
          <h1 className="text-2xl font-bold text-white">Admin Control Panel</h1>
        </div>
        <p className="text-slate-400">Platform management & configuration</p>
      </div>

      <div className="p-4 md:p-6">
        <Tabs defaultValue="analytics" className="space-y-6">
          <TabsList className="bg-slate-800 border border-slate-700 flex-wrap h-auto">
            <TabsTrigger value="analytics" className="gap-2">
              <BarChart3 className="w-4 h-4" />
              Analytics
            </TabsTrigger>
            <TabsTrigger value="users" className="gap-2">
              <Users className="w-4 h-4" />
              Users
            </TabsTrigger>
            <TabsTrigger value="trainers" className="gap-2">
              <Users className="w-4 h-4" />
              Trainers
            </TabsTrigger>
            <TabsTrigger value="billing" className="gap-2">
              <DollarSign className="w-4 h-4" />
              Billing
            </TabsTrigger>
            <TabsTrigger value="content" className="gap-2">
              <FileText className="w-4 h-4" />
              Content
            </TabsTrigger>
            <TabsTrigger value="theme" className="gap-2">
              <Palette className="w-4 h-4" />
              Theme
            </TabsTrigger>
            <TabsTrigger value="marketplace" className="gap-2">
              <Store className="w-4 h-4" />
              Marketplace
            </TabsTrigger>
            <TabsTrigger value="features" className="gap-2">
              <ToggleLeft className="w-4 h-4" />
              Features
            </TabsTrigger>
            <TabsTrigger value="audit" className="gap-2">
              <History className="w-4 h-4" />
              Audit Log
            </TabsTrigger>
          </TabsList>

          <TabsContent value="analytics">
            <AdminAnalytics adminEmail={user.email} />
          </TabsContent>

          <TabsContent value="users">
            <AdminUsersSection adminEmail={user.email} />
          </TabsContent>

          <TabsContent value="trainers">
            <AdminTrainersSection adminEmail={user.email} />
          </TabsContent>

          <TabsContent value="billing">
            <AdminBillingSettings adminEmail={user.email} />
          </TabsContent>

          <TabsContent value="content">
            <AdminCMSContent adminEmail={user.email} />
          </TabsContent>

          <TabsContent value="theme">
            <AdminThemeSettings adminEmail={user.email} />
          </TabsContent>

          <TabsContent value="marketplace">
            <AdminMarketplaceSettings adminEmail={user.email} />
          </TabsContent>

          <TabsContent value="features">
            <AdminFeatureFlags adminEmail={user.email} />
          </TabsContent>

          <TabsContent value="audit">
            <AdminAuditLog adminEmail={user.email} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}