-- Cap Forme : foyers partagés et synchronisation des données.
-- Chaque enregistrement de l'application (profil, repas, pesée…) est stocké tel quel en JSON dans « records ».

create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  join_code text not null unique,
  created_at timestamptz not null default now()
);

create table public.household_members (
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id)
);
create index household_members_user_idx on public.household_members (user_id);

create table public.records (
  household_id uuid not null references public.households (id) on delete cascade,
  id text not null,
  kind text not null,
  data jsonb not null,
  updated bigint not null,          -- horodatage (ms) de la modification côté appareil
  deleted boolean not null default false,
  synced_at timestamptz not null default clock_timestamp(),
  primary key (household_id, id)
);
create index records_sync_idx on public.records (household_id, synced_at);

-- Jetons utilisés par le Raccourci iOS (pas et poids depuis Apple Santé).
create table public.health_tokens (
  token text primary key check (char_length(token) >= 32),
  household_id uuid not null references public.households (id) on delete cascade,
  profile_id text not null,
  created_at timestamptz not null default now()
);

-- La version la plus récente gagne ; chaque écriture repasse en tête de la file de synchronisation.
create function public.records_before_write() returns trigger
language plpgsql as $$
begin
  if tg_op = 'UPDATE' and new.updated < old.updated then
    return null; -- écriture plus ancienne que ce qui est déjà enregistré : ignorée
  end if;
  new.synced_at := clock_timestamp();
  return new;
end;
$$;

create trigger records_before_write
before insert or update on public.records
for each row execute function public.records_before_write();

-- ── Droits ──
create function public.is_member(h uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from household_members where household_id = h and user_id = auth.uid());
$$;

grant select on public.households, public.household_members to authenticated;
grant select, insert, update on public.records to authenticated;
grant select, insert, delete on public.health_tokens to authenticated;
revoke all on public.households, public.household_members, public.records, public.health_tokens from anon;

alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.records enable row level security;
alter table public.health_tokens enable row level security;

create policy "membres : lecture du foyer" on public.households for select using (public.is_member(id));
create policy "membres : lecture des membres" on public.household_members for select using (public.is_member(household_id));
create policy "membres : lecture" on public.records for select using (public.is_member(household_id));
create policy "membres : ajout" on public.records for insert with check (public.is_member(household_id));
create policy "membres : modification" on public.records for update using (public.is_member(household_id)) with check (public.is_member(household_id));
create policy "membres : jetons (lecture)" on public.health_tokens for select using (public.is_member(household_id));
create policy "membres : jetons (ajout)" on public.health_tokens for insert with check (public.is_member(household_id));
create policy "membres : jetons (suppression)" on public.health_tokens for delete using (public.is_member(household_id));

