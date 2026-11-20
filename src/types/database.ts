// Hand-maintained types matching supabase/migrations. Keep in sync when a
// migration changes a table. Rows must be `type` aliases, not interfaces, or
// supabase-js can't infer them.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type ModuleKey =
  | 'checkin'
  | 'habits'
  | 'journal'
  | 'workouts'
  | 'food'
  | 'people'
  | 'tasks'
  | 'notes'
  | 'review'
  | 'insights'
  | 'medications';

export type ThemePreference = 'light' | 'dark' | 'system';
export type Units = 'kg' | 'lb';
export type DateFormat = 'd MMM yyyy' | 'MMM d, yyyy' | 'yyyy-MM-dd' | 'dd/MM/yyyy' | 'MM/dd/yyyy';

type Timestamps = { created_at: string; updated_at: string };

export type ProfileRow = Timestamps & {
  user_id: string;
  display_name: string | null;
  time_zone: string;
  week_start: 0 | 1;
  units: Units;
  date_format: DateFormat;
  theme: ThemePreference;
  disabled_modules: ModuleKey[];
  protein_target_g: number | null;
  water_target_glasses: number | null;
  weekly_workout_target: number | null;
  calories_enabled: boolean;
  calorie_target: number | null;
  overload_increment: number;
  journal_lock_enabled: boolean;
  meal_tags: string[];
  glucose_unit: 'mg/dL' | 'mmol/L';
  steps_target: number | null;
  birthday: string | null;
  height_cm: number | null;
  sex: 'male' | 'female' | null;
  activity_level: 'sedentary' | 'light' | 'moderate' | 'active' | null;
};

export type CheckInRow = Timestamps & {
  id: string;
  user_id: string;
  day: string;
  mood: number | null;
  energy: number | null;
  stress: number | null;
  sleep_hours: number | null;
  sleep_quality: number | null;
  water_glasses: number;
  note: string | null;
  steps: number | null;
  bedtime: string | null;
  wake_time: string | null;
};

export type HabitFrequency = 'daily' | 'weekdays' | 'weekly';
export type HabitColor = 'sage' | 'clay' | 'amber' | 'sky' | 'plum' | 'stone';
export type TargetTime = 'any' | 'morning' | 'afternoon' | 'evening';

export type HabitRow = Timestamps & {
  id: string;
  user_id: string;
  name: string;
  icon: string;
  color: HabitColor;
  frequency: HabitFrequency;
  weekdays: number[];
  times_per_week: number | null;
  target_time: TargetTime;
  grace_enabled: boolean;
  start_date: string;
  sort_order: number;
  archived_at: string | null;
};

export type HabitCompletionRow = Timestamps & { id: string; user_id: string; habit_id: string; day: string };

export type EntryType = 'free' | 'gratitude' | 'evening' | 'brain_dump' | 'thought_record';

export type JournalEntryRow = Timestamps & {
  id: string;
  user_id: string;
  day: string;
  entry_type: EntryType;
  title: string | null;
  body: string;
  fields: Record<string, string>;
  prompt: string | null;
  mood: number | null;
  tags: string[];
  pinned: boolean;
  word_count: number;
};

export type ThoughtRecordRow = Timestamps & {
  id: string;
  user_id: string;
  entry_id: string;
  situation: string;
  automatic_thought: string;
  belief_before: number | null;
  evidence_for: string;
  evidence_against: string;
  balanced_thought: string;
  belief_after: number | null;
};

export type PromptCategory =
  | 'custom'
  | 'gratitude'
  | 'reflection'
  | 'goals'
  | 'relationships'
  | 'body'
  | 'worries'
  | 'wins'
  | 'tomorrow';

export type JournalPromptRow = Timestamps & { id: string; user_id: string; category: PromptCategory; text: string };

export type MuscleGroup = 'chest' | 'back' | 'shoulders' | 'biceps' | 'triceps' | 'legs' | 'glutes' | 'core' | 'full_body';
export type Equipment = 'barbell' | 'dumbbell' | 'machine' | 'cable' | 'bodyweight' | 'kettlebell' | 'band' | 'other';

