import { ThemeProvider, Toaster, TooltipProvider, useTheme } from '@archboard/ui';
import { lazy, Suspense, useSyncExternalStore } from 'react';
import { createBrowserRouter, type RouteObject } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { AccountProvider } from './auth/account.tsx';
import { HomePage } from './routes/home.tsx';
import { NotFoundPage, RouteError } from './routes/errors.tsx';
import { NewBoardPage } from './routes/new-board.tsx';

const GalleryPage = lazy(() => import('./routes/gallery.tsx'));
// The editor (React Flow, Yjs) is its own chunk so the home page stays light.
const BoardPage = lazy(() => import('./routes/board.tsx'));

const routes: RouteObject[] = [
  { path: '/', element: <HomePage />, errorElement: <RouteError /> },
  { path: '/new', element: <NewBoardPage />, errorElement: <RouteError /> },
  {
    path: '/b/:boardId',
    element: (
      <Suspense fallback={<div className="h-dvh bg-canvas" aria-busy="true" />}>
        <BoardPage />
      </Suspense>
    ),
    errorElement: <RouteError />,
  },
  // Design-system gallery: development builds only (used for visual regression + axe).
  ...(import.meta.env.DEV
    ? [
        {
          path: '/dev/ui',
          element: (
            <Suspense fallback={null}>
              <GalleryPage />
            </Suspense>
          ),
          errorElement: <RouteError />,
        },
      ]
    : []),
  { path: '*', element: <NotFoundPage /> },
];

const router = createBrowserRouter(routes);

function ThemedToaster() {
  const { resolved } = useTheme();
  // Board pages have a floating toolbar at the bottom; keep toasts clear of it.
  const onBoard = useSyncExternalStore(
    (cb) => router.subscribe(cb),
    () => router.state.location.pathname.startsWith('/b/'),
  );
  return <Toaster theme={resolved} bottomOffset={onBoard ? 76 : 24} />;
}

export function App() {
  return (
    <ThemeProvider>
      <AccountProvider>
        <TooltipProvider delayDuration={400} skipDelayDuration={200}>
          <RouterProvider router={router} />
          <ThemedToaster />
        </TooltipProvider>
      </AccountProvider>
    </ThemeProvider>
  );
}
