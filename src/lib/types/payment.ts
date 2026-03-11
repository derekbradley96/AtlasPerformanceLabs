/**
 * Payment / invoice model – aligns with payments or earnings mock.
 */
export interface Payment {
  id?: string;
  client_id?: string | null;
  trainer_id?: string | null;
  status: 'paid' | 'pending' | 'overdue';
  due_date?: string | null;
  paid_at?: string | null;
  amount?: number | null;
}