export type ExerciseRow = Timestamps & {
  id: string;
  user_id: string;
  name: string;
  muscle_group: MuscleGroup;
  equipment: Equipment;
  is_custom: boolean;
  archived_at: string | null;
};

export type WorkoutTemplateRow = Timestamps & {
  id: string;
  user_id: string;
  name: string;
  notes: string | null;
  weekdays: number[];
  sort_order: number;
  archived_at: string | null;
};

export type TemplateExerciseRow = Timestamps & {
  id: string;
  user_id: string;
  template_id: string;
  exercise_id: string;
  position: number;
  target_sets: number;
  rep_min: number;
  rep_max: number;
};

export type WorkoutRow = Timestamps & {
  id: string;
  user_id: string;
  day: string;
  template_id: string | null;
  name: string;
  started_at: string;
  ended_at: string | null;
  notes: string | null;
};

export type WorkoutSetRow = Timestamps & {
  id: string;
  user_id: string;
  workout_id: string;
  exercise_id: string;
  exercise_position: number;
  set_number: number;
  weight_kg: number;
  reps: number;
  is_warmup: boolean;
  completed: boolean;
};

export type CardioRow = Timestamps & {
  id: string;
  user_id: string;
  day: string;
  activity: string;
  duration_min: number;
  distance_km: number | null;
  notes: string | null;
};

export type BodyMeasurementRow = Timestamps & {
  id: string;
  user_id: string;
  day: string;
  weight_kg: number | null;
  waist_cm: number | null;
  hips_cm: number | null;
  chest_cm: number | null;
  arm_cm: number | null;
  thigh_cm: number | null;
  body_fat_pct: number | null;
  notes: string | null;
};

export type FoodRow = Timestamps & {
  id: string;
  user_id: string;
  name: string;
  serving: string;
  protein_g: number | null;
  calories: number | null;
  carbs_g: number | null;
  is_favourite: boolean;
  is_starter: boolean;
  archived_at: string | null;
};

export type MealRow = Timestamps & {
  id: string;
  user_id: string;
  day: string;
  eaten_at: string;
  name: string;
  food_id: string | null;
  servings: number;
  protein_g: number | null;
  calories: number | null;
  carbs_g: number | null;
  tags: string[];
};

export type PersonRow = Timestamps & {
  id: string;
  user_id: string;
  name: string;
  relationship: string | null;
  birthday_month: number | null;
  birthday_day: number | null;
  birth_year: number | null;
  notes: string | null;
  contact_every_days: number | null;
  last_contacted_on: string | null;
  archived_at: string | null;
};

export type InteractionKind = 'call' | 'message' | 'in_person' | 'other';

export type InteractionRow = Timestamps & {
  id: string;
  user_id: string;
  person_id: string;
  day: string;
  kind: InteractionKind;
  note: string | null;
};

export type FollowUpRow = Timestamps & {
  id: string;
  user_id: string;
  person_id: string;
  text: string;
  done_at: string | null;
};

export type TaskPriority = 'low' | 'medium' | 'high';
export type TaskRepeat = 'none' | 'daily' | 'weekly' | 'monthly';

export type TaskRow = Timestamps & {
  id: string;
  user_id: string;
  title: string;
  notes: string | null;
  due_date: string | null;
  due_time: string | null;
  priority: TaskPriority;
  status: 'open' | 'done';
  done_at: string | null;
  repeat: TaskRepeat;
  tags: string[];
  spawned_task_id: string | null;
};

export type NoteRow = Timestamps & {
  id: string;
  user_id: string;
  title: string | null;
  body: string;
  tags: string[];
  pinned: boolean;
  archived: boolean;
};

export type TagRow = Timestamps & { id: string; user_id: string; name: string };

export type WeeklyReviewRow = Timestamps & {
  id: string;
  user_id: string;
  week_start: string;
  went_well: string;
  didnt_go_well: string;
  learned: string;
  next_focus: string;
};

