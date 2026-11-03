import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useInstaller } from '@/hooks/useInstaller';
import { Check, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';

const tracks = ['Product', 'Sales', 'Distribution'];
const blurb = {
  Product: 'Alpha7 installation, commissioning, load balancing, solar and fault finding.',
  Sales: 'Beat competitors, handle objections, win developer and commercial work.',
  Distribution: 'How wholesalers buy, how to open new stockists and win shelf space.',
};

export default function Academy() {
  const qc = useQueryClient();
  const { data } = useInstaller();
  const installer = data?.installer;
  const [track, setTrack] = useState('Product');
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState('');

  const { data: courses = [] } = useQuery({
    queryKey: ['courses'],
    queryFn: () => base44.entities.Course.list('order', 100),
  });
  const { data: progress = [] } = useQuery({
    queryKey: ['progress', installer?.mobile, data?.user?.email],
    enabled: !!installer,
    queryFn: async () => {
      const byEmail = data?.user?.email
        ? await base44.entities.CourseProgress.filter({ installer_email: data.user.email })
        : [];
      const byMobile = await base44.entities.CourseProgress.filter({ installer_mobile: installer.mobile });
      return [...new Map([...byEmail, ...byMobile].map((p) => [p.id, p])).values()];
    },
  });

  const done = new Set(progress.filter((p) => p.completed).map((p) => p.course_id));

  const complete = async (course) => {
    if (!installer) return;
    setBusy(course.id);
    setError('');
    try {
      const response = await base44.functions.invoke('complete-course', { course_id: course.id });
      if (response?.data?.error) throw new Error(response.data.error);
      await qc.invalidateQueries();
    } catch (err) {
      setError(err?.message || 'Could not mark this course complete. Please try again.');
    } finally {
      setBusy(null);
    }
  };

  const list = courses.filter((c) => c.academy === track);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">FastAmps Academy</h1>
        <p className="mt-2 text-muted-foreground">The old model trained installers to fit chargers. This one trains them to build businesses.</p>
        <p className="mt-2 text-sm text-muted-foreground/80">Completing a module updates your training progress only. Cash rewards for Academy are paused until FastAmps confirms the incentive structure.</p>
      </div>

      {error ? <div className="text-sm text-destructive">{error}</div> : null}

      <div className="flex flex-wrap gap-2">
        {tracks.map((t) => (
          <button key={t} onClick={() => setTrack(t)}
            className={`px-5 py-2.5 rounded-full text-sm border transition-colors ${track === t ? 'bg-primary text-white border-primary font-semibold' : 'border-border text-muted-foreground hover:text-foreground hover:bg-muted/60'}`}>
            {t} Academy
          </button>
        ))}
      </div>
      <p className="text-sm text-muted-foreground/80 -mt-4">{blurb[track]}</p>

      <div className="grid md:grid-cols-2 gap-4">
        {list.map((c) => {
          const isDone = done.has(c.id);
          return (
            <div key={c.id} className="rounded-2xl border border-border bg-muted/60 p-5">
              <div className="flex items-start justify-between gap-4">
                <h3 className="font-semibold tracking-tight">{c.title}</h3>
                <span className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground/80 shrink-0">{c.level}</span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{c.summary}</p>
              <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground/80">
                <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{c.duration_minutes} min</span>
              </div>
              <div className="mt-5">
                {isDone ? (
                  <div className="flex items-center gap-2 text-sm text-accent"><Check className="w-4 h-4" /> Completed</div>
                ) : (
                  <Button disabled={busy === c.id} onClick={() => complete(c)} variant="outline"
                    className="w-full border-border bg-transparent hover:bg-muted text-foreground">
                    Mark as complete
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {list.length === 0 && <div className="text-sm text-muted-foreground">No modules published in this track yet.</div>}
    </div>
  );
}
