import { Button, IconButton, Kbd, useTheme } from '@archboard/ui';
import {
  ArrowRight,
  Boxes,
  Calculator,
  Clock,
  Code2,
  HardDrive,
  Lightbulb,
  Moon,
  PenLine,
  Search,
  Spline,
  Sun,
  UserRound,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { AccountButton } from '../auth/account.tsx';
import { BOARD_LIFETIME_DAYS } from '../board/local-boards.ts';

const REPO_URL = 'https://github.com/ashutosh-lodha/ArchBoard';

/**
 * Landing page. Every claim here describes something that works today. No testimonials, logos
 * or usage numbers.
 */
export function HomePage() {
  return (
    <div className="min-h-dvh bg-bg text-text">
      <SiteHeader />
      <main>
        <Hero />
        <Features />
        <HowItWorks />
        <Rules />
        <FinalCta />
      </main>
      <SiteFooter />
    </div>
  );
}

function Logo() {
  return (
    <Link
      to="/"
      className="flex items-center gap-2 rounded-md font-semibold"
      aria-label="ArchBoard home"
    >
      <img src="/favicon.svg" alt="" width={28} height={28} className="size-7" />
      <span className="text-md">ArchBoard</span>
    </Link>
  );
}

function SiteHeader() {
  const { resolved, setPreference } = useTheme();
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-bg/85 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
        <Logo />
        <nav aria-label="Main" className="ml-4 hidden items-center gap-1 md:flex">
          {[
            ['#features', 'Features'],
            ['#how', 'How it works'],
            ['#rules', 'The rules'],
          ].map(([href, label]) => (
            <a
              key={href}
              href={href}
              className="rounded-md px-2.5 py-1.5 text-base text-text-muted hover:bg-surface-hover hover:text-text"
            >
              {label}
            </a>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-1.5">
          <IconButton
            label={resolved === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            onClick={() => setPreference(resolved === 'dark' ? 'light' : 'dark')}
          >
            {resolved === 'dark' ? <Sun /> : <Moon />}
          </IconButton>
          <AccountButton compact />
          <Button asChild variant="primary" size="sm">
            <Link to="/new">Start a board</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  const { resolved } = useTheme();
  return (
    <section className="relative isolate overflow-hidden border-b border-border">
      {/* Canvas-style dot grid that fades out, plus a soft accent glow behind the headline. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-[radial-gradient(var(--border-strong)_1px,transparent_1px)] [background-size:22px_22px] [mask-image:radial-gradient(ellipse_70%_60%_at_50%_0%,#000_40%,transparent_100%)] opacity-60"
      />
      <div
        aria-hidden="true"
        className="absolute left-1/2 top-[-12rem] -z-10 h-[36rem] w-[60rem] -translate-x-1/2 rounded-full bg-accent/20 blur-3xl"
      />

      <div className="mx-auto flex max-w-4xl flex-col items-center px-4 pb-14 pt-16 text-center sm:pt-24">
        <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-surface/80 px-3 py-1 text-sm text-text-muted shadow-e1 backdrop-blur">
          <Boxes className="size-3.5 text-accent" aria-hidden="true" />
          1,193 official AWS, Google Cloud and Azure icons
        </p>
        <h1 className="text-balance text-4xl font-bold leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">
          The board built for <span className="text-accent">system design interviews</span>
        </h1>
        <p className="mt-6 max-w-2xl text-balance text-md leading-7 text-text-muted sm:text-lg sm:leading-8">
          Lay out real cloud components, connect and group them, write details on every card, and
          size the system with a built-in capacity calculator.
        </p>
        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <Button asChild variant="primary" size="lg">
            <Link to="/new">
              Start a board, free <ArrowRight />
            </Link>
          </Button>
          <Button asChild variant="secondary" size="lg">
            <a href="#how">See how it works</a>
          </Button>
        </div>
        <ul className="mt-7 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-text-muted">
          <li className="inline-flex items-center gap-1.5">
            <UserRound className="size-4" aria-hidden="true" /> One board per account
          </li>
          <li className="inline-flex items-center gap-1.5">
            <Clock className="size-4" aria-hidden="true" /> Deleted after {BOARD_LIFETIME_DAYS} days
          </li>
          <li className="inline-flex items-center gap-1.5">
            <HardDrive className="size-4" aria-hidden="true" /> Saved to your account
          </li>
        </ul>
      </div>

      <div className="relative mx-auto max-w-6xl px-4 pb-20">
        <div
          aria-hidden="true"
          className="absolute inset-x-16 top-10 -z-10 h-2/3 rounded-full bg-accent/25 blur-3xl"
        />
        <figure className="overflow-hidden rounded-2xl border border-border-strong bg-surface shadow-e3 ring-1 ring-black/5">
          <div className="flex h-9 items-center gap-2 border-b border-border bg-bg-subtle px-4">
            <span className="size-2.5 rounded-full bg-[#ff5f57]" aria-hidden="true" />
            <span className="size-2.5 rounded-full bg-[#febc2e]" aria-hidden="true" />
            <span className="size-2.5 rounded-full bg-[#28c840]" aria-hidden="true" />
            <span className="mx-auto rounded-md bg-surface px-3 py-0.5 text-xs text-text-muted">
              archboard.ashutoshdev.online
            </span>
            <span className="w-12" aria-hidden="true" />
          </div>
          <img
            src={resolved === 'dark' ? '/landing/board-dark.jpg' : '/landing/board-light.jpg'}
            alt="The ArchBoard editor showing a URL shortener design: clients, a load balancer, a URL service inside a VPC with a Redis cache and Postgres, an async analytics pipeline into BigQuery, and a capacity estimate note."
            width={1440}
            height={860}
            fetchPriority="high"
            className="block h-auto w-full"
          />
        </figure>
      </div>
    </section>
  );
}

function Feature({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <li className="rounded-xl border border-border bg-surface p-5 shadow-e1">
      <div
        className="mb-3 flex size-9 items-center justify-center rounded-lg bg-accent-subtle text-accent [&_svg]:size-5"
        aria-hidden="true"
      >
        {icon}
      </div>
      <h3 className="text-md font-semibold">{title}</h3>
      <p className="mt-1.5 text-base text-text-muted">{children}</p>
    </li>
  );
}

function SectionHeading({
  id,
  eyebrow,
  title,
  intro,
}: {
  id: string;
  eyebrow: string;
  title: string;
  intro?: ReactNode;
}) {
  return (
    <div className="mb-10 max-w-2xl">
      <p className="text-sm font-semibold uppercase tracking-wide text-accent">{eyebrow}</p>
      <h2 id={id} className="mt-2 text-2xl font-semibold tracking-tight">
        {title}
      </h2>
      {intro ? <p className="mt-3 text-md text-text-muted">{intro}</p> : null}
    </div>
  );
}

function Features() {
  return (
    <section
      id="features"
      aria-labelledby="features-title"
      className="scroll-mt-16 border-b border-border"
    >
      <div className="mx-auto max-w-6xl px-4 py-20">
        <SectionHeading
          id="features-title"
          eyebrow="What you can do today"
          title="Everything you reach for in a design round"
        />
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Feature icon={<Search />} title="1,193 official icons">
            AWS, Google Cloud and Azure architecture icons plus 21 clean generic blocks. Type “lb”,
            “s3” or “pubsub” and the right one comes up.
          </Feature>
          <Feature icon={<Spline />} title="Connections that say something">
            Drag between components to connect them. Mark calls as sync or async, tag the protocol
            (HTTP, gRPC, WebSocket, Pub/Sub) and label what flows.
          </Feature>
          <Feature icon={<Boxes />} title="Regions, VPCs and clusters">
            Group components into regions, availability zones, VPCs, subnets or Kubernetes clusters.
            Drag things in and out; resize the box.
          </Feature>
          <Feature icon={<Calculator />} title="Back-of-the-envelope maths">
            Enter daily users, read/write rates and payload size to get QPS, storage and bandwidth,
            with the formula behind every number. Pin the result to a component.
          </Feature>
          <Feature icon={<PenLine />} title="Sketch freely">
            A pen for quick arrows and circles, shapes you can type into, sticky notes and text
            boxes, right next to the architecture.
          </Feature>
          <Feature icon={<Lightbulb />} title="Prompts that make you think">
            Select a cache, queue or database and see the questions an interviewer would ask:
            eviction, ordering, hot partitions, failure modes.
          </Feature>
        </ul>
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    {
      title: 'Start a board',
      body: 'Sign in and your board opens in one click, with a hint so you never face a blank canvas.',
    },
    {
      title: 'Lay out the system',
      body: 'Search or drag components onto the board, connect them, group them, and write details on each card.',
    },
    {
      title: 'Size it and refine',
      body: 'Run the capacity numbers, attach them to the right component, and keep iterating. Every change saves as you go.',
    },
  ];
  return (
    <section
      id="how"
      aria-labelledby="how-title"
      className="scroll-mt-16 border-b border-border bg-bg-subtle"
    >
      <div className="mx-auto max-w-6xl px-4 py-20">
        <SectionHeading
          id="how-title"
          eyebrow="How it works"
          title="From blank board to a defensible design"
        />
        <ol className="grid gap-6 md:grid-cols-3">
          {steps.map((s, i) => (
            <li key={s.title} className="relative rounded-xl border border-border bg-surface p-5">
              <span
                className="mb-3 inline-flex size-8 items-center justify-center rounded-full bg-accent text-sm font-semibold text-on-accent"
                aria-hidden="true"
              >
                {i + 1}
              </span>
              <h3 className="text-md font-semibold">{s.title}</h3>
              <p className="mt-1.5 text-base text-text-muted">{s.body}</p>
            </li>
          ))}
        </ol>
        <p className="mt-8 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-text-muted">
          Keyboard-first: <Kbd>/</Kbd> search <Kbd>D</Kbd> pen <Kbd>R</Kbd> shape <Kbd>G</Kbd> group{' '}
          <Kbd>E</Kbd> estimate <Kbd>Ctrl+Z</Kbd> undo
        </p>
      </div>
    </section>
  );
}

function Rule({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <li className="flex gap-4">
      <div
        className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-pen-subtle text-pen [&_svg]:size-5"
        aria-hidden="true"
      >
        {icon}
      </div>
      <div>
        <h3 className="font-semibold">{title}</h3>
        <p className="mt-1 text-base text-text-muted">{children}</p>
      </div>
    </li>
  );
}

function Rules() {
  return (
    <section
      id="rules"
      aria-labelledby="rules-title"
      className="scroll-mt-16 border-b border-border"
    >
      <div className="mx-auto max-w-6xl px-4 py-20">
        <SectionHeading
          id="rules-title"
          eyebrow="The rules, upfront"
          title="Simple limits, no surprises"
          intro="ArchBoard is free to use. To keep it that way, boards are short-lived."
        />
        <ul className="grid gap-8 md:grid-cols-2">
          <Rule icon={<UserRound />} title="One board per account">
            Each account has one board at a time. Starting another means deleting the current one
            first, and you'll always be asked before anything is deleted.
          </Rule>
          <Rule icon={<Clock />} title={`Deleted after ${BOARD_LIFETIME_DAYS} days`}>
            Boards are deleted automatically {BOARD_LIFETIME_DAYS} days after they're created. The
            board shows how many days are left.
          </Rule>
          <Rule icon={<HardDrive />} title="Saved to your account">
            Your board is saved on our server as you work, so it opens on any device you sign in on.
            Unsaved changes are kept in your browser and sent as soon as you're back online.
          </Rule>
          <Rule icon={<ArrowRight />} title="Private by default">
            Only you can open your board. We store your account id and the board itself, never your
            email or name, and both are gone when the board is deleted.
          </Rule>
        </ul>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section aria-labelledby="cta-title" className="border-b border-border">
      <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-4 py-20 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 id="cta-title" className="text-2xl font-semibold tracking-tight">
            Your next design round starts here
          </h2>
          <p className="mt-2 text-md text-text-muted">
            Free, ready in one click, saved to your account.
          </p>
        </div>
        <Button asChild variant="primary" size="lg">
          <Link to="/new">
            Start a board <ArrowRight />
          </Link>
        </Button>
      </div>
    </section>
  );
}

function SiteFooter() {
  return (
    <footer className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-10 text-sm text-text-muted md:flex-row md:items-center md:justify-between">
      <div className="flex items-center gap-3">
        <Logo />
        <span>Built by Ashutosh Lodha</span>
      </div>
      <div className="flex flex-col gap-2 md:items-end">
        <a
          href={REPO_URL}
          className="inline-flex items-center gap-1.5 rounded-md hover:text-text"
          rel="noreferrer"
        >
          <Code2 className="size-4" aria-hidden="true" /> Source on GitHub
        </a>
        <p>AWS, Google Cloud and Azure icons are trademarks of their respective owners.</p>
      </div>
    </footer>
  );
}
