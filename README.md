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
3. En la app: **Ajustes → Sincronización**, pega la **Project URL** y la **publishable key**
   del proyecto (Project Settings → API).
4. **Authentication → Providers → Email**: desactiva **Confirm email**. Sin esto, crear
   una cuenta manda un correo de verificación y no se puede entrar hasta abrirlo.
5. En la app: **Crear cuenta** con tu correo y una contraseña.

### Por qué contraseña y no enlace mágico

El acceso por correo parece más cómodo, pero aquí falla por tres motivos independientes:

1. **En iOS no funciona con la app instalada.** Una PWA en la pantalla de inicio y Safari
   son contextos de almacenamiento separados. Si pides el acceso desde la app, el
   verificador PKCE se guarda ahí, pero Mail abre el enlace en Safari, que no lo tiene, y
   el canje falla. Y aunque funcionara, la sesión quedaría creada en Safari y no en la app
   instalada, que es donde se entrena.
2. **El SMTP compartido de Supabase permite muy pocos envíos por hora** y devuelve
   `email rate limit exceeded` en cuanto haces un par de pruebas.
3. **Las plantillas hay que editarlas.** Y no basta con una: la primera vez que un correo
   entra al sistema se usa *Confirm signup*, no *Magic Link*.

La contraseña no depende del correo, así que esquiva los tres. La gestiona Supabase Auth
(hash bcrypt en servidor); la app nunca la almacena.

### Si aun así prefieres el código por correo

Está disponible en Ajustes, plegado bajo *"Prefiero un código por correo"*. Requiere
añadir `{{ .Token }}` a **las dos** plantillas (*Magic Link* y *Confirm signup*):

```html
<h2>Acceso a Training Lab</h2>
<p>Tu código de acceso es:</p>
<p style="font-size:28px;letter-spacing:6px;font-weight:700">{{ .Token }}</p>
<p>Caduca en una hora. Si no lo has pedido tú, ignora este correo.</p>
```

Y si vas a invitar gente, configura un SMTP propio en **Project Settings → Authentication
→ SMTP Settings**; Resend y Brevo tienen plan gratuito de sobra.

> **Qué clave es cuál.** Supabase renombró las claves: la **publishable key**
> (`sb_publishable_…`) es la que antes se llamaba *anon*, y la **secret key** es la antigua
> *service_role*. En la app va siempre la **publishable**. En proyectos antiguos verás en su
> lugar un JWT largo que empieza por `eyJ`; funciona igual.
>
> **Sobre la seguridad.** La clave publicable lo es por diseño y puede vivir en el repo: acaba
> en el JavaScript del navegador de todos modos. Lo que protege los datos es **Row Level
> Security**: cada fila lleva `user_id` y la política exige `auth.uid() = user_id`. Sin RLS,
> cualquiera con la clave puede leer y borrar toda la tabla. El `schema.sql` la deja activada;
> no la desactives. La **secret key** nunca debe salir del panel de Supabase.

## Compartirla con más gente

**La app ya es multiusuario.** No hace falta cambiar el modelo de datos: todas las tablas
llevan `user_id` y la política RLS es `auth.uid() = user_id`, así que varias personas
pueden usar el **mismo** proyecto de Supabase viendo cada una solo lo suyo. Se registran
con su correo, y a partir de ahí sus rutinas, ciclos y métricas son suyos.

Lo único que hay que preparar es no obligar a cada uno a pegar la URL y la clave a mano:

1. Crea `.env.production` en la raíz (ver [`.env.example`](.env.example)) con
   `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.
2. Commitea el archivo. **Sí, al repo público**: la clave publicable acaba en el JavaScript
   del navegador de todos modos, así que esconderla no aporta nada. Lo que protege los datos
   es RLS. La que **nunca** debe salir del panel de Supabase es la **secret key**.
3. A partir de ahí tus amigos solo entran a la URL, la instalan y ponen su correo.

> ⚠️ Si en su lugar prefieres usar **secretos de GitHub**, añádelos al workflow *y quita
> el `.env.production`*, pero no mezcles ambos: Vite da prioridad a las variables de
> entorno reales sobre los archivos `.env`, y un secreto que no existe se expande a
> cadena vacía. El resultado es una app desplegada sin conexión y sin ningún error
> visible en el build.

### Límites reales del plan gratuito

| | |
|---|---|
| **Correos de acceso** | El SMTP compartido de Supabase va muy limitado (unos pocos envíos por hora). Con 3 o 4 amigos se nota; a partir de ahí configura un SMTP propio — Resend o Brevo tienen plan gratuito suficiente. **Es el primer cuello de botella que te vas a encontrar.** |
| **Pausa por inactividad** | Los proyectos gratuitos se pausan tras ~1 semana sin actividad. Con gente usándolo no ocurre. |
| **Base de datos** | 500 MB. Un año de entrenamiento ocupa del orden de un mega por persona: no es una preocupación. |

### Limitación conocida de la sincronización

Los **borrados no se propagan hacia atrás**. Si eliminas un ciclo en el móvil, la fila
desaparece del servidor, pero un PC que ya tuviera ese ciclo descargado lo conserva: la
bajada solo añade y actualiza filas, nunca borra las que faltan.

Es deliberado, porque la alternativa ingenua —«borra en local todo lo que no esté en el
servidor»— destruiría los datos creados sin conexión que aún no se han subido. La
solución correcta son *tombstones* (marcar como borrado en lugar de eliminar la fila) y
está sin implementar.

Mientras tanto: si borras algo en un dispositivo y quieres verlo desaparecer en otro,
bórralo también allí.

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
