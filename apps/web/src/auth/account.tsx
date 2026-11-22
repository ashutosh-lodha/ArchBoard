import { ClerkProvider, UserButton, useAuth } from '@clerk/react';
import { Button, clerkAppearance } from '@archboard/ui';
import { LogIn } from 'lucide-react';
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';

/**
 * Accounts (Clerk). Signed-in people's boards are stored on our server. Sign-in and sign-up are
 * pages on this site (/sign-in, /sign-up), not a Clerk-hosted portal. Without a publishable key
 * (local development, tests) the app runs in browser-only mode and no account UI is shown.
 */
const PUBLISHABLE_KEY = (import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined) ?? '';
export const accountsEnabled = /^pk_(test|live)_[A-Za-z0-9+/=]{20,}$/.test(PUBLISHABLE_KEY);

export interface Account {
  /** Accounts are configured for this deployment. */
  enabled: boolean;
  /** Clerk has finished loading (always true when accounts are off). */
  loaded: boolean;
  signedIn: boolean;
  /** A fresh session token for API calls (null when signed out). */
  getToken: () => Promise<string | null>;
}

const signedOut: Account = {
  enabled: false,
  loaded: true,
  signedIn: false,
  getToken: async () => null,
};

const AccountContext = createContext<Account>(signedOut);

export function useAccount(): Account {
  return useContext(AccountContext);
}

function ClerkBridge({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const value = useMemo<Account>(
    () => ({
      enabled: true,
      loaded: isLoaded,
      signedIn: Boolean(isSignedIn),
      getToken: () => getToken(),
    }),
    [isLoaded, isSignedIn, getToken],
  );
  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}

export const SIGN_IN_PATH = '/sign-in';
export const SIGN_UP_PATH = '/sign-up';

/** Must render inside the router: Clerk navigates with it, so sign-in steps don't reload the page. */
export function AccountProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  if (!accountsEnabled) {
    return <AccountContext.Provider value={signedOut}>{children}</AccountContext.Provider>;
  }
  return (
    <ClerkProvider
      publishableKey={PUBLISHABLE_KEY}
      appearance={clerkAppearance}
      signInUrl={SIGN_IN_PATH}
      signUpUrl={SIGN_UP_PATH}
      signInFallbackRedirectUrl="/new"
      signUpFallbackRedirectUrl="/new"
      afterSignOutUrl="/"
      routerPush={(to) => navigate(to)}
      routerReplace={(to) => navigate(to, { replace: true })}
    >
      <ClerkBridge>{children}</ClerkBridge>
    </ClerkProvider>
  );
}

/** "Sign in" when signed out, the user menu when signed in, nothing while loading or disabled. */
export function AccountButton({ compact = false }: { compact?: boolean }) {
  const account = useAccount();
  if (!account.enabled || !account.loaded) return null;
  if (account.signedIn) {
    return <UserButton appearance={{ elements: { avatarBox: { width: 28, height: 28 } } }} />;
  }
  return (
    <Button asChild variant="secondary" size="sm">
      <SignInLink>
        <LogIn /> {compact ? 'Sign in' : 'Sign in to save'}
      </SignInLink>
    </Button>
  );
}

/** A link to the sign-in page that comes back to the current page afterwards. */
export function SignInLink({ children, ...props }: { children: ReactNode; className?: string }) {
  const { pathname, search } = useLocation();
  const back = pathname === '/' || pathname.startsWith('/sign-') ? null : pathname + search;
  const to = back ? `${SIGN_IN_PATH}?redirect_url=${encodeURIComponent(back)}` : SIGN_IN_PATH;
  return (
    <Link to={to} {...props}>
      {children}
    </Link>
  );
}
