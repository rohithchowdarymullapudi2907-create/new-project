import { supabase } from '@/lib/supabase';
import { daysUntil, localDateKey } from '@/lib/expiry';

export type FoodItem = {
  id: string; user_id: string; name: string; category: string; quantity: number;
  unit: string; purchase_date: string | null; expiry_date: string;
  storage_location: string; brand: string | null; notes: string | null;
  image_url: string | null; consumed_at: string | null; created_at: string; updated_at: string;
};
export type Profile = {
  id: string; full_name: string; email: string; avatar_url: string | null;
  household_name: string | null; notification_enabled: boolean; reminder_days_before: number;
};
export type FoodDraft = Omit<FoodItem, 'id' | 'user_id' | 'consumed_at' | 'created_at' | 'updated_at'>;

function client() {
  if (!supabase) throw new Error('FreshTrack is not configured yet.');
  return supabase;
}

export const foodService = {
  async list(userId: string) {
    const { data, error } = await client().from('food_items').select('*').eq('user_id', userId).is('consumed_at', null).order('expiry_date');
    if (error) throw error;
    return (data ?? []) as FoodItem[];
  },
  async get(userId: string, id: string) {
    const { data, error } = await client().from('food_items').select('*').eq('user_id', userId).eq('id', id).is('consumed_at', null).single();
    if (error) throw error;
    return data as FoodItem;
  },
  async create(userId: string, draft: Partial<FoodDraft>) {
    const { data, error } = await client().from('food_items').insert({ ...draft, user_id: userId }).select().single();
    if (error) throw error;
    return data as FoodItem;
  },
  async update(userId: string, id: string, draft: Partial<FoodDraft>) {
    const { data, error } = await client().from('food_items').update(draft).eq('id', id).eq('user_id', userId).select().single();
    if (error) throw error;
    return data as FoodItem;
  },
  async remove(userId: string, id: string) {
    const { error } = await client().from('food_items').delete().eq('id', id).eq('user_id', userId);
    if (error) throw error;
  },
  async seedDemo() {
    const { data, error } = await client().rpc('seed_demo_food_items');
    if (error) throw error;
    return Number(data ?? 0);
  },
};

export const profileService = {
  async get(userId: string) {
    const { data, error } = await client().from('profiles').select('*').eq('id', userId).maybeSingle();
    if (error) throw error;
    return data as Profile | null;
  },
  async save(userId: string, patch: Partial<Profile>) {
    const { data, error } = await client().from('profiles').upsert({ id: userId, ...patch }).select().single();
    if (error) throw error;
    return data as Profile;
  },
};

export const notificationService = {
  async list(userId: string) {
    const { data, error } = await client().from('notifications').select('*').eq('user_id', userId).order('created_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  },
  async markRead(userId: string, id: string) {
    const { error } = await client().from('notifications').update({ is_read: true }).eq('id', id).eq('user_id', userId);
    if (error) throw error;
  },
  async markAllRead(userId: string) {
    const { error } = await client().from('notifications').update({ is_read: true }).eq('user_id', userId).eq('is_read', false);
    if (error) throw error;
  },
  async ensureExpiryReminders(userId: string, foods: FoodItem[], reminderDays: number) {
    const db = client();
    const today = localDateKey();
    const relevant = foods.filter((f) => {
      const remaining = daysUntil(f.expiry_date);
      return remaining >= -1 && remaining <= reminderDays;
    });
    if (!relevant.length) return;
    const { data: existing, error } = await db.from('notifications').select('id,food_item_id,expiry_date,dedupe_key,type,title,message').eq('user_id', userId);
    if (error) throw error;
    type ExistingReminder = { id: string; food_item_id: string | null; expiry_date: string | null; dedupe_key: string | null; type: string; title: string; message: string };
    const byKey = new Map((existing ?? []).map((n: ExistingReminder) => [n.dedupe_key ?? `${n.food_item_id}:${n.expiry_date ?? ''}`, n] as const));
    const records: Array<Record<string, string>> = [];
    const updates: Array<{ id: string; type: string; title: string; message: string }> = [];
    for (const f of relevant) {
      const days = daysUntil(f.expiry_date);
      const type = days < 0 ? 'expired' : 'expiring_soon';
      const title = days < 0 ? `${f.name} expired ${Math.abs(days)} ${Math.abs(days) === 1 ? 'day' : 'days'} ago` : days === 0 ? `${f.name} expires today` : `${f.name} is expiring soon`;
      const message = days < 0 ? `Check ${f.name} and remove it if it is no longer safe to use.` : days === 0 ? `Use ${f.name} today if you can.` : `${f.name} expires in ${days} ${days === 1 ? 'day' : 'days'}.`;
      const key = `${f.id}:${f.expiry_date}`;
      const prior = byKey.get(key);
      if (prior) {
        if (prior.type !== type || prior.title !== title || prior.message !== message) updates.push({ id: prior.id, type, title, message });
        continue;
      }
      records.push({
        user_id: userId, food_item_id: f.id,
        type, title, message, expiry_date: f.expiry_date, dedupe_key: key,
      });
    }
    if (records.length) {
      const { error: insertError } = await db.from('notifications').upsert(records, { onConflict: 'user_id,dedupe_key', ignoreDuplicates: true });
      if (insertError) throw insertError;
    }
    for (const reminder of updates) {
      const { id, ...values } = reminder;
      const { error: updateError } = await db.from('notifications').update(values).eq('id', id).eq('user_id', userId);
      if (updateError) throw updateError;
    }
  },
};

export const consumptionService = {
  async list(userId: string) {
    const { data, error } = await client().from('consumption_logs').select('*').eq('user_id', userId).order('consumed_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  },
  async consume(userId: string, food: FoodItem, quantity: number, notes?: string) {
    const db = client();
    const { error } = await db.rpc('consume_food_item', {
      p_food_item_id: food.id,
      p_quantity_used: quantity,
      p_notes: notes ?? null,
    });
    if (error) throw error;
  },
};
