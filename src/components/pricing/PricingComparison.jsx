import React from 'react';
import { Check, Zap, Crown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default function PricingComparison({ currentTier, onUpgrade }) {
  const tiers = [
    {
      id: 'basic',
      name: 'Basic',
      price: 'Free',
      platformFee: '10%',
      description: 'Perfect for getting started',
      features: [
        'Client management',
        'Messaging & check-ins',
        'Program delivery',
        'Training Intelligence Phase 1',
        'Client progress tracking',
        'Intake forms'
      ],
      color: 'from-slate-600 to-slate-700'
    },
    {
      id: 'pro',
      name: 'Pro',
      price: '£59/mo',
      platformFee: '3%',
      description: 'For serious coaches scaling their business',
      badge: 'Most Popular',
      features: [
        'Everything in Basic',
        'Reduced platform fee (3% vs 10%)',
        'Advanced analytics & insights',
        'Automation (reminders, nudges)',
        'Priority support',
        'White-label branding (soon)'
      ],
      color: 'from-blue-600 to-purple-600',
      highlight: true
    }
  ];

  const calculateSavings = (clients) => {
    const monthlyRevenue = clients * 200; // Assume £200/client
    const basicFee = monthlyRevenue * 0.10;
    const proFee = monthlyRevenue * 0.03 + 59;
    return Math.max(0, basicFee - proFee);
  };

  return (
    <div className="space-y-6">
      {/* Savings Calculator */}
      <div className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-500/30 rounded-2xl p-5">
        <h3 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
          <Zap className="w-5 h-5 text-green-400" />
          Pro Plan Savings
        </h3>
        <div className="grid grid-cols-3 gap-4 text-center">
          {[5, 10, 20].map(clients => (
            <div key={clients}>
              <p className="text-sm text-slate-400 mb-1">{clients} clients</p>
              <p className="text-2xl font-bold text-green-400">
                £{calculateSavings(clients).toFixed(0)}
              </p>
              <p className="text-xs text-slate-500">saved/mo</p>
            </div>
          ))}
        </div>
      </div>

      {/* Tier Cards */}
      <div className="grid md:grid-cols-2 gap-4">
        {tiers.map((tier) => (
          <div
            key={tier.id}
            className={`relative rounded-2xl border overflow-hidden ${
              tier.highlight 
                ? 'border-blue-500/50 bg-gradient-to-br from-blue-500/5 to-purple-500/5' 
                : 'border-slate-700/50 bg-slate-800/50'
            }`}
          >
            {tier.badge && (
              <div className="absolute top-4 right-4">
                <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
                  {tier.badge}
                </Badge>
              </div>
            )}

            <div className="p-6">
              <div className="flex items-center gap-3 mb-2">
                <div className={`w-10 h-10 bg-gradient-to-br ${tier.color} rounded-xl flex items-center justify-center`}>
                  {tier.highlight ? (
                    <Crown className="w-5 h-5 text-white" />
                  ) : (
                    <Check className="w-5 h-5 text-white" />
                  )}
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">{tier.name}</h3>
                  <p className="text-sm text-slate-400">{tier.description}</p>
                </div>
              </div>

              <div className="mb-4">
                <p className="text-3xl font-bold text-white mb-1">{tier.price}</p>
                <p className="text-sm text-slate-400">
                  + <span className="font-semibold text-orange-400">{tier.platformFee}</span> per client payment
                </p>
              </div>

              <div className="space-y-2 mb-6">
                {tier.features.map((feature, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-slate-300">{feature}</span>
                  </div>
                ))}
              </div>

              {tier.id === 'pro' && currentTier !== 'pro' && (
                <Button
                  onClick={onUpgrade}
                  className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                >
                  Upgrade to Pro
                </Button>
              )}

              {tier.id === 'basic' && currentTier === 'basic' && (
                <div className="text-center py-2">
                  <Badge className="bg-slate-700/50 text-slate-400">Current Plan</Badge>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Comparison Note */}
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
        <p className="text-sm text-slate-400 text-center">
          💡 <span className="font-medium text-white">Pro becomes profitable at 3+ clients</span> based on typical £200/month pricing
        </p>
      </div>
    </div>
  );
}