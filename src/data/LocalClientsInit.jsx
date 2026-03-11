/**
 * Optional boot-time touch of local client store so first read is warm.
 * Renders nothing. Clients come from clientsService (local-first + optional Supabase).
 */
import { useEffect } from 'react';
import { loadClients } from '@/data/localClientsStore';

export default function LocalClientsInit() {
  useEffect(() => {
    try {
      loadClients();
    } catch (_) {}
  }, []);
  return null;
}
