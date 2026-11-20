import { lazy, Suspense, type ComponentType } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { RequireAuth, PublicOnly } from '@/features/auth/RouteGuards';
import { AppShell } from '@/components/layout/AppShell';
import { LoginPage } from '@/pages/auth/LoginPage';
import { SetupPage } from '@/pages/auth/SetupPage';
import { TodayPage } from '@/pages/TodayPage';
import { CardSkeleton } from '@/components/ui/States';

/** Code-splits a named page export so the first load stays small. */
function page<M extends Record<string, unknown>>(load: () => Promise<M>, name: keyof M) {
  const Lazy = lazy(async () => ({ default: (await load())[name] as ComponentType }));
  return (
    <Suspense fallback={<CardSkeleton lines={4} />}>
      <Lazy />
    </Suspense>
  );
}

const router = createBrowserRouter([
  {
    element: <PublicOnly />,
    children: [
      { path: '/login', element: <LoginPage /> },
      { path: '/setup', element: <SetupPage /> },
    ],
  },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppShell />,
        children: [
          { path: '/', element: <TodayPage /> },
          { path: '/checkin', element: page(() => import('@/pages/checkin/CheckInPage'), 'CheckInPage') },
          { path: '/checkin/history', element: page(() => import('@/pages/checkin/CheckInHistoryPage'), 'CheckInHistoryPage') },
          { path: '/habits', element: page(() => import('@/pages/habits/HabitsPage'), 'HabitsPage') },
          { path: '/habits/new', element: page(() => import('@/pages/habits/HabitFormPage'), 'HabitFormPage') },
          { path: '/habits/:id', element: page(() => import('@/pages/habits/HabitDetailPage'), 'HabitDetailPage') },
          { path: '/habits/:id/edit', element: page(() => import('@/pages/habits/HabitFormPage'), 'HabitFormPage') },
          { path: '/journal', element: page(() => import('@/pages/journal/JournalPage'), 'JournalPage') },
          { path: '/journal/write/:id?', element: page(() => import('@/pages/journal/JournalEntryPage'), 'JournalEntryPage') },
          { path: '/body', element: page(() => import('@/pages/body/BodyPage'), 'BodyPage') },
          { path: '/body/health', element: page(() => import('@/pages/body/HealthPage'), 'HealthPage') },
          { path: '/body/health/report', element: page(() => import('@/pages/body/HealthPage'), 'HealthReportPage') },
          { path: '/body/steps', element: page(() => import('@/pages/body/StepsPage'), 'StepsPage') },
          { path: '/body/photos', element: page(() => import('@/pages/body/PhotosPage'), 'PhotosPage') },
          { path: '/goals/weight', element: page(() => import('@/pages/goals/WeightGoalPage'), 'WeightGoalPage') },
          { path: '/meds', element: page(() => import('@/pages/medications/MedicationsPage'), 'MedicationsPage') },
          { path: '/meds/summary', element: page(() => import('@/pages/medications/MedicationsPage'), 'MedicationSummaryPage') },
          { path: '/goals', element: page(() => import('@/pages/goals/GoalsPage'), 'GoalsPage') },
          { path: '/mind', element: page(() => import('@/pages/mind/MindPages'), 'MindPage') },
          { path: '/mind/activities', element: page(() => import('@/pages/mind/MindPages'), 'ActivitiesPage') },
          { path: '/mind/check', element: page(() => import('@/pages/mind/MindPages'), 'CheckPage') },
          { path: '/mind/cravings', element: page(() => import('@/pages/mind/MindPages'), 'CravingsPage') },
          { path: '/sleep', element: page(() => import('@/pages/SleepPage'), 'SleepPage') },
          { path: '/report', element: page(() => import('@/pages/ReportPage'), 'ReportPage') },
          { path: '/breathe', element: page(() => import('@/pages/BreathePage'), 'BreathePage') },
          { path: '/review/month', element: page(() => import('@/pages/review/PeriodReviewPage'), 'MonthReviewPage') },
          { path: '/review/year', element: page(() => import('@/pages/review/PeriodReviewPage'), 'YearReviewPage') },
          { path: '/body/measurements', element: page(() => import('@/pages/body/MeasurementsPage'), 'MeasurementsPage') },
          { path: '/workouts', element: page(() => import('@/pages/workouts/WorkoutsPages'), 'WorkoutsHistoryPage') },
          { path: '/workouts/templates', element: page(() => import('@/pages/workouts/WorkoutsPages'), 'TemplatesPage') },
          { path: '/workouts/templates/:id', element: page(() => import('@/pages/workouts/WorkoutsPages'), 'TemplateEditPage') },
          { path: '/workouts/exercises', element: page(() => import('@/pages/workouts/WorkoutsPages'), 'ExercisesPage') },
          { path: '/workouts/progress', element: page(() => import('@/pages/workouts/WorkoutsPages'), 'ProgressPage') },
          { path: '/workouts/log/:id', element: page(() => import('@/pages/workouts/WorkoutLoggerPage'), 'WorkoutLoggerPage') },
          { path: '/plans', element: page(() => import('@/pages/plans/PlansPages'), 'PlansPage') },
          { path: '/plans/:planId', element: page(() => import('@/pages/plans/PlansPages'), 'PlanDetailPage') },
          { path: '/plans/:planId/session', element: page(() => import('@/pages/plans/PlansPages'), 'PlanSessionPage') },
          { path: '/food', element: page(() => import('@/pages/food/FoodPage'), 'FoodPage') },
          { path: '/food/library', element: page(() => import('@/pages/food/FoodLibraryPage'), 'FoodLibraryPage') },
          { path: '/people', element: page(() => import('@/pages/people/PeoplePages'), 'PeoplePage') },
          { path: '/people/new', element: page(() => import('@/pages/people/PeoplePages'), 'PersonFormPage') },
          { path: '/people/:id', element: page(() => import('@/pages/people/PeoplePages'), 'PersonPage') },
          { path: '/people/:id/edit', element: page(() => import('@/pages/people/PeoplePages'), 'PersonFormPage') },
          { path: '/tasks', element: page(() => import('@/pages/tasks/TasksPage'), 'TasksPage') },
          { path: '/notes', element: page(() => import('@/pages/notes/NotesPages'), 'NotesPage') },
          { path: '/notes/write/:id?', element: page(() => import('@/pages/notes/NotesPages'), 'NoteEditorPage') },
          { path: '/review', element: page(() => import('@/pages/review/ReviewPage'), 'ReviewPage') },
          { path: '/insights', element: page(() => import('@/pages/insights/InsightsPage'), 'InsightsPage') },
          { path: '/more', element: page(() => import('@/pages/MorePage'), 'MorePage') },
          { path: '/settings', element: page(() => import('@/pages/settings/SettingsPage'), 'SettingsPage') },
          { path: '*', element: page(() => import('@/pages/NotFoundPage'), 'NotFoundPage') },
        ],
      },
    ],
  },
]);

export function App() {
  return <RouterProvider router={router} />;
}
