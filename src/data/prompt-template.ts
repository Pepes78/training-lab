/* ============================================================================
 *  Plantilla de prompt para generar rutinas
 * ----------------------------------------------------------------------------
 *  Este texto se copia al portapapeles desde la pantalla de Rutinas. Se pega en
 *  una conversacion nueva con Claude, se describe lo que se quiere, y el JSON
 *  resultante se importa. Es la pieza que hace el sistema extensible sin tocar
 *  el codigo.
 * ========================================================================== */

export const PROMPT_TEMPLATE = `Necesito que me generes una rutina de entrenamiento en JSON para mi aplicacion Training Lab.

Devuelve UNICAMENTE el objeto JSON, sin texto alrededor ni bloque de codigo markdown.

## Esquema (routine.v1)

{
  "schemaVersion": "1.0",              // literal, obligatorio
  "id": "kebab-case-unico",            // minusculas, numeros y guiones
  "name": "Nombre legible",
  "description": "Para quien es y por que esta disenada asi",
  "author": "Claude",
  "goal": "hypertrophy",               // hypertrophy | strength | recomp | endurance | maintenance
  "experienceLevel": "intermediate",   // beginner | intermediate | advanced
  "durationWeeks": 8,                  // 1-52, por defecto 8
  "daysPerWeek": 4,                    // debe coincidir con days.length
  "tags": ["..."],
  "references": ["Justificacion metodologica o estudios en que te apoyas"],

  "progression": {
    "type": "double-progression",      // double-progression | linear | rir-autoregulated | none
    "incrementKg": { "upper": 2.5, "lower": 5, "isolation": 1.25 },
    "rirRamp": [3, 3, 2, 2, 1, 1, 0, "deload"]   // un valor por semana
  },

  "deload": {
    "week": "last",                    // numero de semana, o "last"
    "volumeMultiplier": 0.5,
    "intensityMultiplier": 0.9
  },

  "days": [
    {
      "id": "d1",
      "name": "Upper — Fuerza",
      "type": "upper",                 // upper|lower|push|pull|legs|full-body|arms|chest-back|custom
      "order": 1,
      "focus": "Resumen corto del dia",
      "notes": "Indicaciones opcionales",
      "blocks": [
        {
          "type": "single",            // single | superset | circuit
          "exercises": [
            {
              "slotId": "d1-s1",       // UNICO en toda la rutina; ancla el historial
              "exerciseId": "press-banca-barra",
              "sets": 4,
              "repRange": [5, 7],      // [min, max]
              "targetRIR": 2,          // opcional; si falta se usa rirRamp
              "restSec": 180,
              "tempo": "3-1-1-0",      // opcional
              "notes": "opcional",
              "warmupSets": 3,         // opcional, no cuentan para el volumen
              "metric": "reps",        // "reps" (defecto) o "seconds" para isometricos
              "perSide": false,        // true si las reps son por lado
              "substitutions": ["press-inclinado-mancuernas", "press-pecho-maquina"]
            }
          ]
        }
      ]
    }
  ],

  "customExercises": []                // ver mas abajo
}

## Ejercicios disponibles (usa estos exerciseId)

Pecho: press-banca-barra, press-inclinado-mancuernas, press-pecho-maquina, aperturas-mancuernas, cruce-poleas, fondos-paralelas
Hombro: press-militar-mancuernas, press-hombro-maquina, elevaciones-laterales, elevaciones-laterales-polea, face-pull, rotacion-externa
Espalda: dominadas, dominadas-asistidas, jalon-pecho, jalon-amplio, pullover-polea, pullover-mancuerna, remo-barra, remo-mancuerna, remo-sentado-polea, remo-cable, remo-polea-amplio, encogimientos
Biceps: curl-barra, curl-ez, curl-inclinado, curl-martillo, curl-concentrado, curl-cable
Triceps: triceps-polea, triceps-sobre-cabeza, press-frances, copa-triceps
Pierna: sentadilla-barra, sentadilla-maquina, prensa-piernas, extension-cuadriceps, zancada-mancuernas, sumo-mancuerna, peso-muerto-rumano-barra, peso-muerto-rumano, curl-femoral, curl-femoral-sentado, hip-thrust, abductores
Gemelos: elevacion-talones-pie, elevacion-talones-sentado, elevacion-talones
Core: plancha, crunch-polea, elevacion-piernas

Si necesitas un ejercicio que no este en la lista, definelo en "customExercises":

{
  "id": "mi-ejercicio",
  "name": { "es": "Nombre en castellano", "en": "english name" },
  "pattern": "horizontal-push",
  "equipment": "barbell",
  "primary":   [{ "muscle": "chest", "factor": 1 }],
  "secondary": [{ "muscle": "triceps", "factor": 0.5 }],
  "isUnilateral": false,
  "defaultMetric": "reps",
  "cues": ["Punto tecnico corto"]
}

patterns validos: horizontal-push, vertical-push, horizontal-pull, vertical-pull, squat, hinge, lunge, knee-flexion, knee-extension, hip-thrust, hip-abduction, hip-adduction, elbow-flexion, elbow-extension, shoulder-abduction, shoulder-horizontal-abduction, calf-raise, core-flexion, core-anti-extension, core-rotation, carry, other

equipment validos: barbell, dumbbell, machine, cable, smith, bodyweight, band, kettlebell, ez-bar, other

muscles validos: chest, front-delts, side-delts, rear-delts, lats, upper-back, traps, lower-back, biceps, triceps, forearms, quads, hamstrings, glutes, adductors, abductors, calves, abs, obliques, neck

El campo "factor" indica cuanto cuenta una serie para ese musculo: 1.0 motor principal, 0.5 secundario con estimulo real, 0.25 implicacion menor. La app lo usa para contar volumen semanal, asi que ajustalo con criterio.

## Criterios metodologicos que debes respetar

1. Frecuencia de 2 veces por semana por grupo muscular siempre que los dias lo permitan.
2. Volumen semanal por musculo dentro de rangos razonables, contando series directas e indirectas: pecho 12-20, espalda 14-22, cuadriceps 12-18, isquios 10-16, deltoides lateral 16-22, biceps 14-20, triceps 10-14, gemelos 12-16.
3. Los ejercicios compuestos van primero, en rangos de repeticiones mas bajos; los de aislamiento al final con rangos mas altos.
4. Dos o tres alternativas por ejercicio en "substitutions", pensadas para cuando la maquina este ocupada: mismo musculo, distinto material.
5. Descansos coherentes: 150-240 s en compuestos pesados, 60-120 s en accesorios, 45-60 s en aislamiento.
6. Progresion doble por defecto, con rampa de RIR que empiece lejos del fallo (3) y termine cerca (0-1), y descarga en la ultima semana.
7. Cada slotId debe ser unico en toda la rutina. Es lo que ancla el historial: si se repite, la validacion falla.

## Lo que quiero

[DESCRIBE AQUI: dias por semana, objetivo, tu nivel, material disponible, lesiones o limitaciones, duracion en semanas, y cualquier preferencia de ejercicios]
`
