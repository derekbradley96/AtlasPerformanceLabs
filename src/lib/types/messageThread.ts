/**
 * Message thread model – aligns with Supabase message_threads / mock threads.
 */
export interface MessageThread {
  id: string;
  client_id: string;
  trainer_id?: string | null;
  last_message_at?: string | null;
  last_message_preview?: string | null;
  unread_count: number;
}
