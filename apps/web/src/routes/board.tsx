import { Button, EmptyState, Skeleton } from '@archboard/ui';
import { Clock, Compass } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router';
import { BoardEditor } from '../board/board-editor.tsx';
import {
  BOARD_LIFETIME_DAYS,
  claimBoard,
  isLocalBoardId,
  purgeExpiredBoard,
  readCurrentBoard,
  type BoardRecord,
} from '../board/local-boards.ts';
import { useBoardDoc } from '../board/use-board-doc.ts';

type Access =
  | { state: 'checking' }
  | { state: 'ok'; record: BoardRecord }
  | { state: 'expired' }
  | { state: 'other' };

export default function BoardPage() {
  const { boardId = '' } = useParams();
  const [access, setAccess] = useState<Access>({ state: 'checking' });

  useEffect(() => {
    let alive = true;
    void (async () => {
      const current = readCurrentBoard();
      const wasThisBoard = current?.id === boardId;
      const purged = await purgeExpiredBoard();
      if (!alive) return;
      if (purged && wasThisBoard) return setAccess({ state: 'expired' });
      const record = isLocalBoardId(boardId) ? claimBoard(boardId) : null;
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
  if (access.state === 'other') {
    return (
      <Message
        icon={<Compass />}
        title="Board not found"
        description="This link doesn't point to your board on this device. Each person has one board at a time."
      />
    );
  }
  return <LocalBoard key={boardId} boardId={boardId} record={access.record} />;
}

function Message({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-bg-subtle px-4">
      <EmptyState
        headingLevel={1}
        icon={icon}
        title={title}
        description={description}
        action={
          <Button asChild variant="primary">
            <Link to="/new">Go to my board</Link>
          </Button>
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

function LocalBoard({ boardId, record }: { boardId: string; record: BoardRecord }) {
  const board = useBoardDoc(boardId);
  if (!board || !board.ready) return <BoardSkeleton />;
  return <BoardEditor board={board} record={record} />;
}
