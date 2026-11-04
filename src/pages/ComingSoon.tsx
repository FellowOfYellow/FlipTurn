import { PageHeader, Section } from '../components/ui'

export default function ComingSoon({ title, phase, children }: { title: string; phase: number; children: string }) {
  return (
    <>
      <PageHeader title={title} />
      <Section title={`Coming in Phase ${phase}`}>
        <p className="max-w-prose rounded-2xl bg-white p-5 text-slate-600 shadow-sm ring-1 ring-slate-200">{children}</p>
      </Section>
    </>
  )
}
