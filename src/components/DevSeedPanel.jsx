import React, { useState } from 'react';
import { base44 } from '@/lib/emptyApi';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { AlertCircle, UserPlus, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function DevSeedPanel({ user, profile }) {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);

  // Only show for specific dev email or if user email contains 'test'
  const isDev = user?.email?.includes('@test') || user?.email === 'dev@example.com';
  if (!isDev) return null;

  const findTestClient = async () => {
    const clients = await base44.entities.ClientProfile.filter({ trainer_id: profile.id });
    const allUsers = await base44.entities.User.list();
    const testUser = allUsers.find(u => u.email === 'john.doe@test.local');
    if (!testUser) return null;
    return clients.find(c => c.user_id === testUser.id);
  };

  const createTestClient = async () => {
    setLoading(true);
    try {
      // Check if test user already exists
      const allUsers = await base44.entities.User.list();
      let testUser = allUsers.find(u => u.email === 'john.doe@test.local');
      
      if (!testUser) {
        // Invite test user
        await base44.users.inviteUser('john.doe@test.local', 'user');
        toast.info('Invited john.doe@test.local - check your email to activate');
        
        // Wait a moment then refetch
        await new Promise(resolve => setTimeout(resolve, 2000));
        const updatedUsers = await base44.entities.User.list();
        testUser = updatedUsers.find(u => u.email === 'john.doe@test.local');
      }

      if (!testUser) {
        toast.error('Could not create test user. Try again.');
        return;
      }

      // Check if client profile exists
      const existingClient = await findTestClient();
      if (existingClient) {
        toast.info('John Doe already exists!');
        return;
      }

      // Create client profile
      await base44.entities.ClientProfile.create({
        user_id: testUser.id,
        trainer_id: profile.id,
        subscription_status: 'active',
        goals: 'Test client for dev purposes',
        notes: 'Dev seed data'
      });

      queryClient.invalidateQueries();
      toast.success('Test client created: John Doe');
    } catch (error) {
      toast.error('Failed: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const seedOverdueCheckIn = async () => {
    setLoading(true);
    try {
      const testClient = await findTestClient();
      if (!testClient) {
        toast.error('Create test client first');
        return;
      }

      const templates = await base44.entities.CheckInTemplate.filter({ 
        trainer_id: profile.id,
        is_active: true 
      });
      const template = templates[0];

      if (!template) {
        toast.error('Create a check-in template first');
        return;
      }

      const fiveDaysAgo = new Date();
      fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);

      await base44.entities.CheckIn.create({
        client_id: testClient.id,
        trainer_id: profile.id,
        template_id: template.id,
        due_date: fiveDaysAgo.toISOString().split('T')[0],
        status: 'pending'
      });

      queryClient.invalidateQueries();
      toast.success('Overdue check-in created');
    } catch (error) {
      toast.error('Failed: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const seedUnreadMessage = async () => {
    setLoading(true);
    try {
      const testClient = await findTestClient();
      if (!testClient) {
        toast.error('Create test client first');
        return;
      }

      const allUsers = await base44.entities.User.list();
      const testUser = allUsers.find(u => u.email === 'john.doe@test.local');

      await base44.entities.Message.create({
        sender_id: testUser.id,
        receiver_id: user.id,
        content: 'Hey coach, quick question about my program!',
        read: false,
        conversation_id: `conv_${testUser.id}_${user.id}`
      });

      queryClient.invalidateQueries();
      toast.success('Unread message created');
    } catch (error) {
      toast.error('Failed: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const seedOldWorkout = async () => {
    setLoading(true);
    try {
      const testClient = await findTestClient();
      if (!testClient) {
        toast.error('Create test client first');
        return;
      }

      const allUsers = await base44.entities.User.list();
      const testUser = allUsers.find(u => u.email === 'john.doe@test.local');

      const tenDaysAgo = new Date();
      tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);

      await base44.entities.Workout.create({
        user_id: testUser.id,
        name: 'Last workout (10 days ago)',
        status: 'completed',
        started_at: tenDaysAgo.toISOString(),
        completed_at: tenDaysAgo.toISOString(),
        duration_minutes: 45,
        total_sets: 12
      });

      queryClient.invalidateQueries();
      toast.success('Old workout created (10 days ago)');
    } catch (error) {
      toast.error('Failed: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const seedPaymentIssue = async () => {
    setLoading(true);
    try {
      const testClient = await findTestClient();
      if (!testClient) {
        toast.error('Create test client first');
        return;
      }

      await base44.entities.ClientProfile.update(testClient.id, {
        subscription_status: 'past_due'
      });

      queryClient.invalidateQueries();
      toast.success('Payment issue set (past_due)');
    } catch (error) {
      toast.error('Failed: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const seedNormalActivity = async () => {
    setLoading(true);
    try {
      const testClient = await findTestClient();
      if (!testClient) {
        toast.error('Create test client first');
        return;
      }

      const allUsers = await base44.entities.User.list();
      const testUser = allUsers.find(u => u.email === 'john.doe@test.local');

      // Recent workout
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      await base44.entities.Workout.create({
        user_id: testUser.id,
        name: 'Recent workout',
        status: 'completed',
        started_at: yesterday.toISOString(),
        completed_at: yesterday.toISOString(),
        duration_minutes: 60,
        total_sets: 15
      });

      // Fix payment status
      await base44.entities.ClientProfile.update(testClient.id, {
        subscription_status: 'active'
      });

      queryClient.invalidateQueries();
      toast.success('Normal activity seeded');
    } catch (error) {
      toast.error('Failed: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const deleteTestData = async () => {
    setLoading(true);
    try {
      const allUsers = await base44.entities.User.list();
      const testUser = allUsers.find(u => u.email === 'john.doe@test.local');
      
      if (!testUser) {
        toast.info('No test data found');
        return;
      }

      // Delete client profile
      const clients = await base44.entities.ClientProfile.filter({ 
        trainer_id: profile.id,
        user_id: testUser.id 
      });
      for (const client of clients) {
        await base44.entities.ClientProfile.delete(client.id);
      }

      // Delete check-ins
      const checkins = await base44.entities.CheckIn.filter({ trainer_id: profile.id });
      for (const checkin of checkins) {
        const clientMatch = clients.find(c => c.id === checkin.client_id);
        if (clientMatch) {
          await base44.entities.CheckIn.delete(checkin.id);
        }
      }

      // Delete messages
      const messages = await base44.entities.Message.filter({ sender_id: testUser.id });
      for (const msg of messages) {
        await base44.entities.Message.delete(msg.id);
      }

      // Delete workouts
      const workouts = await base44.entities.Workout.filter({ user_id: testUser.id });
      for (const workout of workouts) {
        await base44.entities.Workout.delete(workout.id);
      }

      queryClient.invalidateQueries();
      toast.success('Test data deleted');
    } catch (error) {
      toast.error('Failed: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-yellow-500/10 border-2 border-yellow-500/30 rounded-2xl p-4 md:p-6">
      <div className="flex items-center gap-2 mb-4">
        <AlertCircle className="w-5 h-5 text-yellow-400" />
        <h3 className="font-semibold text-yellow-400">Dev Seed Panel</h3>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
        <Button
          onClick={createTestClient}
          disabled={loading}
          size="sm"
          variant="outline"
          className="border-yellow-500/30 hover:bg-yellow-500/10"
        >
          {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <UserPlus className="w-4 h-4 mr-2" />}
          Create Test Client
        </Button>

        <Button
          onClick={seedOverdueCheckIn}
          disabled={loading}
          size="sm"
          variant="outline"
          className="border-yellow-500/30 hover:bg-yellow-500/10"
        >
          Overdue Check-in
        </Button>

        <Button
          onClick={seedUnreadMessage}
          disabled={loading}
          size="sm"
          variant="outline"
          className="border-yellow-500/30 hover:bg-yellow-500/10"
        >
          Unread Message
        </Button>

        <Button
          onClick={seedOldWorkout}
          disabled={loading}
          size="sm"
          variant="outline"
          className="border-yellow-500/30 hover:bg-yellow-500/10"
        >
          No Workout 7+ Days
        </Button>

        <Button
          onClick={seedPaymentIssue}
          disabled={loading}
          size="sm"
          variant="outline"
          className="border-yellow-500/30 hover:bg-yellow-500/10"
        >
          Payment Failed
        </Button>

        <Button
          onClick={seedNormalActivity}
          disabled={loading}
          size="sm"
          variant="outline"
          className="border-yellow-500/30 hover:bg-yellow-500/10"
        >
          Normal Activity
        </Button>
      </div>

      <Button
        onClick={deleteTestData}
        disabled={loading}
        size="sm"
        variant="destructive"
        className="w-full"
      >
        <Trash2 className="w-4 h-4 mr-2" />
        Delete All Test Data
      </Button>

      <p className="text-xs text-yellow-400/60 mt-3">
        Test client: john.doe@test.local
      </p>
    </div>
  );
}