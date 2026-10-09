import { useState } from 'react'
import { CircleAlert, CircleCheck, ClipboardCheck, LoaderCircle, MapPin, Phone, Send } from 'lucide-react'
import { Eyebrow } from './Section.jsx'
import { btnPrimary } from './buttons.js'
import { business, formEmail } from '../config.js'

export const serviceOptions = [
  'New sprinkler system installation',
  'Irrigation / sprinkler repair',
  'Mainline or pipe repair',
  'Sprinkler head replacement or adjustment',
  'Drip irrigation installation or conversion',
  'Smart irrigation controller installation',
  'Troubleshooting & diagnostics',
  'System efficiency improvements',
  'Not sure / something else',
]

const empty = { name: '', phone: '', email: '', zip: '', details: '' }

function validate(v) {
  const errors = {}
  if (v.name.trim().length < 2) errors.name = 'Please enter your name.'
  const digits = v.phone.replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '')
  if (digits.length !== 10) errors.phone = 'Please enter a 10-digit phone number.'
  if (v.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.email.trim()))
    errors.email = 'Please check your email address, or leave it blank.'
  if (!/^\d{5}$/.test(v.zip.trim())) errors.zip = 'Please enter a 5-digit ZIP code.'
  return errors
}

const inputBase =
  'mt-2 block w-full rounded-2xl border bg-white px-4 py-3.5 text-base text-navy placeholder:text-navy-400/70 transition focus:border-sky focus:ring-4 focus:ring-sky/15 focus:outline-none'

