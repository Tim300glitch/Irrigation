export function Eyebrow({ children, light = false }) {
  return (
    <p className={`mb-3 text-sm font-bold tracking-[0.14em] uppercase ${light ? 'text-leaf' : 'text-leaf-strong'}`}>
      {children}
    </p>
  )
}

export function SectionHeading({ eyebrow, title, intro, light = false, center = true }) {
  return (
    <div className={`reveal max-w-2xl ${center ? 'mx-auto text-center' : ''}`}>
      {eyebrow && <Eyebrow light={light}>{eyebrow}</Eyebrow>}
      <h2 className={`text-[2rem] leading-[1.1] font-extrabold tracking-tight text-balance sm:text-[2.6rem] ${light ? 'text-white' : 'text-navy'}`}>
        {title}
      </h2>
      {intro && (
        <p className={`mt-4 text-lg leading-relaxed text-pretty ${light ? 'text-white/75' : 'text-navy-600'}`}>{intro}</p>
      )}
    </div>
  )
}
