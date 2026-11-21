import { Button, EmptyState, Skeleton, toast } from '@archboard/ui';
import { Clock, Compass, LogIn, TriangleAlert } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { SignInButton, useAccount } from '../auth/account.tsx';
import {
  ApiError,
  deleteServerBoard,
  getServerBoard,
  loadBoardContent,
  saveBoardContent,
  type ServerBoard,
} from '../auth/boards-api.ts';
import { openOrCreateAccountBoard } from '../auth/migrate.ts';
import { BoardEditor } from '../board/board-editor.tsx';
import {
  BOARD_LIFETIME_DAYS,
  claimBoard,
  deleteBoardData,
  isLocalBoardId,
  purgeExpiredBoard,
  readCurrentBoard,
  type BoardRecord,
} from '../board/local-boards.ts';
import { useBoardDoc, type RemoteSync } from '../board/use-board-doc.ts';

/**
 * /b/:boardId. Two kinds of board:
 *  - account boards (signed in): stored on the server, opened from any device;
 *  - browser-only boards ("local-…"): for visitors who haven't signed in.
 */
export default function BoardPage() {
  const { boardId = '' } = useParams();
  return isLocalBoardId(boardId) ? (
    <LocalBoardRoute key={boardId} boardId={boardId} />
  ) : (
    <AccountBoardRoute key={boardId} boardId={boardId} />
  );
}

// --- Account boards -----------------------------------------------------------------------

type AccountAccess =
  | { state: 'checking' }
  | { state: 'ok'; board: ServerBoard }
  | { state: 'missing' }
  | { state: 'error'; message: string };

function AccountBoardRoute({ boardId }: { boardId: string }) {
  const account = useAccount();
  const [access, setAccess] = useState<AccountAccess>({ state: 'checking' });
  const [attempt, setAttempt] = useState(0);
  const { signedIn, getToken } = account;

  useEffect(() => {
    if (!signedIn) return;
    let alive = true;
    getServerBoard(getToken, boardId).then(
      (board) => alive && setAccess({ state: 'ok', board }),
      (err: unknown) => {
        if (!alive) return;
        if (err instanceof ApiError && err.status === 404) setAccess({ state: 'missing' });
        else setAccess({ state: 'error', message: (err as Error).message });
      },
    );
    return () => {
      alive = false;
    };
  }, [signedIn, getToken, boardId, attempt]);

  if (!account.enabled) return <NotFound />;
  if (!account.loaded) return <BoardSkeleton />;
  if (!signedIn) {
    return (
      <Message
        icon={<LogIn />}
        title="Sign in to open this board"
        description="This board is saved to an ArchBoard account. Sign in with that account to open it."
        action={
          <SignInButton mode="modal">
            <Button variant="primary">Sign in</Button>
          </SignInButton>
        }
      />
    );
  }
  if (access.state === 'checking') return <BoardSkeleton />;
  if (access.state === 'missing') {
    return (
      <Message
        icon={<Clock />}
        title="Board not found"
        description={`It may have been deleted (boards are deleted automatically ${BOARD_LIFETIME_DAYS} days after they're created), or it belongs to a different account.`}
      />
    );
  }
  if (access.state === 'error') {
    return (
      <Message
        icon={<TriangleAlert />}
        title="Couldn't open your board"
        description={access.message}
        action={
          <Button variant="primary" onClick={() => setAttempt((n) => n + 1)}>
            Try again
          </Button>
        }
      />
    );
  }
  return <AccountBoard board={access.board} getToken={getToken} />;
}

function AccountBoard({
  board,
  getToken,
}: {
  board: ServerBoard;
  getToken: () => Promise<string | null>;
}) {
  const remote = useMemo<RemoteSync>(
    () => ({
      load: () => loadBoardContent(getToken, board.id),
      save: (state) => saveBoardContent(getToken, board.id, state),
    }),
    [getToken, board.id],
  );
  const doc = useBoardDoc(board.id, remote);
  const record = useMemo<BoardRecord>(
    () => ({ id: board.id, createdAt: Date.parse(board.createdAt) }),
    [board.id, board.createdAt],
  );
  if (!doc || !doc.ready) return <BoardSkeleton />;
  return (
    <BoardEditor
      board={doc}
      record={record}
      onDeleteBoard={async () => {
        await deleteServerBoard(getToken, board.id);
        await deleteBoardData(board.id);
      }}
    />
  );
}

