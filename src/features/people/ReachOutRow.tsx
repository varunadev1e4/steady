import { Link } from 'react-router-dom';
import type { PersonRow } from '@/types/database';
import { Button } from '@/components/ui/Button';
import { overdueText } from './logic';

/** A person row with a one-tap "Log" button (the second tap is the contact type). */
export function ReachOutRow({ person, overdue, onLog }: { person: PersonRow; overdue: number; onLog: () => void }) {
  return (
    <li className="flex min-h-14 items-center gap-3 py-1.5">
      <Link to={`/people/${person.id}`} className="min-w-0 flex-1 hover:text-accent-ink">
        <span className="block truncate font-medium">{person.name}</span>
        <span className="text-sm text-muted">{overdueText(overdue)}</span>
      </Link>
      <Button size="sm" variant="secondary" onClick={onLog}>
        Log contact
      </Button>
    </li>
  );
}
