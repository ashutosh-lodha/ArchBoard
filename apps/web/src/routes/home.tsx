import { Badge, Button } from '@archboard/ui';
import { Link } from 'react-router';

/**
 * Placeholder home page. The real landing page (live demo board, prerendered, OG image) is
 * built in Phase 5.
 */
export function HomePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col justify-center gap-6 px-4 py-16">
      <Badge tone="pen" className="self-start">
        In development
      </Badge>
      <h1 className="text-display font-bold tracking-tight">
        Whiteboard system design,
        <br />
        one pen at a time.
      </h1>
      <p className="max-w-xl text-md text-text-muted">
        Draw architectures with real AWS, Google Cloud and Azure icons. Pass the pen, run the
        interview timer, and replay how the design evolved.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <Button asChild variant="primary" size="lg">
          <Link to="/new">Start a board</Link>
        </Button>
        <span className="text-sm text-text-muted">No sign-up needed to try.</span>
      </div>
    </main>
  );
}
