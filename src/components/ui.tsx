import { useEffect, useRef, useState, type ReactNode } from 'react'
import { photoFor } from '../data/actions'
import { useData } from '../data/DataProvider'
import { initials } from '../lib/format'
import { resizePhoto } from '../lib/photo'

export function PageHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <header className="flex items-center justify-between gap-3 px-4 pt-5 pb-3 md:px-8 md:pt-8">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
      {action}
    </header>
  )
}

export function Section({
  title,
  subtitle,
  action,
  children,
}: {
  title: string
  subtitle?: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="px-4 pb-6 md:px-8">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

export function Button({
  children,
  onClick,
  variant = 'primary',
  type = 'button',
  disabled,
  className = '',
}: {
  children: ReactNode
  onClick?: () => void
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  type?: 'button' | 'submit'
  disabled?: boolean
  className?: string
}) {
  const styles = {
    primary: 'bg-brand-700 text-white hover:bg-brand-900 disabled:bg-slate-300',
    secondary: 'bg-white text-brand-700 ring-1 ring-slate-300 hover:bg-brand-50 disabled:text-slate-400',
    danger: 'bg-white text-red-700 ring-1 ring-red-200 hover:bg-red-50',
    ghost: 'text-brand-700 hover:bg-brand-50',
  }[variant]
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex min-h-11 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-4 text-sm font-semibold transition ${styles} ${className}`}
    >
      {children}
    </button>
  )
}

export function Stepper({
  value,
  onChange,
  label,
}: {
  value: number
  onChange: (value: number) => void
  label: string
}) {
  return (
    <div className="flex items-center gap-1" role="group" aria-label={label}>
      <button
        type="button"
        aria-label={`Fewer ${label}`}
        onClick={() => onChange(value - 1)}
        disabled={value <= 0}
        className="size-11 rounded-xl bg-slate-100 text-xl font-semibold text-slate-700 disabled:opacity-40"
      >
        −
      </button>
      <input
        inputMode="numeric"
        aria-label={label}
        value={value}
        onChange={(e) => {
          const n = parseInt(e.target.value.replace(/\D/g, '') || '0', 10)
          onChange(n)
        }}
        className="h-11 w-14 rounded-xl border border-slate-200 text-center text-lg font-semibold tabular-nums"
      />
      <button
        type="button"
        aria-label={`More ${label}`}
        onClick={() => onChange(value + 1)}
        className="size-11 rounded-xl bg-slate-100 text-xl font-semibold text-slate-700"
      >
        +
      </button>
    </div>
  )
}

// Bottom sheet on phones, centered dialog on larger screens.
export function Sheet({
  title,
  onClose,
  children,
  footer,
}: {
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} />
      <div className="relative flex max-h-[90dvh] w-full flex-col rounded-t-3xl bg-white shadow-xl md:max-w-lg md:rounded-3xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="size-10 rounded-full text-2xl text-slate-500 hover:bg-slate-100">
            ×
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex gap-3 border-t border-slate-100 px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">{footer}</div>}
      </div>
    </div>
  )
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      {children}
    </label>
  )
}

export const inputClass =
  'h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-base focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100'

export function Chips<T extends string>({
  options,
  value,
  onChange,
  allowNone,
}: {
  options: readonly T[]
  value: T | null
  onChange: (value: T | null) => void
  allowNone?: boolean
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(allowNone && value === option ? null : option)}
          aria-pressed={value === option}
          className={`min-h-11 min-w-11 rounded-xl px-3 text-sm font-semibold ring-1 transition ${
            value === option ? 'bg-brand-700 text-white ring-brand-700' : 'bg-white text-slate-700 ring-slate-300'
          }`}
        >
          {option}
        </button>
      ))}
    </div>
  )
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">{children}</div>
}

const AVATAR_SIZES = { sm: 'size-10 text-sm', md: 'size-14 text-lg', lg: 'size-24 text-3xl' }

// Shows the person's photo when there is one, otherwise their initials.
export function Avatar({
  id,
  name,
  size = 'sm',
  photo,
}: {
  id: string
  name: string
  size?: keyof typeof AVATAR_SIZES
  photo?: string | null
}) {
  const { data } = useData()
  const src = photo === undefined ? photoFor(data, id) : photo
  const [first = '', ...rest] = name.trim().split(/\s+/)
  const classes = `${AVATAR_SIZES[size]} shrink-0 rounded-full`
  return src ? (
    <img src={src} alt="" className={`${classes} object-cover`} />
  ) : (
    <span className={`${classes} flex items-center justify-center bg-brand-100 font-bold text-brand-700`}>
      {initials(first, rest.at(-1) ?? '')}
    </span>
  )
}

// Photo field for a form: shows the current photo with buttons to add, change
// or remove it. The value is a small JPEG data URL, or null for none.
export function PhotoField({
  name,
  value,
  onChange,
}: {
  name: string
  value: string | null
  onChange: (value: string | null) => void
}) {
  const input = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  return (
    <div className="flex items-center gap-4">
      <Avatar id="" name={name || '?'} size="lg" photo={value} />
      <div className="flex flex-col items-start gap-1">
        <input
          ref={input}
          type="file"
          accept="image/*"
          hidden
          onChange={async (e) => {
            const file = e.target.files?.[0]
            e.target.value = ''
            if (!file) return
            try {
              onChange(await resizePhoto(file))
              setError(null)
            } catch (err) {
              setError((err as Error).message)
            }
          }}
        />
        <Button variant="secondary" onClick={() => input.current?.click()}>
          {value ? 'Change photo' : 'Add photo'}
        </Button>
        {value && (
          <Button variant="ghost" onClick={() => onChange(null)}>
            Remove photo
          </Button>
        )}
        {error && <p className="text-xs text-red-700">{error}</p>}
      </div>
    </div>
  )
}
