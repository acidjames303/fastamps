import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Calendar, Loader2, Mail, MessageSquare, RefreshCw, Save } from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { createPageUrl } from '@/lib/utils';

const EMPTY = {
  title: '',
  purpose: '',
  urgency: 'medium',
  complexity: 'moderate',
  decision_type: [],
  stakeholder_count: '3-5',
  stakeholder_groups: '',
  emotional_risk: 'low',
  change_impact: 'low',
  cross_team_dependencies: false,
  time_sensitivity: '',
  communication_style: 'detailed',
  additional_context: '',
};

const DECISION_OPTIONS = [
  { id: 'decide', label: 'Decide' },
  { id: 'align', label: 'Align' },
  { id: 'inform', label: 'Inform' },
  { id: 'update', label: 'Update' },
  { id: 'escalate', label: 'Escalate' },
  { id: 'unblock', label: 'Unblock' },
  { id: 'brainstorm', label: 'Brainstorm' },
];

const REC_META = {
  meeting: { icon: Calendar, label: 'Meeting Recommended', color: 'bg-blue-500' },
  email: { icon: Mail, label: 'Email Recommended', color: 'bg-emerald-500' },
  async_message: { icon: MessageSquare, label: 'Async Message Recommended', color: 'bg-violet-500' },
};

function Field({ label, children }) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      {children}
    </label>
  );
}

const inputClass =
  'w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100';

