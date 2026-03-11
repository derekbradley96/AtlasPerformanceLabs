import { z } from 'zod';

export const invoiceStatusEnum = z.enum(['draft', 'pending', 'paid', 'overdue']);
export type InvoiceStatus = z.infer<typeof invoiceStatusEnum>;

export const paymentInvoiceSchema = z.object({
  id: z.string(),
  trainer_id: z.string(),
  client_id: z.string(),
  amount: z.number(),
  currency: z.string(),
  status: invoiceStatusEnum,
  due_date: z.string(),
  paid_at: z.string().nullable().optional(),
  stripe_payment_intent_id: z.string().nullable().optional(),
});
export type PaymentInvoice = z.infer<typeof paymentInvoiceSchema>;
