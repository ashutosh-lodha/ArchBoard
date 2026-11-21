import { Navigate } from 'react-router';
import { newLocalBoardId } from '../board/local-boards.ts';

/** /new → a fresh local board (no sign-in needed). Templates join this flow in Phase 5. */
export function NewBoardPage() {
  return <Navigate to={`/b/${newLocalBoardId()}`} replace />;
}