export type WeekSummary = {
  check_in_days: number;
  mood_avg: number | null;
  energy_avg: number | null;
  stress_avg: number | null;
  sleep_avg: number | null;
  water_avg: number | null;
  steps_avg: number | null;
  steps_days: number;
  habit_completions: number;
  workouts: number;
  workout_minutes: number;
  cardio_sessions: number;
  cardio_minutes: number;
  protein_by_day: Array<{ day: string; protein: number }>;
  meals: number;
  journal_entries: number;
  journal_days: number;
  journal_words: number;
  people_contacted: number;
  in_person: number;
  tasks_completed: number;
  tasks_overdue: number;
};

export type PlanEnrollmentRow = Timestamps & {
  id: string;
  user_id: string;
  plan_id: 'walk-12' | 'home-strength-8' | 'gentle-yoga-8';
  start_date: string;
  weekdays: number[];
  template_id: string | null;
  ended_at: string | null;
};

export type HealthReadingRow = Timestamps & {
  id: string;
  user_id: string;
  day: string;
  taken_at: string;
  systolic: number | null;
  diastolic: number | null;
  resting_hr: number | null;
  glucose_mg_dl: number | null;
  glucose_context: 'fasting' | 'after_meal' | 'random' | null;
  note: string | null;
};

export type GoalRow = Timestamps & {
  id: string;
  user_id: string;
  title: string;
  kind: 'weekly_activity_minutes' | 'longest_walk' | 'weight' | 'workouts_per_week' | 'steps_daily_avg' | 'custom';
  target: number;
  start_value: number | null;
  current_value: number | null;
  unit: string | null;
  due_date: string | null;
  achieved_at: string | null;
  archived_at: string | null;
};

export type ProgressPhotoRow = Timestamps & {
  id: string;
  user_id: string;
  day: string;
  path: string;
  note: string | null;
};

export type MedicationRow = Timestamps & {
  id: string;
  user_id: string;
  name: string;
  dose: string | null;
  form: 'tablet' | 'capsule' | 'liquid' | 'injection' | 'other';
  purpose: string | null;
  instructions: string | null;
  schedule_times: string[];
  weekdays: number[];
  as_needed: boolean;
  start_date: string;
  end_date: string | null;
  pills_left: number | null;
  pills_per_dose: number;
  refill_at: number | null;
  archived_at: string | null;
};

export type MedicationDoseRow = Timestamps & {
  id: string;
  user_id: string;
  medication_id: string;
  day: string;
  scheduled_time: string | null;
  status: 'taken' | 'skipped';
  taken_at: string;
  note: string | null;
};

export type MedicationNoteRow = Timestamps & {
  id: string;
  user_id: string;
  medication_id: string | null;
  day: string;
  text: string;
};

export type ActivityRow = Timestamps & {
  id: string;
  user_id: string;
  day: string;
  title: string;
  category: 'pleasure' | 'achievement' | 'connection' | 'movement' | 'self_care' | 'other';
  planned_time: string | null;
  status: 'planned' | 'done' | 'skipped';
  mood_before: number | null;
  mood_after: number | null;
  note: string | null;
  completed_at: string | null;
};

export type AssessmentRow = Timestamps & {
  id: string;
  user_id: string;
  kind: 'phq9' | 'gad7';
  day: string;
  answers: number[];
  difficulty: number | null;
  score: number;
};

export type CravingRow = Timestamps & {
  id: string;
  user_id: string;
  day: string;
  logged_at: string;
  trigger: 'hungry' | 'stressed' | 'sad' | 'bored' | 'tired' | 'habit' | 'social' | 'other';
  intensity: number;
  food: string | null;
  waited_minutes: number | null;
  intensity_after: number | null;
  outcome: 'passed' | 'alternative' | 'ate_some' | 'ate_planned' | 'ate_more' | null;
  note: string | null;
};

export type LastSetRow = { exercise_id: string; set_number: number; weight_kg: number; reps: number; day: string };

