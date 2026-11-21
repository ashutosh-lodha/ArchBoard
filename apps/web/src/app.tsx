import { ThemeProvider, Toaster, TooltipProvider } from '@archboard/ui';
import { lazy, Suspense } from 'react';
import { createBrowserRouter, type RouteObject } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { HomePage } from './routes/home.tsx';
import { NotFoundPage, RouteError } from './routes/errors.tsx';

const GalleryPage = lazy(() => import('./routes/gallery.tsx'));

const routes: RouteObject[] = [
  { path: '/', element: <HomePage />, errorElement: <RouteError /> },
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

export function App() {
  return (
    <ThemeProvider>
      <TooltipProvider delayDuration={400} skipDelayDuration={200}>
        <RouterProvider router={router} />
        <Toaster />
      </TooltipProvider>
    </ThemeProvider>
  );
}
