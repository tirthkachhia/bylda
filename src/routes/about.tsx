import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Database, Eye, LockKeyhole, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/brand/Logo";

export const Route = createFileRoute("/about")({ component: AboutPage });

function AboutPage() {
  return (
    <div className="min-h-screen bg-[#111318] text-white">
      <header className="border-b border-white/[0.08]">
        <div className="mx-auto flex h-[72px] max-w-[1120px] items-center justify-between px-5 sm:px-8">
          <Link to="/">
            <Logo className="text-white" />
          </Link>
          <div className="flex items-center gap-4">
            <Link to="/pricing" className="text-[12px] font-semibold text-[#9ba3af]">
              Pricing
            </Link>
            <Link
              to="/auth/sign-up"
              className="rounded-full bg-white px-4 py-2.5 text-[12px] font-semibold text-[#111318]"
            >
              Start pilot
            </Link>
          </div>
        </div>
      </header>
      <main>
        <section className="mx-auto max-w-[1120px] px-5 py-20 sm:px-8 lg:py-28">
          <div className="max-w-3xl">
            <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#78a9f2]">
              About Bylda
            </div>
            <h1 className="mt-5 text-[48px] font-bold leading-[1.01] tracking-[-0.055em] sm:text-[68px]">
              Sales software should finish the admin work it creates.
            </h1>
            <p className="mt-7 max-w-2xl text-[17px] leading-8 text-[#a0a7b2]">
              Bylda is a product company building the intelligence layer between the sales call and
              the CRM. We are focused on one loop: prepare the rep, understand the conversation,
              verify the output, and update the systems the team already uses.
            </p>
          </div>
        </section>
        <section className="border-y border-white/[0.08] bg-[#0c0f13]">
          <div className="mx-auto grid max-w-[1120px] divide-y divide-white/[0.08] px-5 sm:px-8 md:grid-cols-3 md:divide-x md:divide-y-0">
            <Principle
              icon={Eye}
              title="Evidence first"
              body="Every proposed field links back to the call moment that supports it."
            />
            <Principle
              icon={ShieldCheck}
              title="Human controlled"
              body="A rep reviews and approves changes before Bylda writes to the CRM."
            />
            <Principle
              icon={Database}
              title="Stack neutral"
              body="Keep the dialer and CRM your team already knows. Bylda sits between them."
            />
          </div>
        </section>
        <section className="mx-auto max-w-[1120px] px-5 py-20 sm:px-8 lg:py-28">
          <div className="grid gap-12 lg:grid-cols-[0.7fr_1.3fr]">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#78a9f2]">
                How we earn trust
              </div>
              <h2 className="mt-4 text-[36px] font-bold leading-[1.05] tracking-[-0.045em]">
                Clear boundaries from the first pilot.
              </h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <TrustCard
                number="01"
                title="Scoped access"
                body="Connect only the call source and CRM workspace required for the pilot."
              />
              <TrustCard
                number="02"
                title="Review before action"
                body="Extracted values remain proposals until a person confirms them."
              />
              <TrustCard
                number="03"
                title="Visible provenance"
                body="Confidence and transcript evidence stay attached to each field."
              />
              <TrustCard
                number="04"
                title="No forced migration"
                body="Your CRM remains the system of record; Bylda improves it rather than replacing it."
              />
            </div>
          </div>
        </section>
        <section className="mx-auto max-w-[1120px] px-5 pb-24 sm:px-8">
          <div className="rounded-[28px] bg-[#e8edf5] p-8 text-[#111318] sm:p-12">
            <LockKeyhole className="h-6 w-6 text-[#3275d8]" />
            <h2 className="mt-5 text-[34px] font-bold tracking-[-0.045em]">
              Built in public, evaluated on real work.
            </h2>
            <p className="mt-4 max-w-2xl text-[14px] leading-7 text-[#626973]">
              Bylda is early. We do not pretend otherwise. The right way to evaluate us is a
              controlled pilot: inspect the call output, verify the CRM changes, and decide whether
              the saved admin time and cleaner pipeline are real for your team.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                to="/auth/sign-up"
                className="inline-flex h-11 items-center gap-2 rounded-full bg-[#111318] px-5 text-[12px] font-semibold text-white"
              >
                Start a pilot <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href="mailto:hello@usebylda.com"
                className="inline-flex h-11 items-center rounded-full border border-black/[0.14] px-5 text-[12px] font-semibold"
              >
                Contact the team
              </a>
            </div>
          </div>
        </section>
      </main>
      <footer className="border-t border-white/[0.08]">
        <div className="mx-auto flex max-w-[1120px] items-center justify-between px-5 py-8 text-[11px] text-[#727b88] sm:px-8">
          <span>© 2026 Bylda, Inc.</span>
          <a href="mailto:hello@usebylda.com">hello@usebylda.com</a>
        </div>
      </footer>
    </div>
  );
}

function Principle({ icon: Icon, title, body }: { icon: typeof Eye; title: string; body: string }) {
  return (
    <article className="px-2 py-10 md:px-8">
      <Icon className="h-5 w-5 text-[#78a9f2]" />
      <h2 className="mt-6 text-[17px] font-semibold">{title}</h2>
      <p className="mt-3 text-[13px] leading-6 text-[#858e9b]">{body}</p>
    </article>
  );
}
function TrustCard({ number, title, body }: { number: string; title: string; body: string }) {
  return (
    <article className="rounded-[20px] border border-white/[0.1] bg-white/[0.035] p-6">
      <div className="font-mono text-[10px] text-[#657082]">{number}</div>
      <h3 className="mt-8 text-[16px] font-semibold">{title}</h3>
      <p className="mt-2 text-[12px] leading-6 text-[#858e9b]">{body}</p>
    </article>
  );
}