// --- Browser-only boards ------------------------------------------------------------------

type LocalAccess =
  | { state: 'checking' }
  | { state: 'ok'; record: BoardRecord }
  | { state: 'expired' }
  | { state: 'other' };

function LocalBoardRoute({ boardId }: { boardId: string }) {
  const [access, setAccess] = useState<LocalAccess>({ state: 'checking' });

  useEffect(() => {
    let alive = true;
    void (async () => {
      const current = readCurrentBoard();
      const wasThisBoard = current?.id === boardId;
      const purged = await purgeExpiredBoard();
      if (!alive) return;
      if (purged && wasThisBoard) return setAccess({ state: 'expired' });
      const record = claimBoard(boardId);
      setAccess(record ? { state: 'ok', record } : { state: 'other' });
    })();
    return () => {
      alive = false;
    };
  }, [boardId]);

  if (access.state === 'checking') return <BoardSkeleton />;
  if (access.state === 'expired') {
    return (
      <Message
        icon={<Clock />}
        title="This board was deleted"
        description={`Boards are deleted automatically ${BOARD_LIFETIME_DAYS} days after they're created. You can start a new one any time.`}
      />
    );
  }
  if (access.state === 'other') return <NotFound />;
  return <LocalBoard boardId={boardId} record={access.record} />;
}

function LocalBoard({ boardId, record }: { boardId: string; record: BoardRecord }) {
  const board = useBoardDoc(boardId);
  const account = useAccount();
  const navigate = useNavigate();
  const moving = useRef(false);
  const { signedIn, getToken } = account;
  const ready = Boolean(board?.ready);

  // Signing in moves this browser-only board into the account (if the account has none yet).
  useEffect(() => {
    if (!signedIn || !ready || moving.current) return;
    moving.current = true;
    openOrCreateAccountBoard(getToken).then(
      (result) => {
        if (result.kind === 'created') {
          toast.success('Board saved to your account');
          navigate(`/b/${result.board.id}`, { replace: true });
        } else {
          toast('Your account already has a board', {
            description: 'This one stays on this device. Each person has one board at a time.',
          });
        }
      },
      (err: unknown) => {
        moving.current = false;
        toast.error((err as Error).message);
      },
    );
  }, [signedIn, ready, getToken, navigate]);

  if (!board || !board.ready) return <BoardSkeleton />;
  return <BoardEditor board={board} record={record} />;
}

// --- Shared ---------------------------------------------------------------------------------

function NotFound() {
  return (
    <Message
      icon={<Compass />}
      title="Board not found"
      description="This link doesn't point to your board. Each person has one board at a time."
    />
  );
}

function Message({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-bg-subtle px-4">
      <EmptyState
        headingLevel={1}
        icon={icon}
        title={title}
        description={description}
        action={
          action ?? (
            <Button asChild variant="primary">
              <Link to="/new">Go to my board</Link>
            </Button>
          )
        }
      />
    </main>
  );
}

function BoardSkeleton() {
  return (
    <div className="flex h-dvh flex-col bg-canvas" aria-busy="true" aria-label="Loading board">
      <div className="flex h-12 items-center gap-3 border-b border-border bg-bg px-3">
        <Skeleton className="size-7" />
        <Skeleton className="h-5 w-48" />
      </div>
      <div className="flex flex-1">
        <div className="hidden w-[264px] space-y-3 border-r border-border bg-bg p-3 lg:block">
          <Skeleton className="h-8" />
          <Skeleton className="h-8" />
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-10" />
          ))}
        </div>
      </div>
    </div>
  );
}
