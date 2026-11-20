-- Scénario de synchronisation exécuté dans une transaction qui est TOUJOURS annulée à la fin :
-- le bloc se termine par une erreur volontaire qui contient le rapport. Rien n'est conservé dans la base.
do $$
declare
  ua uuid := '00000000-0000-4000-a000-00000000000a';
  ub uuid := '00000000-0000-4000-a000-00000000000b';
  uc uuid := '00000000-0000-4000-a000-00000000000c';
  h uuid;
  code text;
  n int;
  v jsonb;
  t1 timestamptz;
  t2 timestamptz;
  r jsonb := '[]'::jsonb;
begin
  insert into auth.users (id, aud, role, email) values
    (ua, 'authenticated', 'authenticated', 'test-a@cap-forme.invalid'),
    (ub, 'authenticated', 'authenticated', 'test-b@cap-forme.invalid'),
    (uc, 'authenticated', 'authenticated', 'test-c@cap-forme.invalid');

  -- A crée le foyer et enregistre un profil
  perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  h := public.create_household('Foyer test');
  select join_code into code from public.households where id = h;
  r := r || jsonb_build_object('t', '1 A cree le foyer', 'ok', h is not null and length(code) = 8, 'd', code);
  insert into public.records (household_id, id, kind, data, updated) values (h, 'p1', 'profile', '{"name":"A1"}', 1000)
    on conflict (household_id, id) do update set data = excluded.data, updated = excluded.updated, deleted = excluded.deleted;
  select count(*) into n from public.records;
  r := r || jsonb_build_object('t', '2 A voit son profil', 'ok', n = 1, 'd', n);

  -- B, pas encore membre, ne voit rien et ne peut rien écrire
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.records;
  r := r || jsonb_build_object('t', '3 B hors foyer ne voit rien', 'ok', n = 0, 'd', n);
  begin
    insert into public.records (household_id, id, kind, data, updated) values (h, 'intrus', 'profile', '{}', 1);
    r := r || jsonb_build_object('t', '4 B hors foyer ne peut pas ecrire', 'ok', false, 'd', 'insertion acceptee');
  exception when others then
    r := r || jsonb_build_object('t', '4 B hors foyer ne peut pas ecrire', 'ok', true, 'd', sqlerrm);
  end;

  -- B rejoint avec le code, voit le profil, le modifie
  perform public.join_household(lower(code));
  select count(*) into n from public.records;
  r := r || jsonb_build_object('t', '5 B rejoint et voit le profil', 'ok', n = 1, 'd', n);
  select synced_at into t1 from public.records where id = 'p1';
  perform pg_sleep(0.01);
  insert into public.records (household_id, id, kind, data, updated) values (h, 'p1', 'profile', '{"name":"B2"}', 2000)
    on conflict (household_id, id) do update set data = excluded.data, updated = excluded.updated, deleted = excluded.deleted;
  select synced_at into t2 from public.records where id = 'p1';
  r := r || jsonb_build_object('t', '6 modif de B repasse en tete de file', 'ok', t2 > t1, 'd', t2 - t1);

  -- A renvoie une version plus ancienne : elle doit être ignorée
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  insert into public.records (household_id, id, kind, data, updated) values (h, 'p1', 'profile', '{"name":"A-ancien"}', 1500)
    on conflict (household_id, id) do update set data = excluded.data, updated = excluded.updated, deleted = excluded.deleted;
  select data into v from public.records where id = 'p1';
  r := r || jsonb_build_object('t', '7 la version la plus recente gagne', 'ok', v ->> 'name' = 'B2', 'd', v);
  select count(*) into n from public.records where synced_at > t2;
  r := r || jsonb_build_object('t', '8 rien de neuf pour A depuis le curseur', 'ok', n = 0, 'd', n);

  -- Suppression propagée comme un enregistrement marqué supprimé
  insert into public.records (household_id, id, kind, data, updated, deleted) values (h, 'p1', 'profile', '{"name":"B2"}', 3000, true)
    on conflict (household_id, id) do update set data = excluded.data, updated = excluded.updated, deleted = excluded.deleted;
  select count(*) into n from public.records where synced_at > t2 and deleted;
  r := r || jsonb_build_object('t', '9 suppression transmise', 'ok', n = 1, 'd', n);

  -- Pas envoyés par le Raccourci iOS
  insert into public.health_tokens (token, household_id, profile_id) values (repeat('ab', 24), h, 'p1');
  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
  execute 'set local role anon';
  v := public.ingest_health(repeat('ab', 24), '8 421', '82,4', '2026-11-14');
  execute 'reset role';
  select (select data from public.records where id = 'steps:p1:2026-11-14') || jsonb_build_object('kg', (select data -> 'kg' from public.records where id = 'weight:p1:2026-11-14')) into v;
  r := r || jsonb_build_object('t', '10 pas et poids recus de Sante', 'ok', (v ->> 'count')::int = 8421 and (v ->> 'kg')::numeric = 82.4 and v ->> 'src' = 'health', 'd', v);

  -- C, d'un autre foyer, ne voit ni données ni jetons ; B ne peut pas créer un 2e foyer
  perform set_config('request.jwt.claims', json_build_object('sub', uc, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select (select count(*) from public.records) + (select count(*) from public.health_tokens) + (select count(*) from public.households) into n;
  r := r || jsonb_build_object('t', '11 un autre compte ne voit rien', 'ok', n = 0, 'd', n);
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  begin
    perform public.create_household('Second');
    r := r || jsonb_build_object('t', '12 pas de second foyer', 'ok', false, 'd', 'accepte');
  exception when others then
    r := r || jsonb_build_object('t', '12 pas de second foyer', 'ok', true, 'd', sqlerrm);
  end;

  execute 'reset role';
  raise exception 'RAPPORT %', r;
end;
$$;
