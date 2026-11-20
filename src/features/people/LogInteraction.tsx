import { useState } from 'react';
import { MessageCircle, Phone, Users } from 'lucide-react';
import type { PersonRow } from '@/types/database';
import { Sheet } from '@/components/ui/Sheet';
import { TextField } from '@/components/ui/Field';
import { FormMessage } from '@/components/ui/States';
import { useToast } from '@/components/ui/feedbackContext';
import { useToday } from '@/features/profile/useToday';
import { errorMessage } from '@/utils/errors';
import { useLogInteraction } from './queries';
import { KIND_LABEL } from './logic';

const KINDS = [
  { kind: 'call' as const, icon: Phone },
  { kind: 'message' as const, icon: MessageCircle },
  { kind: 'in_person' as const, icon: Users },
];

/** Second tap logs it: pick call, message or met in person (note optional). */
export function LogInteractionSheet({ person, onClose }: { person: PersonRow | null; onClose: () => void }) {
  const { today } = useToday();
  const log = useLogInteraction();
  const toast = useToast();
  const [note, setNote] = useState('');

  return (
    <Sheet open={person != null} onClose={onClose} title={person ? `Log contact with ${person.name}` : ''}>
      {person && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            {KINDS.map(({ kind, icon: Icon }) => (
              <button
                key={kind}
                type="button"
                disabled={log.isPending}
                onClick={() =>
                  log.mutate(
                    { person_id: person.id, kind, day: today, note: note.trim() || null },
                    {
                      onSuccess: () => {
                        toast(`Logged: ${KIND_LABEL[kind].toLowerCase()} with ${person.name}`);
                        setNote('');
                        onClose();
                      },
                    },
                  )
                }
                className="flex min-h-20 flex-col items-center justify-center gap-1.5 rounded-input border border-border bg-surface font-medium transition-colors hover:border-accent hover:bg-accent-soft disabled:opacity-60"
              >
                <Icon className="h-6 w-6 text-accent-ink" aria-hidden />
                {KIND_LABEL[kind]}
              </button>
            ))}
          </div>
          <TextField label="Note (optional, add before tapping)" value={note} maxLength={1000} onChange={(e) => setNote(e.target.value)} />
          {log.isError && <FormMessage tone="error">{errorMessage(log.error)}</FormMessage>}
        </div>
      )}
    </Sheet>
  );
}
