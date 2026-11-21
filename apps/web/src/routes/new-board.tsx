import { Button, ConfirmDialog, EmptyState, Skeleton, toast } from '@archboard/ui';
import { LayoutDashboard, TriangleAlert } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useAccount } from '../auth/account.tsx';
import { createServerBoard, deleteServerBoard, type ServerBoard } from '../auth/boards-api.ts';
import { openOrCreateAccountBoard } from '../auth/migrate.ts';
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
  /** Delete it for good (account or browser). */
  remove: () => Promise<void>;
  /** Start a fresh board after deleting; returns its id. */
  startNew: () => Promise<string>;
}

/**
 * /new: one board per person at a time. Signed in, the board lives in your account (a board
 * already in this browser is moved into it); signed out, it lives in this browser. If you already
 * have a live board, offer to open it or replace it (with confirmation).
 */
export function NewBoardPage() {
  const account = useAccount();
  const navigate = useNavigate();
  const [existing, setExisting] = useState<Existing | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const started = useRef(false);
  const { loaded, signedIn, getToken } = account;

  useEffect(() => {
    if (!loaded || started.current) return;
    started.current = true;
    let alive = true;

    if (signedIn) {
      openOrCreateAccountBoard(getToken).then(
        (result) => {
          if (!alive) return;
          if (result.kind === 'created') {
            if (result.imported) toast.success('Board saved to your account');
            navigate(`/b/${result.board.id}`, { replace: true });
            return;
          }
          const board: ServerBoard = result.board;
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
          started.current = false;
          if (alive) setError((err as Error).message);
        },
      );
    } else {
      void purgeExpiredBoard().then(() => {
        if (!alive) return;
        const rec = readCurrentBoard();
        if (!rec) return navigate(`/b/${createBoard().id}`, { replace: true });
        setExisting({
          ...rec,
          remove: deleteCurrentBoard,
          startNew: async () => createBoard().id,
        });
      });
    }
    return () => {
      alive = false;
    };
  }, [loaded, signedIn, getToken, navigate, attempt]);

  if (error) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-bg-subtle px-4">
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
      </main>
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
    <main className="flex min-h-dvh items-center justify-center bg-bg-subtle px-4">
      <EmptyState
        headingLevel={1}
        icon={<LayoutDashboard />}
        title="You already have a board"
        description={
          <>
            Each person can have one board at a time, and boards are deleted automatically{' '}
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
    </main>
  );
}
