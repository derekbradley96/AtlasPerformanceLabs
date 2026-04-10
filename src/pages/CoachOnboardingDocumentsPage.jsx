/**
 * Coach: manage documents shown to clients during onboarding (Contract, T&Cs, PAR-Q).
 * What you add here appears in the client's "Your details" step when they sign up with your code.
 */
import React, { useState, useEffect } from 'react';
import { getSupabase, hasSupabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { FileText, Loader2, Save, Plus } from 'lucide-react';
import { toast } from 'sonner';

const DOC_TYPES = [
  { value: 'contract', label: 'Contract' },
  { value: 'terms', label: 'Terms & Conditions' },
  { value: 'par_q', label: 'PAR-Q (Physical Activity Readiness)' },
];

export default function CoachOnboardingDocumentsPage() {
  const { user } = useAuth();
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ type: 'contract', title: '', content: '' });
  const [saving, setSaving] = useState(false);

  const coachId = user?.id;

  useEffect(() => {
    if (!coachId || !hasSupabase) return;
    const supabase = getSupabase();
    supabase
      .from('coach_documents')
      .select('id, type, title, content, sort_order')
      .eq('coach_id', coachId)
      .order('sort_order', { ascending: true })
      .then(({ data, error }) => {
        if (error) {
          console.error(error);
          setDocs([]);
        } else {
          setDocs(data || []);
        }
      })
      .finally(() => setLoading(false));
  }, [coachId]);

  const startNew = (type) => {
    setEditingId(null);
    setForm({
      type: type || 'contract',
      title: DOC_TYPES.find((t) => t.value === (type || 'contract'))?.label || '',
      content: '',
    });
  };

  const startEdit = (doc) => {
    setEditingId(doc.id);
    setForm({ type: doc.type, title: doc.title || '', content: doc.content || '' });
  };

  const save = async () => {
    if (!coachId || !hasSupabase) return;
    const title = (form.title || '').trim() || DOC_TYPES.find((t) => t.value === form.type)?.label || form.type;
    const content = (form.content || '').trim();
    setSaving(true);
    const supabase = getSupabase();
    try {
      if (editingId) {
        const { error } = await supabase
          .from('coach_documents')
          .update({ title, content, updated_at: new Date().toISOString() })
          .eq('id', editingId)
          .eq('coach_id', coachId);
        if (error) throw error;
        toast.success('Document updated');
        setDocs((prev) => prev.map((d) => (d.id === editingId ? { ...d, title, content } : d)));
      } else {
        const existingOfType = docs.find((d) => d.type === form.type);
        if (existingOfType) {
          const { error } = await supabase
            .from('coach_documents')
            .update({ title, content, updated_at: new Date().toISOString() })
            .eq('id', existingOfType.id)
            .eq('coach_id', coachId);
          if (error) throw error;
          toast.success('Document updated');
          setDocs((prev) => prev.map((d) => (d.id === existingOfType.id ? { ...d, title, content } : d)));
        } else {
          const { data, error } = await supabase
            .from('coach_documents')
            .insert({
              coach_id: coachId,
              type: form.type,
              title,
              content,
              sort_order: DOC_TYPES.findIndex((t) => t.value === form.type),
            })
            .select('id, type, title, content, sort_order')
            .single();
          if (error) throw error;
          toast.success('Document added');
          setDocs((prev) => [...prev, data].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)));
        }
      }
      setEditingId(null);
      setForm({ type: 'contract', title: '', content: '' });
    } catch (e) {
      toast.error(e?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (!hasSupabase) {
    return (
      <div className="p-4 text-slate-400">
        <p>Supabase is not configured.</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-4 pb-20">
      <div className="flex items-center gap-2 mb-2">
        <FileText className="w-5 h-5 text-slate-400" />
        <h1 className="text-xl font-bold text-white">Client onboarding documents</h1>
      </div>
      <p className="text-sm text-slate-400 mb-6">
        These documents are shown to new clients when they enter your coach code. They must read and accept each one before continuing.
      </p>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      ) : (
        <div className="space-y-4">
          {DOC_TYPES.map(({ value, label }) => {
            const doc = docs.find((d) => d.type === value);
            const isEditing = editingId === doc?.id || (!editingId && form.type === value);

            return (
              <div
                key={value}
                className="rounded-xl border border-slate-800 bg-slate-900/80 overflow-hidden"
              >
                <div className="p-4 flex items-center justify-between">
                  <span className="font-medium text-slate-200">{label}</span>
                  {doc && !isEditing ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-slate-400 hover:text-white"
                      onClick={() => startEdit(doc)}
                    >
                      Edit
                    </Button>
                  ) : !doc && !isEditing ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-blue-400 hover:text-blue-300"
                      onClick={() => startNew(value)}
                    >
                      <Plus className="w-4 h-4 mr-1" /> Add
                    </Button>
                  ) : null}
                </div>
                {isEditing && (
                  <div className="border-t border-slate-800 p-4 space-y-3">
                    <Input
                      value={form.type === value ? form.title : (doc?.title || '')}
                      onChange={(e) => form.type === value && setForm((f) => ({ ...f, title: e.target.value }))}
                      placeholder={`Title for ${label}`}
                      className="bg-slate-800 border-slate-700 text-white"
                    />
                    <Textarea
                      value={form.type === value ? form.content : (doc?.content || '')}
                      onChange={(e) => form.type === value && setForm((f) => ({ ...f, content: e.target.value }))}
                      placeholder={value === 'par_q' ? 'PAR-Q questions and text, or link to a form…' : `Paste or write your ${label.toLowerCase()} here.`}
                      rows={8}
                      className="bg-slate-800 border-slate-700 text-white resize-y"
                    />
                    <div className="flex gap-2">
                      <Button onClick={save} disabled={saving} className="bg-blue-500 hover:bg-blue-600">
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        {saving ? ' Saving…' : ' Save'}
                      </Button>
                      <Button
                        variant="outline"
                        className="border-slate-600 text-slate-400"
                        onClick={() => {
                          setEditingId(null);
                          setForm({ type: 'contract', title: '', content: '' });
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
                {doc && !isEditing && (
                  <div className="border-t border-slate-800 px-4 pb-4">
                    <p className="text-xs text-slate-500 mt-2 line-clamp-2">{doc.content?.slice(0, 120) || 'No content'}…</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
