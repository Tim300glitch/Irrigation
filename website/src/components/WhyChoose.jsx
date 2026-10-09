import { Leaf, Lightbulb, MapPin, MessageSquareText, ReceiptText, Ruler } from 'lucide-react'
import Photo from './Photo.jsx'
import { SectionHeading } from './Section.jsx'
import { images } from '../config.js'

const reasons = [
  { icon: MessageSquareText, title: 'Clear communication', text: 'You’ll know what we found, what we recommend and why — in plain language.' },
  { icon: Lightbulb, title: 'Practical irrigation solutions', text: 'Fixes and upgrades that make sense for your yard and your budget.' },
  { icon: Ruler, title: 'Attention to detail', text: 'Careful head placement, clean work areas and thorough system checks.' },
  { icon: Leaf, title: 'Water-efficient system planning', text: 'Zones, heads and schedules designed to use water wisely.' },
  { icon: ReceiptText, title: 'Honest estimates', text: 'Straightforward pricing explained before any work begins.' },
  { icon: MapPin, title: 'Local Sacramento service', text: 'We work in Sacramento and the surrounding communities.' },
]

export default function WhyChoose() {
  return (
    <section id="why-deltaline" className="bg-white py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Why Choose DeltaLine?"
          title="Quality Work. Straightforward Service."
          intro="We keep it simple: listen carefully, recommend what your system actually needs, and do the job right."
        />

        <div className="mt-14 grid items-stretch gap-6 lg:grid-cols-[1fr_1.35fr]">
          <div className="reveal relative hidden overflow-hidden rounded-[2rem] lg:block">
            <Photo image={images.home} sizes="460px" className="absolute inset-0 h-full w-full" />
          </div>

          <ul className="grid gap-4 sm:grid-cols-2">
            {reasons.map(({ icon: Icon, title, text }) => (
              <li key={title} className="reveal rounded-3xl bg-mist p-6 transition duration-300 hover:bg-sky-soft">
                <Icon className="h-6 w-6 text-leaf-strong" strokeWidth={2} aria-hidden="true" />
                <h3 className="mt-4 text-lg font-bold tracking-tight text-navy">{title}</h3>
                <p className="mt-1.5 leading-relaxed text-navy-600">{text}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
