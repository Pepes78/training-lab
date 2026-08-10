import type { FunFact } from '@/lib/milestones'

/* ============================================================================
 *  Tarjetas de comparativa
 * ----------------------------------------------------------------------------
 *  El objetivo es dar perspectiva, no adornar. La cifra va primero y la
 *  comparativa debajo, porque el dato es lo real y la analogia solo lo traduce.
 * ========================================================================== */

export function FunFactCard({ fact, tone = 'accent' }: { fact: FunFact; tone?: 'accent' | 'plain' }) {
  return (
    <div
      className={
        tone === 'accent'
          ? 'rounded-xl border border-[#cfe1f9] bg-accent-soft p-4'
          : 'rounded-xl border border-hairline bg-white p-4'
      }
    >
      <div className="flex items-start gap-3">
        <span className="text-[24px] leading-none" aria-hidden>
          {fact.emoji}
        </span>
        <div className="min-w-0">
          <div className="num text-[17px] font-semibold leading-tight text-ink">{fact.headline}</div>
          <div className="mt-0.5 text-[13px] leading-snug text-ink-secondary">{fact.comparison}</div>
          {fact.detail && (
            <div className="mt-1.5 text-[11px] leading-relaxed text-ink-muted">{fact.detail}</div>
          )}
        </div>
      </div>
    </div>
  )
}

export function FunFactList({ facts }: { facts: FunFact[] }) {
  if (facts.length === 0) return null
  return (
    <div className="space-y-2">
      {facts.map((f, i) => (
        <FunFactCard key={i} fact={f} tone={i === 0 ? 'accent' : 'plain'} />
      ))}
    </div>
  )
}
