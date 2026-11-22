import { SignIn, SignUp } from '@clerk/react';
import { Navigate, Link } from 'react-router';
import type { ReactNode } from 'react';
import { accountsEnabled, SIGN_IN_PATH, SIGN_UP_PATH } from '../auth/account.tsx';

/** Sign-in and sign-up live on this site, rendered by Clerk's components with our theme. */
function AuthLayout({ children }: { children: ReactNode }) {
  if (!accountsEnabled) return <Navigate to="/" replace />;
  return (
    <div className="flex min-h-dvh flex-col bg-bg-subtle text-text">
      <header className="mx-auto flex h-14 w-full max-w-6xl items-center px-4">
        <Link
          to="/"
          className="flex items-center gap-2 rounded-md font-semibold"
          aria-label="ArchBoard home"
        >
          <img src="/favicon.svg" alt="" width={28} height={28} className="size-7" />
          <span className="text-md">ArchBoard</span>
        </Link>
      </header>
      <main className="flex flex-1 items-start justify-center px-4 pb-16 pt-6 sm:items-center sm:pt-0">
        {children}
      </main>
    </div>
  );
}

export function SignInPage() {
  return (
    <AuthLayout>
      <SignIn routing="path" path={SIGN_IN_PATH} signUpUrl={SIGN_UP_PATH} />
    </AuthLayout>
  );
}

export function SignUpPage() {
  return (
    <AuthLayout>
      <SignUp routing="path" path={SIGN_UP_PATH} signInUrl={SIGN_IN_PATH} />
    </AuthLayout>
  );
}
