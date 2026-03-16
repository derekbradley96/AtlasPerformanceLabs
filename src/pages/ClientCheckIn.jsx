import React, { useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { invokeSupabaseFunction } from '@/lib/supabaseApi';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createPageUrl } from '@/utils';
import { CheckCircle2, Upload, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { PageLoader } from '@/components/ui/LoadingState';
import { toast } from 'sonner';
import { trackCheckinSubmitted, trackProgressPhotoUploaded } from '@/services/engagementTracker';
import { notifyCoachCheckinSubmitted } from '@/services/notificationTriggers';

export default function ClientCheckIn() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    weight_kg: '',
    energy_level: '',
    mood_level: '',
    sleep_quality: '',
    notes: '',
    answers: [],
    photo_urls: []
  });

  const { data: clientProfile } = useQuery({
    queryKey: ['client-profile', user?.id],
    queryFn: async () => {
      const { data } = await invokeSupabaseFunction('client-profile-list', { user_id: user?.id });
      const list = Array.isArray(data) ? data : [];
      return list[0] || null;
    },
    enabled: !!user?.id
  });

  const { data: template } = useQuery({
    queryKey: ['client-template', clientProfile?.trainer_id],
    queryFn: async () => {
      const { data } = await invokeSupabaseFunction('checkin-template-list', {
        trainer_id: clientProfile?.trainer_id,
        is_active: true
      });
      const list = Array.isArray(data) ? data : (data ? [data] : []);
      return list[0] ?? null;
    },
    enabled: !!clientProfile?.trainer_id
  });

  const { data: pendingCheckin } = useQuery({
    queryKey: ['pending-checkin', clientProfile?.id],
    queryFn: async () => {
      const { data } = await invokeSupabaseFunction('checkin-list', {
        client_id: clientProfile?.id,
        status: 'pending'
      });
      const list = Array.isArray(data) ? data : [];
      return list[0] ?? null;
    },
    enabled: !!clientProfile?.id
  });

  const submitMutation = useMutation({
    mutationFn: async (data) => {
      if (pendingCheckin?.id) {
        const { data: updated } = await invokeSupabaseFunction('checkin-update', {
          id: pendingCheckin.id,
          ...data,
          status: 'submitted',
          submitted_at: new Date().toISOString()
        });
        return updated;
      }
      return null;
    },
    onSuccess: (_data, payload) => {
      queryClient.invalidateQueries(['pending-checkin']);
      if (clientProfile?.id) {
        const coachId = clientProfile.trainer_id ?? clientProfile.coach_id;
        trackCheckinSubmitted(clientProfile.id, coachId, { checkin_id: pendingCheckin?.id }).catch(() => {});
        if (coachId) {
          notifyCoachCheckinSubmitted(coachId, clientProfile.id, pendingCheckin?.id).catch(() => {});
        }
        if (payload?.photo_urls?.length) {
          trackProgressPhotoUploaded(clientProfile.id, coachId, { checkin_id: pendingCheckin?.id, photo_count: payload.photo_urls.length }).catch(() => {});
        }
      }
      toast.success('Check-in submitted!');
      navigate(createPageUrl('Home'));
    }
  });

  const handlePhotoUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setUploading(true);
    try {
      const urls = [];
      for (const file of files) {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        urls.push(file_url);
      }
      setFormData({
        ...formData,
        photo_urls: [...formData.photo_urls, ...urls]
      });
      toast.success('Photos uploaded!');
    } catch (error) {
      toast.error('Failed to upload photos');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const answers = template?.questions?.map(q => ({
      question_id: q.id,
      question_text: q.text,
      answer: formData.answers[q.id] || ''
    })) || [];

    await submitMutation.mutateAsync({
      weight_kg: parseFloat(formData.weight_kg) || null,
      energy_level: parseInt(formData.energy_level) || null,
      mood_level: parseInt(formData.mood_level) || null,
      sleep_quality: parseInt(formData.sleep_quality) || null,
      notes: formData.notes,
      answers,
      photo_urls: formData.photo_urls
    });
  };

  if (!user || !clientProfile) return <PageLoader />;

  if (!template) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4 md:p-6 flex items-center justify-center">
        <div className="text-center max-w-md">
          <Calendar className="w-16 h-16 text-slate-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">No Check-In Template</h2>
          <p className="text-slate-400 mb-6">Your trainer hasn't set up check-ins yet. They'll notify you when it's time.</p>
          <Button onClick={() => navigate(createPageUrl('Home'))}>
            Back to Home
          </Button>
        </div>
      </div>
    );
  }

  if (!pendingCheckin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4 md:p-6 flex items-center justify-center">
        <div className="text-center max-w-md">
          <CheckCircle2 className="w-16 h-16 text-green-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">You're All Caught Up</h2>
          <p className="text-slate-400 mb-6">No pending check-ins at the moment. Your next check-in will be available soon.</p>
          <Button onClick={() => navigate(createPageUrl('Home'))}>
            Back to Home
          </Button>
        </div>
      </div>
    );
  }

  const dueDate = new Date(pendingCheckin.due_date);
  const isOverdue = dueDate < new Date();

  // Calculate total steps: photos + weight + wellbeing + questions + notes
  const totalSteps = (template.include_photos ? 1 : 0) + 
                     (template.include_bodyweight ? 1 : 0) + 
                     ((template.include_energy || template.include_mood || template.include_sleep) ? 1 : 0) + 
                     (template.questions?.length > 0 ? 1 : 0) + 
                     1; // notes

  const progressPercent = (currentStep / totalSteps) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 pb-24">
      {/* Header - Minimal */}
      <div className="p-4 md:p-6 border-b border-slate-800">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Weekly Check-In</h1>
            <p className="text-xs text-slate-400">~2 minutes</p>
          </div>
          <span className="text-sm text-slate-400">Step {currentStep}/{totalSteps}</span>
        </div>
        <div className="w-full bg-slate-700 rounded-full h-1 overflow-hidden">
          <div 
            className="h-full bg-blue-500 transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      <form onSubmit={handleSubmit} className="p-4 md:p-6 space-y-6">
        {/* Step 1: Photos */}
        {template.include_photos && currentStep === 1 && (
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4">How are you looking?</h2>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handlePhotoUpload}
              className="hidden"
              id="photo-upload"
            />
            <label
              htmlFor="photo-upload"
              className="flex flex-col items-center justify-center gap-2 w-full py-8 border-2 border-dashed border-slate-700 rounded-xl cursor-pointer hover:bg-slate-900/50 transition-colors"
            >
              <Upload className="w-8 h-8 text-slate-400" />
              <span className="text-slate-400 font-medium">
                {uploading ? 'Uploading...' : 'Tap to add photos'}
              </span>
              <span className="text-xs text-slate-500">Front, side, back (optional)</span>
            </label>
            {formData.photo_urls.length > 0 && (
              <p className="text-sm text-green-400 mt-4">✓ {formData.photo_urls.length} photo{formData.photo_urls.length !== 1 ? 's' : ''} uploaded</p>
            )}
          </div>
        )}

        {/* Step 2: Weight */}
        {template.include_bodyweight && currentStep === (template.include_photos ? 2 : 1) && (
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4">What's the scale say?</h2>
            <Input
              type="text"
              inputMode="decimal"
              value={formData.weight_kg}
              onChange={(e) => {
                const val = e.target.value;
                if (/^\d*\.?\d*$/.test(val)) setFormData({ ...formData, weight_kg: val });
              }}
              placeholder="75.5"
              className="bg-slate-900/50 border-slate-700 text-lg py-6"
              autoFocus
            />
            <p className="text-xs text-slate-500 mt-2">kg</p>
          </div>
        )}

        {/* Step 3: Wellbeing */}
        {(template.include_energy || template.include_mood || template.include_sleep) && currentStep === (template.include_bodyweight ? (template.include_photos ? 3 : 2) : (template.include_photos ? 2 : 1)) && (
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6 space-y-6">
            <h2 className="text-lg font-semibold text-white">How did you feel this week?</h2>
            
            {template.include_energy && (
              <div>
                <label className="block text-sm text-slate-400 mb-3">Energy</label>
                <div className="flex gap-2">
                  {[1,2,3,4,5,6,7,8,9,10].map(n => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setFormData({ ...formData, energy_level: String(n) })}
                      className={`flex-1 py-2 rounded-lg font-medium transition-all ${
                        formData.energy_level === String(n)
                          ? 'bg-blue-500 text-white'
                          : 'bg-slate-900/50 text-slate-400 hover:bg-slate-900'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {template.include_mood && (
              <div>
                <label className="block text-sm text-slate-400 mb-3">Mood</label>
                <div className="flex gap-2">
                  {[1,2,3,4,5,6,7,8,9,10].map(n => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setFormData({ ...formData, mood_level: String(n) })}
                      className={`flex-1 py-2 rounded-lg font-medium transition-all ${
                        formData.mood_level === String(n)
                          ? 'bg-blue-500 text-white'
                          : 'bg-slate-900/50 text-slate-400 hover:bg-slate-900'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {template.include_sleep && (
              <div>
                <label className="block text-sm text-slate-400 mb-3">Sleep Quality</label>
                <div className="flex gap-2">
                  {[1,2,3,4,5,6,7,8,9,10].map(n => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setFormData({ ...formData, sleep_quality: String(n) })}
                      className={`flex-1 py-2 rounded-lg font-medium transition-all ${
                        formData.sleep_quality === String(n)
                          ? 'bg-blue-500 text-white'
                          : 'bg-slate-900/50 text-slate-400 hover:bg-slate-900'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 4: Questions */}
        {template.questions && template.questions.length > 0 && currentStep === (template.include_bodyweight || template.include_energy || template.include_mood || template.include_sleep ? (template.include_photos ? 4 : 3) : (template.include_photos ? 3 : 2)) && (
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6 space-y-4">
            {template.questions.map((q) => (
              <div key={q.id}>
                <label className="block text-sm font-medium text-white mb-3">
                  {q.text}
                </label>
                {q.type === 'text' && (
                  <Textarea
                    value={formData.answers[q.id] || ''}
                    onChange={(e) => setFormData({
                      ...formData,
                      answers: { ...formData.answers, [q.id]: e.target.value }
                    })}
                    placeholder="Your answer..."
                    className="bg-slate-900/50 border-slate-700 min-h-24"
                  />
                )}
                {(q.type === 'number' || q.type === 'scale') && (
                  <Input
                    type="text"
                    inputMode="numeric"
                    value={formData.answers[q.id] || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (/^\d*$/.test(val)) setFormData({
                        ...formData,
                        answers: { ...formData.answers, [q.id]: val }
                      });
                    }}
                    className="bg-slate-900/50 border-slate-700 py-3"
                  />
                )}
              </div>
            ))}
          </div>
        )}

        {/* Final Step: Notes */}
        {currentStep === totalSteps && (
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Anything else?</h2>
            <Textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Optional notes for your coach..."
              className="bg-slate-900/50 border-slate-700 min-h-32"
            />
            <p className="text-xs text-slate-500 mt-2">You're almost done!</p>
          </div>
        )}

        {/* Navigation */}
        <div className="flex gap-3">
          {currentStep > 1 && (
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => setCurrentStep(currentStep - 1)}
            >
              Back
            </Button>
          )}
          {currentStep < totalSteps ? (
            <Button
              type="button"
              className="flex-1 bg-blue-500 hover:bg-blue-600"
              onClick={() => setCurrentStep(currentStep + 1)}
            >
              Next
            </Button>
          ) : (
            <Button
              type="submit"
              disabled={submitMutation.isPending}
              className="flex-1 bg-green-500 hover:bg-green-600"
            >
              <CheckCircle2 className="w-5 h-5 mr-2" />
              {submitMutation.isPending ? 'Submitting...' : 'Submit'}
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}