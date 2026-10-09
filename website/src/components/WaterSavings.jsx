import { Ban, CloudRain, Droplet, Gauge, Target, Timer } from 'lucide-react'
import Photo from './Photo.jsx'
import { Eyebrow } from './Section.jsx'
import { images } from '../config.js'

const benefits = [
  { icon: Droplet, title: 'Less wasted water', text: 'Water goes where plants need it, not onto sidewalks and driveways.' },
  { icon: Gauge, title: 'More control over water bills', text: 'An efficient system uses only what your landscape actually needs.' },
  { icon: CloudRain, title: 'No overspray or runoff', text: 'Correct heads, arcs and pressure keep water on the lawn.' },
  { icon: Target, title: 'Even, healthy coverage', text: 'Properly spaced heads eliminate dry patches and soggy spots.' },
  { icon: Ban, title: 'Leaks eliminated', text: 'We find and fix leaking valves, pipes and broken sprinklers.' },
  { icon: Timer, title: 'Automated, weather-aware watering', text: 'Smart controllers adjust schedules for heat, rain and season.' },
]

export default function WaterSavings() {
  return (
    <section id="water-savings" className="bg-mist py-20 sm:py-28">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:px-8">
        <div className="reveal relative">
          <Photo
            image={images.waterSmart}
            sizes="(min-width: 1024px) 560px, 100vw"
            className="aspect-[4/3] w-full rounded-[2rem] shadow-lift lg:aspect-[4/5]"
          />
          <div className="absolute right-4 -bottom-6 left-4 rounded-2xl bg-white p-5 shadow-lift sm:right-auto sm:left-6 sm:max-w-xs">
            <p className="text-sm font-bold text-leaf-strong">Built for California</p>
            <p className="mt-1 text-sm leading-relaxed text-navy-600">
              Long, dry summers make an efficient irrigation system one of the smartest upgrades for a Sacramento home.
            </p>
          </div>
        </div>

        <div className="pt-6 lg:pt-0">
          <div className="reveal">
            <Eyebrow>Save Water, Save Money</Eyebrow>
            <h2 className="text-[2rem] leading-[1.1] font-extrabold tracking-tight text-balance text-navy sm:text-[2.6rem]">
              A Smarter Irrigation System Pays Off.
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-navy-600">
              California asks every homeowner to use water wisely. A properly designed and maintained system helps your
              landscape thrive while cutting the waste that drives up your bill.
            </p>
          </div>

          <ul className="mt-9 grid gap-x-8 gap-y-6 sm:grid-cols-2">
            {benefits.map(({ icon: Icon, title, text }) => (
              <li key={title} className="reveal flex gap-4">
                <span className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-sky shadow-card">
                  <Icon className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
                </span>
                <div>
                  <h3 className="font-bold text-navy">{title}</h3>
                  <p className="mt-1 text-[0.95rem] leading-relaxed text-navy-600">{text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
