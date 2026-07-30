-- ============================================================================
--  Training Lab - esquema de Supabase
-- ----------------------------------------------------------------------------
--  Pegar entero en el SQL Editor del proyecto de Supabase y ejecutar.
--
--  MODELO DE SEGURIDAD
--  La clave anonima (anon key) es publica por diseno y puede estar en el repo.
--  Lo que protege los datos NO es la clave, sino Row Level Security: cada fila
--  lleva user_id y las politicas exigen auth.uid() = user_id. Sin RLS activado,
--  cualquiera con la clave puede leer y borrar toda la tabla.
--
--  (Este es exactamente el fallo que tenia la version anterior del sitio: la
--  tabla `weights` era legible y escribible por cualquiera con la URL.)
-- ============================================================================

-- ── Rutinas ────────────────────────────────────────────────────────────────
create table if not exists public.routines (
  id              text        primary key,
  user_id         uuid        not null references auth.users(id) on delete cascade,
  name            text        not null,
  schema_version  text        not null default '1.0',
  -- El documento completo de la rutina, validado en cliente contra el schema.
  data            jsonb       not null default '{}'::jsonb,
  updated_at      timestamptz not null default now()
);

-- ── Ciclos: una ejecucion concreta de una rutina ──────────────────────────
create table if not exists public.cycles (
  id                text        primary key,
  user_id           uuid        not null references auth.users(id) on delete cascade,
  routine_id        text        not null,
  -- Copia congelada de la rutina al iniciar el ciclo. Editar la plantilla mas
  -- adelante no debe reescribir la historia de lo que ya entrenaste.
  routine_snapshot  jsonb       not null,
  start_date        date        not null,
  target_weeks      integer     not null default 8,
  status            text        not null default 'active'
                    check (status in ('active','completed','abandoned')),
  notes             text,
  created_at        timestamptz not null default now()
);

-- ── Sesiones ───────────────────────────────────────────────────────────────
create table if not exists public.sessions (
  id               text        primary key,
  user_id          uuid        not null references auth.users(id) on delete cascade,
  cycle_id         text        not null,
  week             integer     not null check (week > 0),
  day_id           text        not null,
  date             date        not null,
  status           text        not null default 'planned'
                   check (status in ('planned','in-progress','completed','skipped')),
  started_at       timestamptz,
  completed_at     timestamptz,
  duration_min     numeric,
  perceived_effort smallint    check (perceived_effort between 1 and 5),
  notes            text
);

-- ── Series: el registro fino de cada repeticion ───────────────────────────
create table if not exists public.set_logs (
  id           text        primary key,
  user_id      uuid        not null references auth.users(id) on delete cascade,
  session_id   text        not null,
  -- Ancla a la rutina: sobrevive a sustituciones de ejercicio.
  slot_id      text        not null,
  -- Ejercicio REALMENTE ejecutado. Difiere de slot_id cuando hubo sustitucion,
  -- y por eso la analitica del sustituto no contamina la del original.
  exercise_id  text        not null,
  set_index    integer     not null check (set_index > 0),
  weight_kg    numeric     not null default 0 check (weight_kg >= 0),
  reps         integer     not null default 0 check (reps >= 0),
  seconds      integer     check (seconds >= 0),
  rir          numeric     check (rir >= 0 and rir <= 10),
  is_warmup    boolean     not null default false,
  completed_at timestamptz not null default now(),
  notes        text
);

-- ── Sustituciones temporales, validas SOLO una semana ─────────────────────
create table if not exists public.week_overrides (
  id                      text        primary key,
  user_id                 uuid        not null references auth.users(id) on delete cascade,
  cycle_id                text        not null,
  week                    integer     not null check (week > 0),
  slot_id                 text        not null,
  replacement_exercise_id text        not null,
  reason                  text,
  created_at              timestamptz not null default now(),
  -- Un unico sustituto por hueco y semana. Al pasar de semana el override deja
  -- de aplicar solo, sin tener que deshacer nada.
  unique (user_id, cycle_id, week, slot_id)
);

-- ── Metricas corporales, en formato largo ─────────────────────────────────
--  Una fila por metrica y dia: anadir una medida nueva no exige migrar nada.
create table if not exists public.body_metrics (
  id         text        primary key,
  user_id    uuid        not null references auth.users(id) on delete cascade,
  date       date        not null,
  metric     text        not null,
  value      numeric     not null,
  note       text,
  created_at timestamptz not null default now(),
  unique (user_id, date, metric)
);

-- ── Indices ────────────────────────────────────────────────────────────────
create index if not exists idx_cycles_user        on public.cycles(user_id);
create index if not exists idx_sessions_cycle     on public.sessions(user_id, cycle_id);
create index if not exists idx_sessions_date      on public.sessions(user_id, date);
create index if not exists idx_setlogs_session    on public.set_logs(user_id, session_id);
create index if not exists idx_setlogs_exercise   on public.set_logs(user_id, exercise_id);
create index if not exists idx_overrides_cycle    on public.week_overrides(user_id, cycle_id, week);
create index if not exists idx_metrics_lookup     on public.body_metrics(user_id, metric, date);

-- ── Row Level Security ─────────────────────────────────────────────────────
--  Sin esto, la clave anonima da acceso total. Es la parte que NO se puede
--  omitir.
alter table public.routines       enable row level security;
alter table public.cycles         enable row level security;
alter table public.sessions       enable row level security;
alter table public.set_logs       enable row level security;
alter table public.week_overrides enable row level security;
alter table public.body_metrics   enable row level security;

do $$
declare t text;
begin
  foreach t in array array['routines','cycles','sessions','set_logs','week_overrides','body_metrics']
  loop
    execute format('drop policy if exists "own rows" on public.%I', t);
    execute format(
      'create policy "own rows" on public.%I
         for all
         to authenticated
         using (auth.uid() = user_id)
         with check (auth.uid() = user_id)', t);
  end loop;
end $$;

-- Comprobacion: debe devolver rowsecurity = true en las seis tablas.
-- select tablename, rowsecurity from pg_tables
--   where schemaname = 'public'
--     and tablename in ('routines','cycles','sessions','set_logs','week_overrides','body_metrics');
