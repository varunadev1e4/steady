import { useRef, useState } from 'react';
import { Camera, Columns2, ImageOff, Lock, Trash2, X } from 'lucide-react';
import { useDeletePhoto, usePhotos, useUploadPhoto } from '@/features/photos/queries';
import { useUser } from '@/features/auth/authContext';
import { useToday } from '@/features/profile/useToday';
import { useLoadedProfile } from '@/features/profile/queries';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/Field';
import { IconButton } from '@/components/ui/Layout';
import { Sheet } from '@/components/ui/Sheet';
import { CardSkeleton, EmptyState, ErrorState, FormMessage } from '@/components/ui/States';
import { useConfirm, useToast } from '@/components/ui/feedbackContext';
import { formatISODate } from '@/utils/dates';
import { errorMessage } from '@/utils/errors';
import { cn } from '@/utils/cn';

type Photo = NonNullable<ReturnType<typeof usePhotos>['data']>[number];

export function PhotosPage() {
  const user = useUser();
  const { today } = useToday();
  const profile = useLoadedProfile();
  const photos = usePhotos();
  const upload = useUploadPhoto();
  const del = useDeletePhoto();
  const confirm = useConfirm();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<File | null>(null);
  const [day, setDay] = useState(today);
  const [note, setNote] = useState('');
  const [compare, setCompare] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [viewing, setViewing] = useState<Photo | null>(null);

  const list = photos.data ?? [];
  const chosen = picked.map((id) => list.find((p) => p.id === id)).filter((p): p is Photo => Boolean(p)).sort((a, b) => a.day.localeCompare(b.day));

  const togglePick = (id: string) =>
    setPicked((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : cur.length >= 2 ? [cur[1], id] : [...cur, id]));

  return (
    <>
      <PageHeader
        title="Progress photos"
        description="Private to you. Compare how things change over weeks and months."
        actions={
          list.length >= 2 ? (
            <Button
              size="sm"
              variant={compare ? 'primary' : 'secondary'}
              onClick={() => {
                setCompare((c) => !c);
                setPicked([]);
              }}
            >
              <Columns2 className="h-4 w-4" aria-hidden />
              {compare ? 'Done' : 'Compare'}
            </Button>
          ) : undefined
        }
      />
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="sr-only"
        aria-label="Choose a photo"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) {
            setPending(f);
            setDay(today);
            setNote('');
          }
        }}
      />
      <div className="space-y-4">
        <div className="flex items-start gap-2 rounded-card bg-panel px-4 py-3 text-sm text-muted">
          <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p>
            Photos go to a private storage folder only you can open. Before upload they're resized on your phone, which also removes hidden
            details like location. Tip: same spot, same light, same clothes each time makes comparisons easier.
          </p>
        </div>
        {!compare && (
          <Button block onClick={() => fileRef.current?.click()}>
            <Camera className="h-5 w-5" aria-hidden />
            Add a photo
          </Button>
        )}

        {compare && (
          <section className="card space-y-3" aria-label="Comparison">
            <p className="text-sm text-muted">{chosen.length < 2 ? `Tap ${2 - chosen.length} photo${chosen.length ? '' : 's'} below to compare.` : 'Earlier on the left, later on the right.'}</p>
            {chosen.length === 2 && (
              <div className="grid grid-cols-2 gap-2">
                {chosen.map((p) => (
                  <figure key={p.id}>
                    {p.url ? <img src={p.url} alt={`Progress photo from ${formatISODate(p.day, 'd MMM yyyy')}`} className="aspect-[3/4] w-full rounded-input object-cover" /> : null}
                    <figcaption className="mt-1 text-center text-sm">{formatISODate(p.day, profile.date_format)}</figcaption>
                  </figure>
                ))}
              </div>
            )}
          </section>
        )}

        {photos.isPending ? (
          <CardSkeleton />
        ) : photos.isError ? (
          <ErrorState error={photos.error} onRetry={() => void photos.refetch()} />
        ) : list.length === 0 ? (
          <EmptyState icon={Camera} title="No photos yet">
            One photo every 2–4 weeks is plenty. Changes are often easier to see than to weigh.
          </EmptyState>
        ) : (
          <ul className="grid grid-cols-3 gap-2">
            {list.map((p) => {
              const sel = picked.includes(p.id);
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => (compare ? togglePick(p.id) : setViewing(p))}
                    aria-pressed={compare ? sel : undefined}
                    aria-label={`Photo from ${formatISODate(p.day, 'd MMM yyyy')}${compare ? (sel ? ', selected' : '') : ''}`}
                    className={cn('relative block w-full overflow-hidden rounded-input', compare && sel && 'ring-4 ring-accent')}
                  >
                    {p.url ? (
                      <img src={p.url} alt="" loading="lazy" className="aspect-[3/4] w-full object-cover" />
                    ) : (
                      <span className="flex aspect-[3/4] w-full items-center justify-center bg-panel text-muted">
                        <ImageOff className="h-6 w-6" aria-hidden />
                      </span>
                    )}
                    <span className="absolute inset-x-0 bottom-0 bg-black/45 px-1.5 py-0.5 text-xs text-white">{formatISODate(p.day, 'd MMM yy')}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <Sheet open={pending != null} onClose={() => setPending(null)} title="Save photo">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!pending) return;
            upload.mutate(
              { file: pending, day, note: note.trim() || null, userId: user.id },
              {
                onSuccess: () => {
                  toast('Photo saved');
                  setPending(null);
                },
              },
            );
          }}
        >
          <p className="text-sm text-muted">{pending?.name}</p>
          <TextField label="Date" type="date" max={today} value={day} onChange={(e) => e.target.value && setDay(e.target.value)} />
          <TextField label="Note (optional)" maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. front, morning" />
          {upload.isError && <FormMessage tone="error">{errorMessage(upload.error)}</FormMessage>}
          <Button type="submit" loading={upload.isPending}>
            Upload
          </Button>
        </form>
      </Sheet>

      <Sheet open={viewing != null} onClose={() => setViewing(null)} title={viewing ? formatISODate(viewing.day, profile.date_format) : ''} description={viewing?.note ?? undefined}>
        {viewing && (
          <div className="space-y-3">
            {viewing.url && <img src={viewing.url} alt={`Progress photo from ${formatISODate(viewing.day, 'd MMM yyyy')}`} className="max-h-[60dvh] w-full rounded-input object-contain" />}
            <div className="flex justify-between">
              <Button
                variant="ghost"
                className="text-danger"
                loading={del.isPending}
                onClick={async () => {
                  if (!(await confirm({ title: 'Delete this photo?', body: 'It will be removed permanently.', confirmLabel: 'Delete photo', danger: true }))) return;
                  del.mutate(viewing, {
                    onSuccess: () => {
                      toast('Photo deleted');
                      setViewing(null);
                    },
                    onError: (e) => toast(errorMessage(e), 'error'),
                  });
                }}
              >
                <Trash2 className="h-4 w-4" aria-hidden />
                Delete
              </Button>
              <IconButton label="Close" onClick={() => setViewing(null)}>
                <X className="h-5 w-5" />
              </IconButton>
            </div>
          </div>
        )}
      </Sheet>
    </>
  );
}
