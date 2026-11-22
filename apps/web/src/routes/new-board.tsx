import { Button, ConfirmDialog, EmptyState, Skeleton, toast } from '@archboard/ui';
import { LayoutDashboard, LogIn, TriangleAlert } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';
import { SignInButton, useAccount } from '../auth/account.tsx';
import {
  createServerBoard,
  deleteServerBoard,
  openOrCreateAccountBoard,
} from '../auth/boards-api.ts';
import {
  BOARD_LIFETIME_DAYS,
  createBoard,
  daysLeft,
  deleteBoardData,
  deleteCurrentBoard,
  purgeExpiredBoard,
  readCurrentBoard,
} from '../board/local-boards.ts';

interface Existing {
  id: string;
  createdAt: number;
  /** Delete it for good. */
  remove: () => Promise<void>;
  /** Start a fresh board after deleting; returns its id. */
  startNew: () => Promise<string>;
}

/**
 * /new: one board per account. Signed in, open your board (creating it the first time); if you
 * already have one, offer to open it or replace it. Signed out, sign in first. Without Clerk
 * configured (local development, tests) the board lives in this browser instead.
 */
export function NewBoardPage() {
  const account = useAccount();
  const navigate = useNavigate();
  const [existing, setExisting] = useState<Existing | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { enabled, loaded, signedIn, getToken } = account;

  useEffect(() => {
    if (!loaded || (enabled && !signedIn)) return;
    let alive = true;

    if (enabled) {
      openOrCreateAccountBoard(getToken).then(
        ({ board, created }) => {
          if (!alive) return;
          if (created) return navigate(`/b/${board.id}`, { replace: true });
          setExisting({
            id: board.id,
            createdAt: Date.parse(board.createdAt),
            remove: async () => {
              await deleteServerBoard(getToken, board.id);
              await deleteBoardData(board.id);
            },
            startNew: async () => (await createServerBoard(getToken)).id,
          });
        },
        (err: unknown) => {
          if (alive) setError((err as Error).message);
        },
      );
    } else {
      void purgeExpiredBoard().then(() => {
        if (!alive) return;
        const rec = readCurrentBoard();
        if (!rec) return navigate(`/b/${createBoard().id}`, { replace: true });
        setExisting({ ...rec, remove: deleteCurrentBoard, startNew: async () => createBoard().id });
      });
    }
    return () => {
      alive = false;
    };
  }, [enabled, loaded, signedIn, getToken, navigate, attempt]);

  if (enabled && loaded && !signedIn) {
    return (
      <Centered>
        <EmptyState
          headingLevel={1}
          icon={<LogIn />}
          title="Sign in to start your board"
          description={`Your board is saved to your account, so it opens on any device. One board per account, deleted automatically ${BOARD_LIFETIME_DAYS} days after it's created.`}
          action={
            <SignInButton mode="modal">
              <Button variant="primary">Sign in</Button>
            </SignInButton>
          }
        />
      </Centered>
    );
  }

  if (error) {
    return (
      <Centered>
        <EmptyState
          headingLevel={1}
          icon={<TriangleAlert />}
          title="Couldn't open your board"
          description={error}
          action={
            <Button
              variant="primary"
              onClick={() => {
                setError(null);
                setAttempt((n) => n + 1);
              }}
            >
              Try again
            </Button>
          }
        />
      </Centered>
    );
  }

  if (!existing) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-bg-subtle" aria-busy="true">
        <Skeleton className="h-40 w-80" />
      </main>
    );
  }

  const left = daysLeft(existing);
  return (
    <Centered>
      <EmptyState
        headingLevel={1}
        icon={<LayoutDashboard />}
        title="You already have a board"
        description={
          <>
            Each account can have one board at a time, and boards are deleted automatically{' '}
            {BOARD_LIFETIME_DAYS} days after they're created. Yours will be deleted{' '}
            {left === 0 ? 'today' : `in ${left} day${left === 1 ? '' : 's'}`}.
          </>
        }
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <Button asChild variant="primary">
              <Link to={`/b/${existing.id}`}>Open my board</Link>
            </Button>
            <Button variant="danger" onClick={() => setConfirmOpen(true)}>
              Delete it and start over
            </Button>
          </div>
        }
      />
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Delete your board and start a new one?"
        description="Everything on your current board will be permanently deleted. This can't be undone."
        confirmLabel="Delete and start new"
        onConfirm={() => {
          void existing
            .remove()
            .then(existing.startNew)
            .then(
              (id) => navigate(`/b/${id}`, { replace: true }),
              (err: unknown) => toast.error((err as Error).message),
            );
        }}
      />
    </Centered>
  );
}

function Centered({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-bg-subtle px-4">{children}</main>
  );
}
