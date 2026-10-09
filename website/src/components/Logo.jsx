export default function Logo({ light = false }) {
  return (
    <span className="flex items-center gap-2.5">
      <svg viewBox="0 0 64 64" className="h-9 w-9 shrink-0" aria-hidden="true">
        <rect width="64" height="64" rx="16" fill={light ? '#FFFFFF' : '#102A43'} />
        <path d="M32 12c-8 10.5-14 18.6-14 26a14 14 0 0 0 28 0c0-7.4-6-15.5-14-26Z" fill="#43A047" />
        <path d="M24 44h16" stroke={light ? '#102A43' : '#FFFFFF'} strokeWidth="3.5" strokeLinecap="round" />
      </svg>
      <span className={`text-[1.05rem] leading-none font-extrabold tracking-tight ${light ? 'text-white' : 'text-navy'}`}>
        DeltaLine
        <span className={`block pt-1 text-[0.68rem] font-semibold tracking-[0.22em] uppercase ${light ? 'text-white/70' : 'text-navy-400'}`}>
          Irrigation
        </span>
      </span>
    </span>
  )
}
