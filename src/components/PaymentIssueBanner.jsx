import React from 'react';
import { AlertCircle, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export default function PaymentIssueBanner({ clientProfile }) {
  if (!clientProfile || clientProfile.subscription_status !== 'past_due') {
    return null;
  }

  const handleUpdatePayment = async () => {
    toast.error('Please contact your coach or support to update your payment method.');
  };

  return (
    <div className="bg-red-500/20 border border-red-500/30 rounded-2xl p-4 mb-4">
      <div className="flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-red-400 mt-0.5 shrink-0" />
        <div className="flex-1">
          <h3 className="font-semibold text-white mb-1">Payment Issue</h3>
          <p className="text-sm text-slate-300 mb-3">
            Your last payment failed. Please update your payment method to continue your coaching.
          </p>
          <Button
            onClick={handleUpdatePayment}
            size="sm"
            className="bg-red-500 hover:bg-red-600"
          >
            <CreditCard className="w-4 h-4 mr-2" />
            Update Payment Method
          </Button>
        </div>
      </div>
    </div>
  );
}