export default function NewDecision() {
  const navigate = useNavigate();
  const [step, setStep] = useState('input');
  const [form, setForm] = useState(EMPTY);
  const [intake, setIntake] = useState(null);
  const [decision, setDecision] = useState(null);
  const [busy, setBusy] = useState(false);

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const toggleType = (id) => {
    setForm((prev) => {
      const has = prev.decision_type.includes(id);
      return {
        ...prev,
        decision_type: has ? prev.decision_type.filter((t) => t !== id) : [...prev.decision_type, id],
      };
    });
  };

  const canSubmit =
    form.title.trim() && form.purpose.trim() && form.decision_type.length > 0 && form.urgency && form.complexity;

  const generate = async (payload) => {
    setBusy(true);
    setStep('processing');
    try {
      const result = await base44.functions.invoke('generate-recommendation', payload);
      const next = result?.decision || result?.data?.decision || result;
      if (!next?.recommendation) throw new Error(result?.error || 'No recommendation returned');
      setDecision(next);
      setStep('results');
    } catch (error) {
      console.error(error);
      toast.error(error?.message || 'Failed to generate recommendation');
      setStep('input');
    } finally {
      setBusy(false);
    }
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    if (!canSubmit) return;
    setIntake(form);
    await generate(form);
  };

  const onSave = async () => {
    if (!decision) return;
    setBusy(true);
    try {
      await base44.functions.invoke('save-decision', decision);
      toast.success('Decision saved to history');
      navigate(createPageUrl('History'));
    } catch (error) {
      console.error(error);
      toast.error(error?.message || 'Failed to save decision');
    } finally {
      setBusy(false);
    }
  };

  const meta = decision ? REC_META[decision.recommendation] || REC_META.meeting : null;
  const Icon = meta?.icon || Calendar;
  const draft =
    decision?.generated_agenda || decision?.generated_email || decision?.generated_message || '';

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <div className="container mx-auto max-w-3xl px-4 py-10">
        {step === 'input' && (
          <form onSubmit={onSubmit} className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Start a new cadence</h1>
              <p className="mt-2 text-slate-600">
                Answer a few questions and Cadence will recommend the best channel, then draft the message for you.
              </p>
            </div>

            <Card>
              <CardContent className="space-y-4 pt-6">
                <Field label="What is this about?">
                  <input className={inputClass} value={form.title} onChange={(e) => setField('title', e.target.value)} placeholder="Topic title" required />
                </Field>
                <Field label="Purpose">
                  <textarea className={inputClass} rows={3} value={form.purpose} onChange={(e) => setField('purpose', e.target.value)} placeholder="What do you need to accomplish?" required />
                </Field>
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Urgency">
                    <select className={inputClass} value={form.urgency} onChange={(e) => setField('urgency', e.target.value)}>
                      <option value="critical">Critical</option>
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                      <option value="none">None</option>
                    </select>
                  </Field>
                  <Field label="Complexity">
                    <select className={inputClass} value={form.complexity} onChange={(e) => setField('complexity', e.target.value)}>
                      <option value="highly_complex">Highly complex</option>
                      <option value="complex">Complex</option>
                      <option value="moderate">Moderate</option>
                      <option value="simple">Simple</option>
                    </select>
                  </Field>
                </div>
                <Field label="Decision type">
                  <div className="flex flex-wrap gap-2">
                    {DECISION_OPTIONS.map((opt) => {
                      const active = form.decision_type.includes(opt.id);
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => toggleType(opt.id)}
                          className={`rounded-full px-3 py-1 text-sm ${active ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'}`}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </Field>
                <div className="grid gap-4 md:grid-cols-3">
                  <Field label="Stakeholders">
                    <select className={inputClass} value={form.stakeholder_count} onChange={(e) => setField('stakeholder_count', e.target.value)}>
                      <option value="1-2">1-2</option>
                      <option value="3-5">3-5</option>
                      <option value="6-10">6-10</option>
                      <option value="10+">10+</option>
                    </select>
                  </Field>
                  <Field label="Emotional risk">
                    <select className={inputClass} value={form.emotional_risk} onChange={(e) => setField('emotional_risk', e.target.value)}>
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                    </select>
                  </Field>
                  <Field label="Change impact">
                    <select className={inputClass} value={form.change_impact} onChange={(e) => setField('change_impact', e.target.value)}>
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                    </select>
                  </Field>
                </div>
                <Field label="Communication style">
                  <select className={inputClass} value={form.communication_style} onChange={(e) => setField('communication_style', e.target.value)}>
                    <option value="detailed">Detailed</option>
                    <option value="concise">Concise</option>
                    <option value="warm">Warm</option>
                    <option value="direct">Direct</option>
                  </select>
                </Field>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={form.cross_team_dependencies}
                    onChange={(e) => setField('cross_team_dependencies', e.target.checked)}
                  />
                  Cross-team dependencies
                </label>
              </CardContent>
            </Card>

            <Button type="submit" size="lg" disabled={!canSubmit || busy} className="w-full bg-blue-600 hover:bg-blue-700">
              Get my recommendation
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </form>
        )}

        {step === 'processing' && (
          <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 text-slate-700">
            <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
            <p className="text-lg font-medium">Running decision engine...</p>
          </div>
        )}

        {step === 'results' && decision && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <Card>
              <CardContent className="space-y-4 pt-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className={`rounded-lg p-3 text-white ${meta.color}`}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-slate-900">{meta.label}</h2>
                      <p className="mt-1 max-w-2xl text-slate-600">{decision.rationale}</p>
                    </div>
                  </div>
                  <div className="rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-800">
                    {decision.confidence_score}% confidence
                  </div>
                </div>
                {decision.time_saved_minutes > 0 && (
                  <p className="text-sm text-emerald-700">
                    Estimated time saved vs an unnecessary meeting: about {decision.time_saved_minutes} minutes.
                  </p>
                )}
              </CardContent>
            </Card>

            {(decision.meeting_length || decision.meeting_cadence || decision.participants) && (
              <Card>
                <CardContent className="space-y-2 pt-6 text-sm text-slate-700">
                  {decision.meeting_length && <p><strong>Duration:</strong> {decision.meeting_length}</p>}
                  {decision.meeting_cadence && <p><strong>Cadence:</strong> {decision.meeting_cadence}</p>}
                  {decision.participants && <p><strong>Participants:</strong> {decision.participants}</p>}
                </CardContent>
              </Card>
            )}

            <Card>
              <CardContent className="pt-6">
                <h3 className="mb-3 text-lg font-semibold text-slate-900">Generated communication content</h3>
                <pre className="whitespace-pre-wrap rounded-lg bg-slate-50 p-4 text-sm text-slate-800">{draft}</pre>
              </CardContent>
            </Card>

            <div className="flex flex-wrap gap-3">
              <Button onClick={onSave} disabled={busy} className="bg-blue-600 hover:bg-blue-700">
                <Save className="mr-2 h-4 w-4" />
                Save to History
              </Button>
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => intake && generate(intake)}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Regenerate
              </Button>
              <Button variant="ghost" onClick={() => setStep('input')}>
                Edit inputs
              </Button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
