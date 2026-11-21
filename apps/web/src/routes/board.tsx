import { Button, EmptyState, Skeleton } from '@archboard/ui';
import { Compass } from 'lucide-react';
import { useEffect } from 'react';
import { Link, useParams } from 'react-router';
import { BoardEditor } from '../board/board-editor.tsx';
import { isLocalBoardId, rememberLocalBoard } from '../board/local-boards.ts';
import { useBoardDoc } from '../board/use-board-doc.ts';

export default function BoardPage() {
  const { boardId = '' } = useParams();
  if (!isLocalBoardId(boardId)) {
    // Server boards arrive with sign-in (Phase 3).
    return (
      <main className="flex min-h-dvh items-center justify-center bg-bg-subtle px-4">
        <EmptyState
          headingLevel={1}
          icon={<Compass />}
          title="Board not found"
          description="This link doesn't point to a board on this device."
          action={
            <Button asChild variant="primary">
              <Link to="/new">Start a new board</Link>
            </Button>
          }
        />
      </main>
    );
  }
  return <LocalBoard key={boardId} boardId={boardId} />;
}

function LocalBoard({ boardId }: { boardId: string }) {
  const board = useBoardDoc(boardId);
  useEffect(() => rememberLocalBoard(boardId), [boardId]);

  if (!board || !board.ready) {
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
  return <BoardEditor board={board} />;
}
