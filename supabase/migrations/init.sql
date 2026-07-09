-- Enable UUID generation extension if not enabled
create extension if not exists "uuid-ossp";

-- Table: profiles
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text not null,
  phone text,
  email_reminders_enabled boolean default true not null,
  created_at timestamptz default now()
);

-- Table: items
create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  item_name text not null,
  category text, -- 'Appliance', 'Electronics', 'Vehicle', 'Furniture', etc.
  brand text,
  purchase_date date not null,
  warranty_period_months integer not null,
  -- Stored generated column for warranty expiry date
  warranty_expiry_date date generated always as (
    (purchase_date + (warranty_period_months * interval '1 month'))::date
  ) stored,
  receipt_image_url text, -- Storage path within 'receipts' bucket
  purchase_price numeric,
  seller_store text,
  notes text,
  created_at timestamptz default now()
);

-- Table: service_schedules
create table if not exists public.service_schedules (
  id uuid primary key default gen_random_uuid(),
  item_id uuid references public.items(id) on delete cascade not null,
  service_type text not null, -- e.g. 'AC Service', 'Oil Change'
  frequency_months integer not null,
  last_service_date date,
  next_service_date date not null,
  created_at timestamptz default now()
);

-- Table: notifications_log
create table if not exists public.notifications_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  item_id uuid references public.items(id) on delete cascade not null,
  type text not null, -- 'warranty_expiring' or 'service_due'
  sent_at timestamptz default now(),
  read boolean default false not null
);

-- Enable Row Level Security (RLS)
alter table public.profiles enable row level security;
alter table public.items enable row level security;
alter table public.service_schedules enable row level security;
alter table public.notifications_log enable row level security;

-- Profiles Policies
create policy "Users can view their own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Users can insert their own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

-- Items Policies
create policy "Users can view their own items"
  on public.items for select
  using (auth.uid() = user_id);

create policy "Users can create their own items"
  on public.items for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own items"
  on public.items for update
  using (auth.uid() = user_id);

create policy "Users can delete their own items"
  on public.items for delete
  using (auth.uid() = user_id);

-- Service Schedules Policies (Check item ownership)
create policy "Users can view service schedules of their own items"
  on public.service_schedules for select
  using (
    exists (
      select 1 from public.items
      where items.id = service_schedules.item_id
      and items.user_id = auth.uid()
    )
  );

create policy "Users can create service schedules for their own items"
  on public.service_schedules for insert
  with check (
    exists (
      select 1 from public.items
      where items.id = item_id
      and items.user_id = auth.uid()
    )
  );

create policy "Users can update service schedules of their own items"
  on public.service_schedules for update
  using (
    exists (
      select 1 from public.items
      where items.id = service_schedules.item_id
      and items.user_id = auth.uid()
    )
  );

create policy "Users can delete service schedules of their own items"
  on public.service_schedules for delete
  using (
    exists (
      select 1 from public.items
      where items.id = service_schedules.item_id
      and items.user_id = auth.uid()
    )
  );

-- Notifications Log Policies
create policy "Users can view their own notification logs"
  on public.notifications_log for select
  using (auth.uid() = user_id);

create policy "Users can update their own notification logs"
  on public.notifications_log for update
  using (auth.uid() = user_id);

create policy "Service role or functions can insert logs"
  on public.notifications_log for insert
  with check (true);

-- Trigger to automatically create a profile after signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', 'New User'),
    new.raw_user_meta_data->>'phone'
  );
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Setup Supabase Storage for Receipts
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'receipts',
  'receipts',
  false, -- private bucket
  5242880, -- 5MB limit
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do nothing;

-- Storage policies for 'receipts' bucket
create policy "Allow authenticated users to upload receipts to their own folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'receipts' 
    and (auth.uid()::text = (regexp_split_to_array(name, '/'))[1])
  );

create policy "Allow authenticated users to view receipts in their own folder"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'receipts' 
    and (auth.uid()::text = (regexp_split_to_array(name, '/'))[1])
  );

create policy "Allow authenticated users to update receipts in their own folder"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'receipts' 
    and (auth.uid()::text = (regexp_split_to_array(name, '/'))[1])
  );

create policy "Allow authenticated users to delete receipts from their own folder"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'receipts' 
    and (auth.uid()::text = (regexp_split_to_array(name, '/'))[1])
  );

-- View: profiles_with_emails (Expose emails to service role for notifications)
create or replace view public.profiles_with_emails as
select p.id, p.full_name, p.phone, p.email_reminders_enabled, u.email
from public.profiles p
join auth.users u on p.id = u.id;

/*
================================================================================
SUPABASE CONFIGURATION & PRODUCTION REMINDERS
================================================================================

1. SET RESEND SECRET IN SUPABASE:
   To send emails, you must configure your Resend API Key in Supabase Edge Functions.
   Run this command in the Supabase CLI:
   
   supabase secrets set RESEND_API_KEY=re_your_api_key_here

   Or configure it in the Supabase Dashboard under Settings > API > Secrets.

2. SCHEDULE THE REMINDERS DAILY VIA pg_cron:
   Enable pg_cron in Database > Extensions > cron (toggle ON).
   Then run the following query in the SQL Editor to trigger the function daily at 9:00 AM IST (3:30 AM UTC):

   select cron.schedule(
     'daily-warranty-reminders',
     '30 3 * * *',
     $$
     select net.http_post(
       url := 'https://jxekfdvorfurbkkvuawb.supabase.co/functions/v1/send-warranty-reminders',
       headers := jsonb_build_object(
         'Content-Type', 'application/json',
         'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY_HERE'
       ),
       body := '{}'::jsonb
     );
     $$
   );
*/