function Field({ id, label, optional, error, children }) {
  return (
    <div>
      <label htmlFor={id} className="flex items-baseline justify-between text-sm font-semibold text-navy">
        <span>
          {label}
          {!optional && (
            <span className="text-leaf-strong" aria-hidden="true">
              {' '}
              *
            </span>
          )}
        </span>
        {optional && <span className="text-xs font-medium text-navy-400">Optional</span>}
      </label>
      {children}
      {error && (
        <p id={`${id}-error`} className="mt-1.5 flex items-center gap-1.5 text-sm font-medium text-red-700">
          <CircleAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  )
}

export default function Contact({ service, setService }) {
  const [values, setValues] = useState(empty)
  const [errors, setErrors] = useState({})
  const [status, setStatus] = useState('idle') // idle | sending | sent | error
  const [message, setMessage] = useState('')
  const [honey, setHoney] = useState('')

  const configured = Boolean(formEmail)

  const update = (key) => (e) => {
    const value = e.target.value
    setValues((v) => ({ ...v, [key]: value }))
    if (errors[key]) setErrors((er) => ({ ...er, [key]: undefined }))
  }

  const fieldProps = (key) => ({
    id: key,
    name: key,
    value: values[key],
    onChange: update(key),
    'aria-invalid': errors[key] ? true : undefined,
    'aria-describedby': errors[key] ? `${key}-error` : undefined,
    className: `${inputBase} ${errors[key] ? 'border-red-400' : 'border-line'}`,
  })

  async function onSubmit(e) {
    e.preventDefault()
    if (honey) return // bot filled the hidden field
    const found = validate(values)
    setErrors(found)
    const firstInvalid = Object.keys(found)[0]
    if (firstInvalid) {
      document.getElementById(firstInvalid)?.focus()
      return
    }
    if (!configured) {
      setStatus('error')
      setMessage(`Online requests aren't switched on yet. Please call us at ${business.phoneDisplay}.`)
      return
    }

    setStatus('sending')
    try {
      const res = await fetch(`https://formsubmit.co/ajax/${formEmail.trim()}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          Name: values.name.trim(),
          Phone: values.phone.trim(),
          Email: values.email.trim() || '(not provided)',
          'ZIP code': values.zip.trim(),
          'Service needed': service || 'Not specified',
          'Project details': values.details.trim() || '(none)',
          _subject: `New estimate request — ${values.name.trim()} (${values.zip.trim()})`,
          _template: 'table',
          ...(values.email.trim() ? { _replyto: values.email.trim() } : {}),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || String(data.success) !== 'true') throw new Error(data.message || 'Request failed')
      setStatus('sent')
      setValues(empty)
      setService('')
    } catch {
      setStatus('error')
      setMessage(
        `Sorry — your request didn't go through. Please try again, or call us at ${business.phoneDisplay}.`,
      )
    }
  }

  return (
    <section id="contact" className="bg-mist py-20 sm:py-28">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:px-6 lg:grid-cols-[0.85fr_1.15fr] lg:gap-14 lg:px-8">
        <div className="reveal">
          <Eyebrow>Free Estimate</Eyebrow>
          <h2 className="text-[2rem] leading-[1.1] font-extrabold tracking-tight text-balance text-navy sm:text-[2.6rem]">
            Let’s Get Your Irrigation System Working Right.
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-navy-600">
            Tell us a little about your yard and what’s going on. We’ll follow up to talk through your project and
            schedule your free estimate.
          </p>

          <a
            href={business.phoneHref}
            className="group mt-8 flex items-center gap-4 rounded-3xl bg-navy p-5 text-white shadow-lift transition hover:bg-navy-800 sm:p-6"
          >
            <span className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-leaf-strong transition group-hover:scale-105">
              <Phone className="h-6 w-6" aria-hidden="true" />
            </span>
            <span>
              <span className="block text-sm font-medium text-white/70">Prefer to talk? Call us</span>
              <span className="block text-2xl font-extrabold tracking-tight">{business.phoneDisplay}</span>
            </span>
          </a>

          <ul className="mt-8 space-y-4 text-navy-600">
            <li className="flex items-start gap-3">
              <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-leaf-strong" aria-hidden="true" />
              Serving {business.serviceArea}
            </li>
            <li className="flex items-start gap-3">
              <ClipboardCheck className="mt-0.5 h-5 w-5 shrink-0 text-leaf-strong" aria-hidden="true" />
              Free estimates on installations and repairs
            </li>
          </ul>
        </div>

        <div className="reveal rounded-[2rem] bg-white p-6 shadow-lift sm:p-10">
          {status === 'sent' ? (
            <div role="status" className="flex flex-col items-center py-10 text-center">
              <span className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-leaf-soft text-leaf-strong">
                <CircleCheck className="h-8 w-8" aria-hidden="true" />
              </span>
              <h3 className="mt-6 text-2xl font-bold text-navy">Thank you — request received.</h3>
              <p className="mt-3 max-w-sm leading-relaxed text-navy-600">
                We’ll reach out soon to discuss your project. Need us sooner? Call{' '}
                <a href={business.phoneHref} className="font-semibold text-leaf-strong underline underline-offset-4">
                  {business.phoneDisplay}
                </a>
                .
              </p>
              <button
                type="button"
                onClick={() => setStatus('idle')}
                className="mt-8 cursor-pointer rounded-full px-5 py-2.5 font-semibold text-navy ring-1 ring-line transition hover:ring-navy-400"
              >
                Send another request
              </button>
            </div>
          ) : (
            <form noValidate onSubmit={onSubmit} aria-label="Free estimate request" className="grid gap-5 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Field id="name" label="Full Name" error={errors.name}>
                  <input type="text" autoComplete="name" required placeholder="Jane Smith" {...fieldProps('name')} />
                </Field>
              </div>
              <Field id="phone" label="Phone Number" error={errors.phone}>
                <input
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  required
                  placeholder="(916) 555-0123"
                  {...fieldProps('phone')}
                />
              </Field>
              <Field id="zip" label="ZIP Code" error={errors.zip}>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="postal-code"
                  maxLength={5}
                  required
                  placeholder="95814"
                  {...fieldProps('zip')}
                />
              </Field>
              <div className="sm:col-span-2">
                <Field id="email" label="Email" optional error={errors.email}>
                  <input type="email" autoComplete="email" placeholder="you@example.com" {...fieldProps('email')} />
                </Field>
              </div>
              <div className="sm:col-span-2">
                <Field id="service" label="Service Needed" optional>
                  <select
                    id="service"
                    name="service"
                    value={service}
                    onChange={(e) => setService(e.target.value)}
                    className={`${inputBase} appearance-none border-line bg-[url("data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%2024%2024'%20fill='none'%20stroke='%23334E68'%20stroke-width='2'%3E%3Cpath%20d='m6%209%206%206%206-6'/%3E%3C/svg%3E")] bg-[length:20px] bg-[right_1rem_center] bg-no-repeat pr-12`}
                  >
                    <option value="">Select a service…</option>
                    {serviceOptions.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <div className="sm:col-span-2">
                <Field id="details" label="Brief Description of Project" optional>
                  <textarea
                    rows={4}
                    placeholder="e.g. Two zones aren't turning on and there's a wet spot near the driveway."
                    {...fieldProps('details')}
                    className={`${inputBase} resize-y border-line`}
                  />
                </Field>
              </div>

              {/* Spam trap: hidden from people, often filled by bots */}
              <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
                <label htmlFor="company-website">Leave this field empty</label>
                <input
                  id="company-website"
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                  value={honey}
                  onChange={(e) => setHoney(e.target.value)}
                />
              </div>

              <div className="sm:col-span-2">
                {status === 'error' && (
                  <p role="alert" className="mb-4 flex items-start gap-2 rounded-2xl bg-red-50 p-4 text-sm font-medium text-red-800">
                    <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>
                      {message}{' '}
                      <a href={business.phoneHref} className="font-bold underline underline-offset-2">
                        Call now
                      </a>
                    </span>
                  </p>
                )}
                <button type="submit" disabled={status === 'sending'} className={`${btnPrimary} w-full whitespace-nowrap sm:text-lg disabled:opacity-70`}>
                  {status === 'sending' ? (
                    <>
                      <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden="true" />
                      Sending…
                    </>
                  ) : (
                    <>
                      Request My Free Estimate
                      <Send className="h-5 w-5" aria-hidden="true" />
                    </>
                  )}
                </button>
                <p className="mt-4 text-center text-sm text-navy-400">
                  We only use your information to respond to your request.
                </p>
              </div>
            </form>
          )}
        </div>
      </div>
    </section>
  )
}
