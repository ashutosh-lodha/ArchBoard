import { Button, ConfirmDialog, EmptyState, Skeleton } from '@archboard/ui';
import { LayoutDashboard } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import {
  BOARD_LIFETIME_DAYS,
  createBoard,
  daysLeft,
  deleteCurrentBoard,
  purgeExpiredBoard,
  readCurrentBoard,
  type BoardRecord,
} from '../board/local-boards.ts';

/**
 * /new: one board per person at a time. If you already have a live board, offer to open it or
 * replace it (with confirmation); otherwise start a fresh one immediately.
 */
export function NewBoardPage() {
  const navigate = useNavigate();
  const [existing, setExisting] = useState<BoardRecord | null | undefined>(undefined);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    void purgeExpiredBoard().then(() => {
      if (!alive) return;
      const rec = readCurrentBoard();
      if (rec) setExisting(rec);
      else navigate(`/b/${createBoard().id}`, { replace: true });
    });
    return () => {
      alive = false;
    };
  }, [navigate]);

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
        description="Everything on your current board will be permanently deleted. This can't be undone. Export it first if you want to keep a copy."
        confirmLabel="Delete and start new"
        onConfirm={() => {
          void deleteCurrentBoard().then(() =>
            navigate(`/b/${createBoard().id}`, { replace: true }),
          );
        }}
      />
    </main>
  );
}
