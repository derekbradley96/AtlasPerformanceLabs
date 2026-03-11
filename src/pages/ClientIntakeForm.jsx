import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { base44 } from '@/lib/emptyApi';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createPageUrl } from '@/utils';
import { PageLoader } from '@/components/ui/LoadingState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { CheckCircle2, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';

export default function ClientIntakeForm() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const templateId = searchParams.get('template');
  
  const [user, setUser] = useState(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState({});

  useEffect(() => {
    const loadUser = async () => {
      const u = await base44.auth.me();
      setUser(u);
    };
    loadUser();
  }, []);

  const { data: clientProfile } = useQuery({
    queryKey: ['client-profile', user?.id],
    queryFn: async () => {
      const profiles = await base44.entities.ClientProfile.filter({ user_id: user.id });
      return profiles[0] || null;
    },
    enabled: !!user?.id && user?.user_type === 'client'
  });

  const { data: template, isLoading } = useQuery({
    queryKey: ['intake-template', templateId],
    queryFn: () => base44.entities.IntakeFormTemplate.get(templateId),
    enabled: !!templateId
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      const formattedAnswers = template.questions.map(q => ({
        question_id: q.id,
        question_text: q.text,
        answer: answers[q.id] || ''
      }));

      await base44.entities.IntakeFormResponse.create({
        client_id: clientProfile.id,
        trainer_id: clientProfile.trainer_id,
        template_id: templateId,
        answers: formattedAnswers,
        submitted_at: new Date().toISOString()
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['intake-responses']);
      toast.success('Intake form submitted!');
      navigate(createPageUrl('Home'));
    }
  });

  if (!user || isLoading) return <PageLoader />;
  if (!template) return <div className="p-6 text-white">Form not found</div>;

  const questions = template.questions || [];
  const currentQuestion = questions[currentStep];
  const progress = ((currentStep + 1) / questions.length) * 100;

  const canContinue = () => {
    if (!currentQuestion) return true;
    if (!currentQuestion.required) return true;
    return answers[currentQuestion.id]?.trim();
  };

  const handleNext = () => {
    if (currentStep < questions.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      submitMutation.mutate();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        {/* Progress */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-xl font-bold text-white">{template.name}</h1>
            <span className="text-sm text-slate-400">{currentStep + 1} of {questions.length}</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Question */}
        {currentQuestion && (
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-8 mb-6">
            <h2 className="text-2xl font-semibold text-white mb-6">
              {currentQuestion.text}
              {currentQuestion.required && <span className="text-red-400 ml-1">*</span>}
            </h2>

            {currentQuestion.type === 'text' && (
              <Input
                value={answers[currentQuestion.id] || ''}
                onChange={(e) => setAnswers({ ...answers, [currentQuestion.id]: e.target.value })}
                placeholder="Your answer..."
                className="bg-slate-900 border-slate-700 text-lg"
                autoFocus
              />
            )}

            {currentQuestion.type === 'multiline' && (
              <Textarea
                value={answers[currentQuestion.id] || ''}
                onChange={(e) => setAnswers({ ...answers, [currentQuestion.id]: e.target.value })}
                placeholder="Your answer..."
                className="bg-slate-900 border-slate-700 text-lg"
                rows={6}
                autoFocus
              />
            )}

            {currentQuestion.type === 'number' && (
              <Input
                type="number"
                value={answers[currentQuestion.id] || ''}
                onChange={(e) => setAnswers({ ...answers, [currentQuestion.id]: e.target.value })}
                placeholder="Your answer..."
                className="bg-slate-900 border-slate-700 text-lg"
                autoFocus
              />
            )}

            {currentQuestion.type === 'choice' && (
              <Select
                value={answers[currentQuestion.id]}
                onValueChange={(value) => setAnswers({ ...answers, [currentQuestion.id]: value })}
              >
                <SelectTrigger className="bg-slate-900 border-slate-700 text-lg">
                  <SelectValue placeholder="Select an option" />
                </SelectTrigger>
                <SelectContent>
                  {currentQuestion.options?.map((option) => (
                    <SelectItem key={option} value={option}>{option}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        )}

        {/* Navigation */}
        <div className="flex gap-3">
          {currentStep > 0 && (
            <Button
              onClick={() => setCurrentStep(currentStep - 1)}
              variant="outline"
              className="border-slate-700"
            >
              <ChevronLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          )}
          <Button
            onClick={handleNext}
            disabled={!canContinue() || submitMutation.isPending}
            className="flex-1 bg-blue-500 hover:bg-blue-600"
          >
            {currentStep === questions.length - 1 ? (
              <>
                <CheckCircle2 className="w-4 h-4 mr-2" />
                {submitMutation.isPending ? 'Submitting...' : 'Submit'}
              </>
            ) : (
              <>
                Continue
                <ChevronRight className="w-4 h-4 ml-2" />
              </>
            )}
          </Button>
        </div>

        {/* Save for later */}
        <div className="text-center mt-4">
          <button
            onClick={() => navigate(createPageUrl('Home'))}
            className="text-sm text-slate-500 hover:text-slate-400"
          >
            Save and finish later
          </button>
        </div>
      </div>
    </div>
  );
}