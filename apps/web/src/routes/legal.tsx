import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { BOARD_LIFETIME_DAYS } from '../board/local-boards.ts';

const REPO_URL = 'https://github.com/ashutosh-lodha/ArchBoard';
const UPDATED = '22 November 2026';

function LegalLayout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-bg text-text">
      <header className="border-b border-border">
        <div className="mx-auto flex h-14 max-w-3xl items-center px-4">
          <Link
            to="/"
            className="flex items-center gap-2 rounded-md font-semibold"
            aria-label="ArchBoard home"
          >
            <img src="/favicon.svg" alt="" width={28} height={28} className="size-7" />
            <span className="text-md">ArchBoard</span>
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-text-muted">Last updated {UPDATED}</p>
        <div className="mt-8 space-y-6 text-base leading-7 text-text-muted [&_h2]:mt-10 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-text [&_a]:text-accent [&_a]:underline [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5">
          {children}
        </div>
      </main>
    </div>
  );
}

function Contact() {
  return (
    <p>
      Questions or requests: open an issue on <a href={`${REPO_URL}/issues`}>GitHub</a>.
    </p>
  );
}

export function PrivacyPage() {
  return (
    <LegalLayout title="Privacy policy">
      <p>
        ArchBoard is a free board for practising system design. This page explains what it stores
        and why. The short version: your account, your one board, and nothing else.
      </p>

      <h2>What we store</h2>
      <ul>
        <li>
          <strong>Your account.</strong> Sign-in is handled by Clerk. When you sign up with email or
          Google, Clerk keeps your email address and, if you use Google, your name and profile
          picture. We receive only an account id from Clerk.
        </li>
        <li>
          <strong>Your board.</strong> The board content, its title, and when it was created and
          last changed, stored against your account id on our server in India (Google Cloud,
          Mumbai).
        </li>
        <li>
          <strong>Server logs.</strong> Standard request logs (IP address, time, page) kept for up
          to 14 days to run and secure the service.
        </li>
      </ul>

      <h2>What we don't do</h2>
      <ul>
        <li>No advertising, no analytics or tracking scripts, no selling or sharing of data.</li>
        <li>We don't read your boards, except if needed to fix a problem you report.</li>
        <li>Google sign-in is used only to confirm who you are; we don't access anything else.</li>
      </ul>

      <h2>How long we keep it</h2>
      <p>
        Boards are deleted automatically {BOARD_LIFETIME_DAYS} days after they're created, or
        earlier if you delete them. Daily disk snapshots are kept for 7 days, so a deleted board is
        fully gone within about two weeks. You can delete your board at any time from the board
        menu, and your account from the account menu (Manage account), which removes it from Clerk.
      </p>

      <h2>Cookies and browser storage</h2>
      <p>
        Clerk sets cookies needed to keep you signed in. The app keeps a copy of your board in your
        browser (IndexedDB) so it works offline, and remembers your light or dark theme.
      </p>

      <h2>Service providers</h2>
      <ul>
        <li>Clerk (sign-in and accounts)</li>
        <li>Google Cloud (hosting and storage)</li>
        <li>Google (only if you choose "Continue with Google")</li>
      </ul>

      <Contact />
    </LegalLayout>
  );
}

export function TermsPage() {
  return (
    <LegalLayout title="Terms of service">
      <p>By using ArchBoard you agree to these terms.</p>

      <h2>The service</h2>
      <ul>
        <li>ArchBoard is free and provided as is, without warranties of any kind.</li>
        <li>
          Each account has one board at a time, deleted automatically {BOARD_LIFETIME_DAYS} days
          after it's created. Export anything you want to keep.
        </li>
        <li>The service may change, be unavailable, or stop at any time.</li>
      </ul>

      <h2>Your content</h2>
      <p>
        You own what you put on your board. You give us permission to store and display it to you
        only so the service works. Don't upload anything illegal, harmful, or that you don't have
        the right to use.
      </p>

      <h2>Acceptable use</h2>
      <p>
        Don't attempt to break, overload, or get unauthorised access to the service or other
        people's boards. Accounts that abuse the service may be removed.
      </p>

      <h2>Liability</h2>
      <p>
        To the extent allowed by law, ArchBoard and its author are not liable for any loss of data
        or other damages arising from use of the service.
      </p>

      <h2>Trademarks</h2>
      <p>
        AWS, Google Cloud and Azure icons are trademarks of their respective owners and are used
        under their published guidelines.
      </p>

      <Contact />
    </LegalLayout>
  );
}