/** Every column has a default except `Required`. */
type Table<Row, Required extends keyof Row = never> = {
  Row: Row;
  Insert: Partial<Row> & Pick<Row, Required>;
  Update: Partial<Row>;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      profiles: Table<ProfileRow>;
      check_ins: Table<CheckInRow, 'day'>;
      habits: Table<HabitRow, 'name'>;
      habit_completions: Table<HabitCompletionRow, 'habit_id' | 'day'>;
      journal_entries: Table<JournalEntryRow, 'day'>;
      thought_records: Table<ThoughtRecordRow, 'entry_id'>;
      journal_prompts: Table<JournalPromptRow, 'text'>;
      exercises: Table<ExerciseRow, 'name' | 'muscle_group'>;
      workout_templates: Table<WorkoutTemplateRow, 'name'>;
      template_exercises: Table<TemplateExerciseRow, 'template_id' | 'exercise_id'>;
      workouts: Table<WorkoutRow, 'day'>;
      workout_sets: Table<WorkoutSetRow, 'workout_id' | 'exercise_id' | 'set_number'>;
      cardio_entries: Table<CardioRow, 'day' | 'activity' | 'duration_min'>;
      body_measurements: Table<BodyMeasurementRow, 'day'>;
      foods: Table<FoodRow, 'name'>;
      meals: Table<MealRow, 'day' | 'name'>;
      people: Table<PersonRow, 'name'>;
      interactions: Table<InteractionRow, 'person_id' | 'day' | 'kind'>;
      follow_ups: Table<FollowUpRow, 'person_id' | 'text'>;
      tasks: Table<TaskRow, 'title'>;
      notes: Table<NoteRow>;
      tags: Table<TagRow, 'name'>;
      weekly_reviews: Table<WeeklyReviewRow, 'week_start'>;
      plan_enrollments: Table<PlanEnrollmentRow, 'plan_id' | 'start_date'>;
      health_readings: Table<HealthReadingRow, 'day'>;
      goals: Table<GoalRow, 'title' | 'kind' | 'target'>;
      progress_photos: Table<ProgressPhotoRow, 'day' | 'path'>;
      medications: Table<MedicationRow, 'name'>;
      medication_doses: Table<MedicationDoseRow, 'medication_id' | 'day' | 'status'>;
      medication_notes: Table<MedicationNoteRow, 'day' | 'text'>;
      activities: Table<ActivityRow, 'day' | 'title'>;
      assessments: Table<AssessmentRow, 'kind' | 'day' | 'answers'>;
      cravings: Table<CravingRow, 'day' | 'trigger' | 'intensity'>;
    };
    Views: { [_ in never]: never };
    Functions: {
      save_journal_entry: { Args: { p_entry: Json; p_thought?: Json | null }; Returns: JournalEntryRow };
      journal_stats: {
        Args: Record<string, never>;
        Returns: { total_entries: number; total_words: number; days: string[] };
      };
      save_workout: { Args: { p_workout: Json; p_sets: Json }; Returns: string };
      save_template: { Args: { p_template: Json; p_exercises: Json }; Returns: string };
      last_sets: { Args: { p_exercise_ids: string[]; p_exclude?: string | null }; Returns: LastSetRow[] };
      set_task_done: { Args: { p_task: string; p_done: boolean; p_today: string }; Returns: TaskRow };
      week_summary: {
        Args: { p_start: string; p_end: string; p_tz: string; p_today: string };
        Returns: WeekSummary;
      };
      import_backup: { Args: { p_data: Json }; Returns: Record<string, number> };
      delete_my_account: { Args: Record<string, never>; Returns: undefined };
      log_dose: {
        Args: { p_medication: string; p_day: string; p_time: string | null; p_status: 'taken' | 'skipped'; p_note?: string | null };
        Returns: MedicationDoseRow;
      };
      undo_dose: { Args: { p_dose: string }; Returns: undefined };
      start_plan: {
        Args: { p_plan: string; p_start: string; p_weekdays: number[]; p_template?: Json | null };
        Returns: string;
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
