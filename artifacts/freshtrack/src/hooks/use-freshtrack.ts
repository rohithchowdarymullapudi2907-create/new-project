import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { toast } from 'sonner';
import { consumptionService, foodService, notificationService, profileService } from '@/services/data';
import type { FoodDraft } from '@/services/data';
import { useSession } from '@/lib/session';

export const keys = {
  foods: (userId?: string) => ['foods', userId] as const,
  food: (userId?: string, id?: string) => ['food', userId, id] as const,
  profile: (userId?: string) => ['profile', userId] as const,
  notifications: (userId?: string) => ['notifications', userId] as const,
  consumption: (userId?: string) => ['consumption', userId] as const,
};

export function useFoods() {
  const { user } = useSession();
  return useQuery({ queryKey: keys.foods(user?.id), queryFn: () => foodService.list(user!.id), enabled: !!user });
}
export function useFood(id?: string) {
  const { user } = useSession();
  return useQuery({ queryKey: keys.food(user?.id, id), queryFn: () => foodService.get(user!.id, id!), enabled: !!user && !!id });
}
export function useProfile() {
  const { user } = useSession();
  return useQuery({ queryKey: keys.profile(user?.id), queryFn: () => profileService.get(user!.id), enabled: !!user });
}
export function useNotifications() {
  const { user } = useSession();
  return useQuery({ queryKey: keys.notifications(user?.id), queryFn: () => notificationService.list(user!.id), enabled: !!user });
}
export function useConsumption() {
  const { user } = useSession();
  return useQuery({ queryKey: keys.consumption(user?.id), queryFn: () => consumptionService.list(user!.id), enabled: !!user });
}
export function useFreshTrackWrites() {
  const { user } = useSession();
  const qc = useQueryClient();
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: keys.foods(user?.id) });
    void qc.invalidateQueries({ queryKey: keys.notifications(user?.id) });
    void qc.invalidateQueries({ queryKey: keys.consumption(user?.id) });
    void qc.invalidateQueries({ queryKey: ['food', user?.id] });
  };
  const create = useMutation({ mutationFn: (draft: Partial<FoodDraft>) => foodService.create(user!.id, draft), onSuccess: refresh });
  const update = useMutation({ mutationFn: ({ id, draft }: { id: string; draft: Partial<FoodDraft> }) => foodService.update(user!.id, id, draft), onSuccess: refresh });
  const remove = useMutation({ mutationFn: (id: string) => foodService.remove(user!.id, id), onSuccess: refresh });
  const seedDemo = useMutation({ mutationFn: () => foodService.seedDemo(), onSuccess: refresh });
  const consume = useMutation({ mutationFn: ({ food, quantity, notes }: { food: Parameters<typeof consumptionService.consume>[1]; quantity: number; notes?: string }) => consumptionService.consume(user!.id, food, quantity, notes), onSuccess: refresh });
  const saveProfile = useMutation({ mutationFn: (patch: Parameters<typeof profileService.save>[1]) => profileService.save(user!.id, patch), onSuccess: () => void qc.invalidateQueries({ queryKey: keys.profile(user?.id) }) });
  const markRead = useMutation({ mutationFn: (id: string) => notificationService.markRead(user!.id, id), onSuccess: () => void qc.invalidateQueries({ queryKey: keys.notifications(user?.id) }) });
  const markAllRead = useMutation({ mutationFn: () => notificationService.markAllRead(user!.id), onSuccess: () => void qc.invalidateQueries({ queryKey: keys.notifications(user?.id) }) });
  return { create, update, remove, seedDemo, consume, saveProfile, markRead, markAllRead };
}

export function useGenerateExpiryReminders() {
  const { user } = useSession();
  const { data: foods } = useFoods();
  const { data: profile } = useProfile();
  const qc = useQueryClient();
  useEffect(() => {
    if (!user || !foods || profile?.notification_enabled === false) return;
    notificationService.ensureExpiryReminders(user.id, foods, profile?.reminder_days_before ?? 3)
      .then(() => qc.invalidateQueries({ queryKey: keys.notifications(user.id) }))
      .catch(() => toast.error('We couldn’t update your expiry reminders. Please try again.'));
  }, [user?.id, foods, profile?.notification_enabled, profile?.reminder_days_before, qc]);
}
