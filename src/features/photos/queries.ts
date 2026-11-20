import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { unwrap } from '@/lib/supabase/unwrap';
import { assertOnline } from '@/lib/online';
import type { ProgressPhotoRow } from '@/types/database';
import type { ISODate } from '@/utils/dates';
import { prepareImage } from './image';

export const BUCKET = 'progress-photos';
export const photoKeys = { all: ['progress_photos'] as const };

/** Photo rows plus short-lived signed URLs (the bucket is private). */
export function usePhotos() {
  return useQuery({
    queryKey: photoKeys.all,
    queryFn: async () => {
      const rows = unwrap(await supabase.from('progress_photos').select('*').order('day', { ascending: false }).order('created_at', { ascending: false })) as ProgressPhotoRow[];
      if (rows.length === 0) return [];
      const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(rows.map((r) => r.path), 60 * 60);
      if (error) throw error;
      const urls = new Map((data ?? []).map((d) => [d.path, d.signedUrl]));
      return rows.map((r) => ({ ...r, url: urls.get(r.path) ?? null }));
    },
    staleTime: 30 * 60_000, // signed URLs last an hour
  });
}

export function useUploadPhoto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ file, day, note, userId }: { file: File; day: ISODate; note: string | null; userId: string }) => {
      assertOnline();
      const blob = await prepareImage(file);
      const path = `${userId}/${crypto.randomUUID()}.jpg`;
      const up = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: 'image/jpeg', upsert: false });
      if (up.error) throw up.error;
      const res = await supabase.from('progress_photos').insert({ day, path, note }).select('*').single();
      if (res.error) {
        await supabase.storage.from(BUCKET).remove([path]); // don't leave an orphaned file
        throw res.error;
      }
      return res.data;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: photoKeys.all }),
  });
}

export function useDeletePhoto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (photo: Pick<ProgressPhotoRow, 'id' | 'path'>) => {
      assertOnline();
      const rm = await supabase.storage.from(BUCKET).remove([photo.path]);
      if (rm.error) throw rm.error;
      unwrap(await supabase.from('progress_photos').delete().eq('id', photo.id));
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: photoKeys.all }),
  });
}

/** Removes every photo file in the user's folder (used before deleting the account). */
export async function deleteAllPhotoFiles(userId: string): Promise<void> {
  for (;;) {
    const { data, error } = await supabase.storage.from(BUCKET).list(userId, { limit: 100 });
    if (error) throw error;
    if (!data || data.length === 0) return;
    const rm = await supabase.storage.from(BUCKET).remove(data.map((f) => `${userId}/${f.name}`));
    if (rm.error) throw rm.error;
  }
}
