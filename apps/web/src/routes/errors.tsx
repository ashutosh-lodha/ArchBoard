import { Button, EmptyState } from '@archboard/ui';
import { Compass, TriangleAlert } from 'lucide-react';
import { Link, useRouteError } from 'react-router';

export function NotFoundPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-bg-subtle px-4">
      <EmptyState
        icon={<Compass />}
        title="Page not found"
        description="The link may be wrong, or the page may have moved."
        action={
          <Button asChild variant="primary">
            <Link to="/">Go to the home page</Link>
          </Button>
        }
      />
    </main>
  );
}

export function RouteError() {
  const error = useRouteError();
  if (import.meta.env.DEV) console.error(error);
  return (
    <main className="flex min-h-dvh items-center justify-center bg-bg-subtle px-4">
      <EmptyState
        icon={<TriangleAlert />}
        title="Something went wrong"
        description="This page hit an unexpected problem. Reloading usually fixes it."
        action={
          <Button variant="primary" onClick={() => window.location.reload()}>
            Reload page
          </Button>
        }
      />
    </main>
  );
}
