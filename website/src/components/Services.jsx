import { Droplets, Shovel, SlidersHorizontal, Smartphone, Waypoints, Wrench } from 'lucide-react'
import { SectionHeading } from './Section.jsx'

const services = [
  {
    icon: Shovel,
    title: 'New Irrigation Installations',
    text: 'Sprinkler systems planned zone by zone for your yard, so every area gets the right amount of water.',
  },
  {
    icon: Wrench,
    title: 'Sprinkler Repairs',
    text: 'Broken heads, stuck valves, weak pressure and dry spots — fixed properly so your lawn stays green.',
  },
  {
    icon: Waypoints,
    title: 'Mainline & Pipe Repairs',
    text: 'We locate and repair leaking or cracked mainlines and lateral pipes before they waste water or damage your yard.',
  },
  {
    icon: Droplets,
    title: 'Drip Irrigation Conversions',
    text: 'Targeted drip lines for beds, shrubs and trees deliver water right to the roots with less evaporation.',
  },
  {
    icon: Smartphone,
    title: 'Smart Controller Upgrades',
    text: 'Weather-aware controllers adjust your schedule automatically and let you manage watering from your phone.',
  },
  {
    icon: SlidersHorizontal,
    title: 'System Diagnostics & Adjustments',
    text: 'Head replacements, nozzle and arc adjustments and full troubleshooting to improve coverage and efficiency.',
  },
]

export default function Services() {
  return (
    <section id="services" className="bg-white py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Our Services"
          title="Everything Your Irrigation System Needs"
          intro="From brand-new sprinkler installations to sprinkler repair and drip irrigation in Sacramento, we handle the whole system — above and below ground."
        />

        <ul className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
          {services.map(({ icon: Icon, title, text }) => (
            <li
              key={title}
              className="reveal group relative rounded-3xl border border-line bg-white p-7 shadow-card transition duration-300 hover:-translate-y-1 hover:border-leaf/40 hover:shadow-lift sm:p-8"
            >
              <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-leaf-soft text-leaf-strong transition-colors duration-300 group-hover:bg-leaf-strong group-hover:text-white">
                <Icon className="h-7 w-7" strokeWidth={1.8} aria-hidden="true" />
              </span>
              <h3 className="mt-6 text-xl font-bold tracking-tight text-navy">{title}</h3>
              <p className="mt-2.5 leading-relaxed text-navy-600">{text}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
