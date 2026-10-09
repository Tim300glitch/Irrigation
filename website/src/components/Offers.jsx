import { ArrowRight, Phone } from 'lucide-react'
import { SectionHeading } from './Section.jsx'
import { business } from '../config.js'

const offers = [
  {
    percent: '40',
    label: 'New System Installations',
    text: 'Upgrade your property with a professionally planned irrigation system.',
    cta: 'Request Installation Estimate',
    service: 'New sprinkler system installation',
    featured: true,
  },
  {
    percent: '25',
    label: 'Irrigation Repairs',
    text: 'Fix leaks, broken sprinklers, and irrigation problems while saving on repair costs.',
    cta: 'Request Repair Estimate',
    service: 'Irrigation / sprinkler repair',
    featured: false,
  },
]

export default function Offers({ onRequest }) {
  return (
    <section id="offers" className="relative overflow-hidden bg-navy py-20 sm:py-28">
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 -right-40 h-[560px] w-[560px] text-leaf/15"
        viewBox="0 0 200 200"
        fill="none"
        stroke="currentColor"
        strokeWidth="0.6"
      >
        <circle cx="100" cy="100" r="40" />
        <circle cx="100" cy="100" r="60" />
        <circle cx="100" cy="100" r="80" />
        <circle cx="100" cy="100" r="99" />
      </svg>

      <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          light
          eyebrow="Special Offers"
          title="Save on Your Next Irrigation Project"
          intro="Limited-time savings on new sprinkler installations and irrigation system repairs."
        />

        <div className="mt-14 grid gap-6 lg:grid-cols-2">
          {offers.map((o) => (
            <article
              key={o.label}
              className={`reveal relative flex flex-col overflow-hidden rounded-[2rem] p-8 sm:p-10 ${
                o.featured ? 'bg-leaf-strong text-white' : 'bg-white text-navy'
              }`}
            >
              <span
                className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-bold tracking-[0.12em] uppercase ${
                  o.featured ? 'bg-white/15 text-white' : 'bg-leaf-soft text-leaf-strong'
                }`}
              >
                Limited-Time Offer
              </span>

              <p className="mt-6 flex items-start leading-none font-extrabold tracking-tighter">
                <span className="text-[6.5rem] sm:text-[8rem]">{o.percent}</span>
                <span className="mt-3 flex flex-col text-4xl sm:mt-4 sm:text-5xl">
                  %<span className="mt-1 text-2xl tracking-tight sm:text-3xl">OFF</span>
                </span>
              </p>

              <h3 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">{o.label}</h3>
              <p className={`mt-3 max-w-md text-lg leading-relaxed ${o.featured ? 'text-white/85' : 'text-navy-600'}`}>
                {o.text}
              </p>

              <div className="mt-auto flex flex-col gap-3 pt-8 sm:flex-row sm:flex-wrap sm:items-center">
                <button
                  type="button"
                  onClick={() => onRequest(o.service)}
                  className={`inline-flex min-h-[52px] cursor-pointer items-center justify-center gap-2 rounded-full px-7 font-bold whitespace-nowrap transition duration-200 hover:-translate-y-0.5 active:scale-[0.98] ${
                    o.featured ? 'bg-white text-leaf-deep hover:bg-leaf-soft' : 'bg-navy text-white hover:bg-navy-800'
                  }`}
                >
                  {o.cta}
                  <ArrowRight className="h-5 w-5" aria-hidden="true" />
                </button>
                <a
                  href={business.phoneHref}
                  className={`inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full px-4 font-semibold whitespace-nowrap underline-offset-4 hover:underline ${
                    o.featured ? 'text-white' : 'text-navy'
                  }`}
                >
                  <Phone className="h-4 w-4" aria-hidden="true" />
                  {business.phoneDisplay}
                </a>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
