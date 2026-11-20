import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { assertOnline } from '@/lib/online';
import { useAuth } from '@/features/auth/authContext';
import type { ProfileRow } from '@/types/database';
import { browserTimeZone } from '@/utils/dates';

export const profileKey = (userId: string | undefined) => ['profile', userId] as const;

async function fetchProfile(): Promise<ProfileRow> {
  const { data, error } = await supabase.from('profiles').select('*').maybeSingle();
  if (error) throw error;
  if (data) return data;

  // The sign-up trigger normally creates the profile. If it is missing (for
  // example the user signed up before migrations ran), create it now.
  const { data: created, error: insertError } = await supabase
    .from('profiles')
    .insert({ time_zone: browserTimeZone() })
    .select('*')
    .single();
  if (insertError) throw insertError;
  return created;
}

export function useProfile() {
  const { user } = useAuth();
  return useQuery({
    queryKey: profileKey(user?.id),
    queryFn: fetchProfile,
    enabled: Boolean(user),
    staleTime: 5 * 60_000,
  });
}

/** For components rendered inside AppShell, which waits for the profile to load. */
export function useLoadedProfile(): ProfileRow {
  const { data } = useProfile();
  if (!data) throw new Error('useLoadedProfile used before the profile loaded');
  return data;
}

export type ProfileUpdate = Partial<Omit<ProfileRow, 'user_id' | 'created_at' | 'updated_at'>>;

export function useUpdateProfile() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (patch: ProfileUpdate) => {
      assertOnline();
      const { data, error } = await supabase
        .from('profiles')
        .update(patch)
        .eq('user_id', user!.id)
        .select('*')
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (profile) => {
      queryClient.setQueryData(profileKey(user?.id), profile);
    },
  });
}
