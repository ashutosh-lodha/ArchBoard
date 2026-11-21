import { Badge, Button } from '@archboard/ui';
import { Link } from 'react-router';

/**
 * Placeholder home page for Phase 1. The real landing page (live demo board, prerendered,
 * OG image) is built in Phase 5; the editor arrives in Phase 2.
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
      <div className="flex flex-wrap gap-3">
        <Button variant="primary" size="lg" disabled>
          Start a board (coming in Phase 2)
        </Button>
        {import.meta.env.DEV ? (
          <Button asChild size="lg">
            <Link to="/dev/ui">Open the design system</Link>
          </Button>
        ) : null}
      </div>
    </main>
  );
}
