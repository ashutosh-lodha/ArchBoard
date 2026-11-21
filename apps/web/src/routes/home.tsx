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
import { BOARD_LIFETIME_DAYS } from '../board/local-boards.ts';

const REPO_URL = 'https://github.com/ashutosh-lodha/ArchBoard';

/**
 * Landing page. Every claim here describes something that works today; planned features are
 * listed separately under "On the roadmap". No testimonials, logos or usage numbers.
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
        <Roadmap />
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
            ['#roadmap', 'Roadmap'],
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
    <section className="relative overflow-hidden border-b border-border bg-[radial-gradient(ellipse_at_top,var(--accent-subtle),transparent_60%)]">
      <div className="mx-auto max-w-6xl px-4 pb-12 pt-14 sm:pt-20">
        <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-sm text-text-muted">
          <span className="size-1.5 rounded-full bg-success" aria-hidden="true" /> Free · no sign-up
          needed
        </p>
        <h1 className="max-w-3xl text-display font-bold tracking-tight">
          The whiteboard built for system design interviews
        </h1>
        <p className="mt-5 max-w-2xl text-md text-text-muted sm:text-lg sm:leading-8">
          Drag in real AWS, Google Cloud and Azure components, wire them up, group them into regions
          and VPCs, and size the system with a built-in capacity calculator. All in your browser.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Button asChild variant="primary" size="lg">
            <Link to="/new">
              Start a board <ArrowRight />
            </Link>
          </Button>
          <Button asChild variant="ghost" size="lg">
            <a href="#how">How it works</a>
          </Button>
        </div>
        <p className="mt-4 text-sm text-text-muted">
          One board per person · deleted after {BOARD_LIFETIME_DAYS} days · saved in your browser
        </p>
      </div>
      <div className="mx-auto max-w-6xl px-4 pb-16">
        <figure className="overflow-hidden rounded-xl border border-border bg-surface shadow-e3">
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
      body: 'One click. No account, no setup. Your board opens with a hint so you never face a blank canvas.',
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
          <Rule icon={<UserRound />} title="One board per person">
            You can have one board at a time. Starting another means deleting the current one first,
            and you'll always be asked before anything is deleted.
          </Rule>
          <Rule icon={<Clock />} title={`Deleted after ${BOARD_LIFETIME_DAYS} days`}>
            Boards are deleted automatically {BOARD_LIFETIME_DAYS} days after they're created. The
            board shows how many days are left.
          </Rule>
          <Rule icon={<HardDrive />} title="Saved in your browser">
            Your board is stored on this device, not uploaded. Clearing your browser's site data
            also deletes it, and it won't appear on other devices.
          </Rule>
          <Rule icon={<ArrowRight />} title="No account needed">
            Just start drawing. Sign-in will only be needed for sharing a board with someone else,
            once that ships.
          </Rule>
        </ul>
      </div>
    </section>
  );
}

function Roadmap() {
  const items = [
    [
      'Pass the pen',
      'Live sessions where one person presents and everyone else watches, comments and points.',
    ],
    [
      'Interview mode',
      'A phased timer, a requirements checklist and roles for interviewer and candidate.',
    ],
    ['Session replay', 'Scrub through how a design evolved, with markers for each phase.'],
    [
      'Templates',
      'Polished starting points for classic problems: chat, news feed, ride sharing and more.',
    ],
    ['Export', 'PNG and SVG images for blogs and resumes, plus JSON import and export.'],
    [
      'Generate with AI',
      'Describe a system in a sentence and get an editable diagram to start from.',
    ],
  ];
  return (
    <section
      id="roadmap"
      aria-labelledby="roadmap-title"
      className="scroll-mt-16 border-b border-border bg-bg-subtle"
    >
      <div className="mx-auto max-w-6xl px-4 py-20">
        <SectionHeading
          id="roadmap-title"
          eyebrow="On the roadmap"
          title="What's coming next"
          intro="Not built yet. Listed so you know where this is going."
        />
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map(([title, body]) => (
            <li key={title} className="rounded-xl border border-dashed border-border-strong p-5">
              <p className="mb-2 inline-block rounded-sm bg-bg px-1.5 py-0.5 text-xs font-semibold text-text-muted">
                Coming soon
              </p>
              <h3 className="font-semibold">{title}</h3>
              <p className="mt-1 text-base text-text-muted">{body}</p>
            </li>
          ))}
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
          <p className="mt-2 text-md text-text-muted">Free, in your browser, ready in one click.</p>
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