-- ── Créer ou rejoindre un foyer ──
create function public.create_household(p_name text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  h uuid;
  code text;
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  if exists (select 1 from household_members where user_id = auth.uid()) then
    raise exception 'Ce compte fait déjà partie d’un foyer';
  end if;
  loop
    code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    exit when not exists (select 1 from households where join_code = code);
  end loop;
  insert into households (name, join_code) values (p_name, code) returning id into h;
  insert into household_members (household_id, user_id) values (h, auth.uid());
  return h;
end;
$$;

create function public.join_household(p_code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  h uuid;
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  if exists (select 1 from household_members where user_id = auth.uid()) then
    raise exception 'Ce compte fait déjà partie d’un foyer';
  end if;
  select id into h from households where join_code = upper(trim(p_code));
  if h is null then raise exception 'Code de foyer inconnu'; end if;
  insert into household_members (household_id, user_id) values (h, auth.uid());
  return h;
end;
$$;

revoke all on function public.create_household(text) from public, anon;
revoke all on function public.join_household(text) from public, anon;
grant execute on function public.create_household(text) to authenticated;
grant execute on function public.join_household(text) to authenticated;

-- ── Pas et poids envoyés par le Raccourci iOS ──
-- Appel : POST {URL}/rest/v1/rpc/ingest_health, en-têtes « apikey » (clé publique) et « Content-Type: application/json »,
-- corps { "p_token": "...", "p_steps": 8421, "p_weight": 82.4 }  (p_weight et p_date facultatifs).
create function public.ingest_health(p_token text, p_steps text default null, p_weight text default null, p_date date default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  link health_tokens;
  d date := coalesce(p_date, (now() at time zone 'Europe/Paris')::date);
  s numeric := nullif(regexp_replace(coalesce(p_steps, ''), '[^0-9.]', '', 'g'), '')::numeric;
  w numeric := nullif(replace(regexp_replace(coalesce(p_weight, ''), '[^0-9.,]', '', 'g'), ',', '.'), '')::numeric;
  now_ms bigint := (extract(epoch from clock_timestamp()) * 1000)::bigint;
  rid text;
begin
  select * into link from health_tokens where token = p_token;
  if not found then return jsonb_build_object('ok', false, 'error', 'Jeton inconnu'); end if;
  if s is null and w is null then return jsonb_build_object('ok', false, 'error', 'Rien à enregistrer'); end if;
  if s is not null then
    rid := 'steps:' || link.profile_id || ':' || d;
    insert into records (household_id, id, kind, data, updated) values (link.household_id, rid, 'steps',
      jsonb_build_object('id', rid, 'profileId', link.profile_id, 'date', d, 'count', round(least(s, 200000)), 'src', 'health'), now_ms)
    on conflict (household_id, id) do update set data = excluded.data, updated = excluded.updated, deleted = false;
  end if;
  if w is not null and w between 30 and 300 then
    rid := 'weight:' || link.profile_id || ':' || d;
    insert into records (household_id, id, kind, data, updated) values (link.household_id, rid, 'weight',
      jsonb_build_object('id', rid, 'profileId', link.profile_id, 'date', d, 'kg', round(w, 1)), now_ms)
    on conflict (household_id, id) do update set data = excluded.data, updated = excluded.updated, deleted = false;
  end if;
  return jsonb_build_object('ok', true, 'date', d, 'steps', round(s), 'weight', round(w, 1));
end;
$$;
revoke all on function public.ingest_health(text, text, text, date) from public;
grant execute on function public.ingest_health(text, text, text, date) to anon, authenticated;

-- ── Import d'une recette depuis un lien ──
-- Lit une seule page à la demande d'un membre connecté et renvoie son bloc schema.org/Recipe (JSON-LD) brut ;
-- l'application le met en forme.
create extension if not exists http with schema extensions;

create function public.import_recipe(p_url text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  host text := lower(substring(p_url from '^https?://([^/?#]+)'));
  resp extensions.http_response;
  m text[];
  doc jsonb;
  node jsonb;
begin
  if auth.uid() is null then return jsonb_build_object('error', 'Connexion requise.'); end if;
  if host is null or host ~ '[@:]' or host !~ '\.[a-z]{2,}$' or host ~ '^[0-9.]+$'
     or host ~ '(^|\.)(localhost|local|internal|supabase\.co|supabase\.in|supabase\.com)$' then
    return jsonb_build_object('error', 'Lien invalide.');
  end if;
  begin
    perform extensions.http_set_curlopt('CURLOPT_TIMEOUT', '6');
    select * into resp from extensions.http(('GET', p_url,
      array[extensions.http_header('User-Agent', 'Mozilla/5.0 (compatible; CapForme/0.1; import de recette personnel)'),
            extensions.http_header('Accept', 'text/html')], null, null)::extensions.http_request);
  exception when others then
    return jsonb_build_object('error', 'Impossible de lire cette page.');
  end;
  if resp.status <> 200 then return jsonb_build_object('error', 'La page a répondu « ' || resp.status || ' ».'); end if;
  for m in select regexp_matches(left(resp.content, 3000000), '<script[^>]*?application/ld\+json[^>]*?>(.*?)</script>', 'gi') loop
    begin
      doc := m[1]::jsonb;
    exception when others then
      continue;
    end;
    select x into node from jsonb_path_query(doc, '$.** ? (@."@type" == "Recipe")') as x limit 1;
    if node is not null then return jsonb_build_object('recipe', node, 'url', p_url); end if;
  end loop;
  return jsonb_build_object('error', 'Pas de recette structurée sur cette page. Colle les ingrédients à la main.');
end;
$$;
revoke all on function public.import_recipe(text) from public, anon;
grant execute on function public.import_recipe(text) to authenticated;
