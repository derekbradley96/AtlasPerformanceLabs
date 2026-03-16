import React, { useState } from 'react';
import { PageLoader } from '@/components/ui/LoadingState';
import { useAuth } from '@/lib/AuthContext';
import { ArrowLeft, Mail, Book, MessageSquare, ExternalLink, ChevronDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function HelpSupport() {
  const navigate = useNavigate();
  const { user: authUser, isDemoMode, isLoadingAuth } = useAuth();
  const [expandedFaq, setExpandedFaq] = useState(null);
  const displayUser = authUser;

  const loading = !isDemoMode && isLoadingAuth;

  const helpLinks = [
    {
      title: 'Getting Started Guide',
      description: 'Learn the basics of using Atlas Performance Labs',
      icon: Book,
      action: () => window.open('https://help.motion.app/getting-started', '_blank')
    },
    {
      title: 'Contact Support',
      description: 'Reach out to our support team',
      icon: Mail,
      action: () => window.open('mailto:support@motion.app')
    },
    {
      title: 'Community Forum',
      description: 'Join our community and get tips',
      icon: MessageSquare,
      action: () => window.open('https://community.motion.app', '_blank')
    }
  ];

  const clientFaqs = [
    {
      q: 'How do I find and connect with a trainer?',
      a: 'Visit the Coaches section, browse available trainers, and click Connect. You may need an invite code from your trainer.'
    },
    {
      q: 'How does the payment system work?',
      a: 'Once you connect with a trainer, you\'ll be charged monthly for their coaching service. Payments are secure and handled through Stripe.'
    },
    {
      q: 'How do I cancel my subscription?',
      a: 'You can cancel anytime from Profile > Subscription. Access continues until the end of your current billing period.'
    },
    {
      q: 'What if I need to change trainers?',
      a: 'Cancel your current subscription and connect with a new trainer. There\'s no lock-in period.'
    },
    {
      q: 'Can I log workouts offline?',
      a: 'Yes! Changes sync automatically when you reconnect to the internet.'
    },
    {
      q: 'How is my data kept private?',
      a: 'We collect workout data and check-ins only for your fitness journey. See our Privacy Policy for full details.'
    }
  ];

  const trainerFaqs = [
    {
      q: 'How do I share my invite code with clients?',
      a: 'Your unique invite code is on your Profile page. Share it with potential clients so they can connect with you during onboarding.'
    },
    {
      q: 'How do I get paid?',
      a: 'Connect your Stripe account in Settings. Monthly subscriptions from clients are deposited to your account, minus the 20% Atlas Performance Labs platform fee.'
    },
    {
      q: 'What\'s the platform fee?',
      a: 'Atlas Performance Labs takes a 20% fee from each client\'s subscription. You receive 80% of the monthly rate you set.'
    },
    {
      q: 'Can I pause accepting new clients?',
      a: 'Yes. Go to Edit Profile > Coaching & Service Setup and toggle "Accepting New Clients" to off.'
    },
    {
      q: 'How do I set my pricing?',
      a: 'Edit your profile and set your monthly rate in the Coaching & Service Setup section. Clients are billed this amount each month.'
    },
    {
      q: 'What if a client cancels?',
      a: 'You\'ll be notified immediately. Access to that client\'s data continues for 30 days, then is archived.'
    }
  ];

  const faqs = (displayUser?.user_type === 'coach' || displayUser?.user_type === 'trainer') ? trainerFaqs : clientFaqs;

  if (!isDemoMode && loading) return <PageLoader />;
  if (!displayUser) return <PageLoader />;

  return (
    <div className="min-h-screen bg-gradient-to-br from-atlas-surfaceAlt via-atlas-primary to-atlas-surfaceAlt pb-24 p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button 
          onClick={() => navigate(createPageUrl('Profile'))}
          className="p-2 hover:bg-atlas-surface rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-slate-400" />
        </button>
        <h1 className="text-2xl font-bold text-white">Help & Support</h1>
      </div>

      {/* Quick Links */}
      <div className="max-w-md mx-auto space-y-4 mb-8">
        {helpLinks.map((link) => {
          const Icon = link.icon;
          return (
            <button
              key={link.title}
              onClick={link.action}
              className="w-full text-left p-4 bg-atlas-surface/50 border border-atlas-border/50 rounded-2xl hover:bg-atlas-surface/70 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                    <Icon className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <p className="font-medium text-white">{link.title}</p>
                    <p className="text-xs text-slate-500">{link.description}</p>
                  </div>
                </div>
                <ExternalLink className="w-4 h-4 text-slate-500" />
              </div>
            </button>
          );
        })}
      </div>

      {/* FAQ Section */}
      <div className="max-w-md mx-auto mb-8">
        <h2 className="text-lg font-semibold text-white mb-4">Frequently Asked Questions</h2>
        <div className="space-y-2">
          {faqs.map((item, i) => (
            <button
              key={i}
              onClick={() => setExpandedFaq(expandedFaq === i ? null : i)}
              className="w-full text-left bg-atlas-surface/50 border border-atlas-border/50 rounded-xl p-4 hover:bg-atlas-surface/70 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="font-medium text-white text-sm">{item.q}</p>
                <ChevronDown 
                  className={`w-4 h-4 text-slate-500 shrink-0 transition-transform ${
                    expandedFaq === i ? 'rotate-180' : ''
                  }`}
                />
              </div>
              {expandedFaq === i && (
                <p className="text-xs text-slate-400 mt-3">{item.a}</p>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Legal Links */}
      <div className="max-w-md mx-auto mb-8">
        <h3 className="text-sm font-semibold text-slate-300 mb-3">Legal</h3>
        <div className="flex gap-3 text-xs">
          <a href="/privacy" className="text-blue-400 hover:text-blue-300">Privacy Policy</a>
          <span className="text-slate-600">•</span>
          <a href="/terms" className="text-blue-400 hover:text-blue-300">Terms of Service</a>
        </div>
      </div>

      {/* Version Info */}
      <div className="max-w-md mx-auto text-center">
        <p className="text-xs text-slate-600">Atlas Performance Labs v1.0.0</p>
      </div>
    </div>
  );
}