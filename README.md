# Training Lab

Aplicación de entrenamiento basada en evidencia: rutinas configurables e importables,
registro por serie (peso · repeticiones · RIR), auditoría de volumen semanal por grupo
muscular y analítica de progresión.

**App:** https://pepes78.github.io/training-lab/

Sucesora de la sección de entrenamiento de [Pepes78.github.io](https://github.com/Pepes78/Pepes78.github.io),
reescrita alrededor de una idea: **la rutina es un dato, no código**.

---

## Qué la diferencia

| | |
|---|---|
| **Rutinas como datos** | Documento JSON portable y validado. Pídesela a Claude en otra conversación y la importas. Ninguna rutina está escrita a fuego. |
| **Registro por serie** | Peso, repeticiones y RIR de cada serie. No un número por semana. |
| **e1RM** | 1RM estimado ajustado por RIR: la única forma honesta de comparar 100×8 con 105×6. |
| **Motor de progresión** | Doble progresión. Al abrir la sesión te dice qué carga poner y por qué. |
| **Sustitución semanal** | ¿Máquina ocupada? Cambias el ejercicio y vuelve solo la semana siguiente. |
| **Volumen fraccional** | El press de banca cuenta 1 para pectoral y 0,5 para tríceps y deltoides anterior. |
| **Offline-first** | Funciona entera sin cobertura. PWA instalable. |

## Arquitectura

```
Routine (plantilla JSON)  ──instancia──▶  Cycle (ejecución con fechas)
   versionada, portable                       │
   generable por Claude                       ▼
                                    Session ──▶ SetLog
```

Separar plantilla de ejecución permite repetir la misma rutina dentro de un año y
comparar ciclo contra ciclo. El `Cycle` guarda una **copia congelada** de la rutina,
así que editar la plantilla más adelante nunca reescribe el historial.

```
src/
├── types/          Esquemas Zod: catálogo, rutina, registros
├── data/           Catálogo de ejercicios, referencias de volumen, rutina semilla
├── lib/            e1RM, progresión, volumen, estadística, IndexedDB, sync
├── store/          Estado global (zustand)
├── components/     UI compartida y gráficas
└── pages/          Inicio · Entrenar · Volumen · Cuerpo · Rutinas · Ajustes
schema/             JSON Schema publicado + plantilla de prompt
supabase/           schema.sql con tablas y políticas RLS
```

**Stack:** Vite · React 18 · TypeScript · Tailwind 4 · Recharts · Zod · IndexedDB (idb) ·
Supabase (opcional) · vite-plugin-pwa

## Desarrollo

```bash
npm install
```

```bash
npm run dev
```

```bash
npm run build
```

## Generar una rutina nueva con Claude

1. En la app: **Rutinas → Importar → Copiar prompt**.
2. Pega el prompt en una conversación nueva y describe lo que quieres (días, objetivo,
   material, lesiones, semanas).
3. Pega el JSON que te devuelva en el mismo cuadro de importación.

La validación es estricta y los errores traen la ruta exacta
(`days.2.blocks.0.exercises.1.repRange: ...`), así que corregir el documento es directo.

El contrato completo está en [`schema/routine.v1.schema.json`](schema/routine.v1.schema.json)
y hay un ejemplo real y funcional en
[`src/data/routines/ul-ppl-5d.json`](src/data/routines/ul-ppl-5d.json).

### Lo mínimo que debe cumplir una rutina

- `schemaVersion` es `"1.0"`.
- Cada `slotId` es **único en toda la rutina** — es lo que ancla el historial.
- `daysPerWeek`, si se indica, coincide con `days.length`.
- `repRange` es `[min, max]` con `min <= max`.
- Los `exerciseId` existen en el catálogo o van declarados en `customExercises`.

## Sincronización entre dispositivos (opcional)

Sin configurar nada, la app funciona entera y guarda todo en el dispositivo.

Para sincronizar móvil ↔ PC:

1. Crea un proyecto en [supabase.com](https://supabase.com) (plan gratuito).
2. SQL Editor → pega y ejecuta [`supabase/schema.sql`](supabase/schema.sql).
3. En la app: **Ajustes → Sincronización**, pega la URL y la `anon key` del proyecto.
4. Inicia sesión con tu correo (enlace mágico, sin contraseñas).

> **Sobre la seguridad.** La `anon key` es pública por diseño y puede vivir en el repo.
> Lo que protege los datos es **Row Level Security**: cada fila lleva `user_id` y la
> política exige `auth.uid() = user_id`. Sin RLS, cualquiera con la clave puede leer y
> borrar toda la tabla. El `schema.sql` la deja activada; no la desactives.

## Compartirla con más gente

**La app ya es multiusuario.** No hace falta cambiar el modelo de datos: todas las tablas
llevan `user_id` y la política RLS es `auth.uid() = user_id`, así que varias personas
pueden usar el **mismo** proyecto de Supabase viendo cada una solo lo suyo. Se registran
con su correo, y a partir de ahí sus rutinas, ciclos y métricas son suyos.

Lo único que hay que preparar es no obligar a cada uno a pegar la URL y la clave a mano:

1. Crea `.env.production` en la raíz (ver [`.env.example`](.env.example)) con
   `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.
2. Commitea el archivo. **Sí, al repo público**: la `anon key` acaba en el JavaScript del
   navegador de todos modos, así que esconderla no aporta nada. Lo que protege los datos
   es RLS. La que **nunca** debe salir del panel de Supabase es la `service_role`.
3. A partir de ahí tus amigos solo entran a la URL, la instalan y ponen su correo.

Alternativa si prefieres no commitear las claves: el workflow de despliegue ya lee los
secretos `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` del repositorio.

### Límites reales del plan gratuito

| | |
|---|---|
| **Correos de acceso** | El SMTP compartido de Supabase va muy limitado (unos pocos envíos por hora). Con 3 o 4 amigos se nota; a partir de ahí configura un SMTP propio — Resend o Brevo tienen plan gratuito suficiente. **Es el primer cuello de botella que te vas a encontrar.** |
| **Pausa por inactividad** | Los proyectos gratuitos se pausan tras ~1 semana sin actividad. Con gente usándolo no ocurre. |
| **Base de datos** | 500 MB. Un año de entrenamiento ocupa del orden de un mega por persona: no es una preocupación. |

### Lo que NO está resuelto

- **Compartir rutinas entre usuarios.** Hoy se hace exportando el JSON y pasándoselo.
  Un catálogo compartido necesitaría una tabla de rutinas públicas con su propia política
  RLS de solo lectura.
- **Nada social**: ni clasificaciones, ni comparativas, ni seguir a otros.
- **Sin panel de administración**: gestionar usuarios se hace desde el panel de Supabase.

## Sobre las referencias de volumen

Las referencias MEV/MAV/MRV que usa la pantalla de volumen son **heurísticas**, no ciencia
exacta. Vienen del marco popularizado por Renaissance Periodization (Mike Israetel) que
Jeff Nippard usa como referencia divulgativa, y la variación entre personas es grande.

Un matiz importante: esas tablas se construyeron contando **series directas**. Esta app
cuenta además las indirectas, así que los totales salen más altos por definición. Por eso
los músculos que reciben mucho trabajo indirecto —tríceps, bíceps, deltoides anterior—
llevan techos algo más altos que la tabla original. Todos los valores son editables por
músculo en Ajustes.

Tu propia progresión de e1RM y tu fatiga acumulada mandan sobre cualquier tabla.

## Créditos

- Animaciones y datos de ejercicios: dataset `hasaneyldrm/exercises-dataset`,
  atribución **Gym Visual** (gymvisual.com). Uso no comercial. La media se sirve desde la
  CDN de ExerciseDB y no se aloja en este repositorio.
- Metodología de entrenamiento inspirada en el trabajo divulgativo de **Jeff Nippard** y en
  el marco de landmarks de volumen de **Renaissance Periodization**.

Esta aplicación no sustituye el criterio de un profesional. Si tienes lesiones o
condiciones médicas, consulta antes de seguir cualquier programa.
