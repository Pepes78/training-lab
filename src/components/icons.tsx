/* ============================================================================
 *  Iconografia
 * ----------------------------------------------------------------------------
 *  Iconos de trazo dibujados a mano sobre una rejilla de 24, con grosor 1.75 y
 *  extremos redondeados. Se hereda el color con currentColor, asi que el estado
 *  activo se resuelve con la clase del enlace y no hay variantes duplicadas.
 *
 *  Todos son geometria propia en vez de una libreria: son seis iconos, y meter
 *  una dependencia entera para eso engordaria el paquete sin necesidad.
 * ========================================================================== */

interface IconProps {
  size?: number
  /** Trazo mas grueso para la pestana activa. */
  active?: boolean
  className?: string
}

function Svg({ size = 22, active, className, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={active ? 2.2 : 1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

/** Inicio: casa. */
export function IconHome(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3.5 10.2 12 3.5l8.5 6.7" />
      <path d="M5.5 9.5V19a1.5 1.5 0 0 0 1.5 1.5h10a1.5 1.5 0 0 0 1.5-1.5V9.5" />
      <path d="M9.75 20.5v-5a1 1 0 0 1 1-1h2.5a1 1 0 0 1 1 1v5" />
    </Svg>
  )
}

/** Entrenar: mancuerna vista de frente, con discos a ambos lados. */
export function IconDumbbell(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M2.5 10.5v3" />
      <path d="M5.75 7.5v9" />
      <path d="M18.25 7.5v9" />
      <path d="M21.5 10.5v3" />
      <path d="M5.75 12h12.5" />
    </Svg>
  )
}

/** Volumen: barras horizontales, como la propia pantalla de volumen. */
export function IconBars(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 6.5h9.5" />
      <path d="M4 12h16" />
      <path d="M4 17.5h6" />
    </Svg>
  )
}

/** Cuerpo: silueta de persona. */
export function IconBody(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="7" r="3.25" />
      <path d="M5 20.5c0-3.6 3.1-6.25 7-6.25s7 2.65 7 6.25" />
    </Svg>
  )
}

/** Rutinas: hoja de plan con sus lineas. */
export function IconPlan(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M6.5 3.5h11A1.5 1.5 0 0 1 19 5v14a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 19V5a1.5 1.5 0 0 1 1.5-1.5Z" />
      <path d="M8.75 8.5h6.5" />
      <path d="M8.75 12h6.5" />
      <path d="M8.75 15.5h3.5" />
    </Svg>
  )
}

/** Ajustes: controles deslizantes, mas legibles a tamano pequeno que un engranaje. */
export function IconSettings(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 8h8" />
      <path d="M17 8h3" />
      <circle cx="14.5" cy="8" r="2.5" />
      <path d="M4 16h3" />
      <path d="M12 16h8" />
      <circle cx="9.5" cy="16" r="2.5" />
    </Svg>
  )
}
