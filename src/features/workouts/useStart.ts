import { useNavigate } from 'react-router-dom';
import { useToday } from '@/features/profile/useToday';
import { useToast } from '@/components/ui/feedbackContext';
import type { WorkoutTemplateRow } from '@/types/database';
import { errorMessage } from '@/utils/errors';
import { useStartWorkout } from './queries';

/** Starts a workout (from a template or empty) and opens the logger. */
export function useStart() {
  const { today } = useToday();
  const start = useStartWorkout();
  const navigate = useNavigate();
  const toast = useToast();
  return {
    pending: start.isPending,
    start: (template: WorkoutTemplateRow | null) =>
      start.mutate(
        { day: today, template_id: template?.id ?? null, name: template?.name ?? 'Workout' },
        { onSuccess: (id) => navigate(`/workouts/log/${id}`), onError: (e) => toast(errorMessage(e), 'error') },
      ),
  };
}
