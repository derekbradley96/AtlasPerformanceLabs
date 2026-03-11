import React from 'react';
import { MessageSquare, CheckCircle2, Clock } from 'lucide-react';

export default function CoachFeedback({ hasTrainer, lastReview, programStatus }) {
  if (!hasTrainer) {
    return (
      <div className="bg-blue-500/10 border border-blue-500/30 rounded-2xl p-5">
        <div className="flex items-start gap-3">
          <MessageSquare className="w-5 h-5 text-blue-400 mt-0.5" />
          <div>
            <h3 className="text-sm font-semibold text-blue-400 mb-1">Ready for coaching?</h3>
            <p className="text-sm text-slate-300">Work with an expert trainer to maximize your results</p>
          </div>
        </div>
      </div>
    );
  }

  const getFeedbackMessage = () => {
    if (!lastReview || !lastReview.reviewed_at) {
      return {
        icon: Clock,
        color: 'text-blue-400',
        bgColor: 'bg-blue-500/10',
        borderColor: 'border-blue-500/30',
        title: 'Coach Review Pending',
        message: 'Your coach is reviewing your progress and will provide feedback soon'
      };
    }

    const reviewDate = new Date(lastReview.reviewed_at);
    const daysSinceReview = Math.floor((Date.now() - reviewDate.getTime()) / (1000 * 60 * 60 * 24));

    if (daysSinceReview <= 3) {
      return {
        icon: CheckCircle2,
        color: 'text-green-400',
        bgColor: 'bg-green-500/10',
        borderColor: 'border-green-500/30',
        title: 'Recent Coach Feedback',
        message: programStatus || 'Your program is working well. Keep up the consistency!'
      };
    }

    return {
      icon: MessageSquare,
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/10',
      borderColor: 'border-blue-500/30',
      title: 'Coach Monitoring',
      message: 'Your coach is tracking your performance and will reach out if adjustments are needed'
    };
  };

  const feedback = getFeedbackMessage();
  const Icon = feedback.icon;

  return (
    <div className={`${feedback.bgColor} border ${feedback.borderColor} rounded-2xl p-5`}>
      <div className="flex items-start gap-3">
        <Icon className={`w-5 h-5 ${feedback.color} mt-0.5`} />
        <div>
          <h3 className={`text-sm font-semibold ${feedback.color} mb-1`}>{feedback.title}</h3>
          <p className="text-sm text-slate-300">{feedback.message}</p>
        </div>
      </div>
    </div>
  );
}