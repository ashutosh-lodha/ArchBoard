/**
 * Client for the board API (apps/api/src/boards/routes.ts). Every call sends the Clerk session
 * token; errors carry the server's human-readable message (problem+json "title").
 */
export interface ServerBoard {
  id: string;
  title: string;
  createdAt: string;
  expiresAt: string;
  updatedAt: string;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

type GetToken = () => Promise<string | null>;

async function call(getToken: GetToken, path: string, init: RequestInit = {}): Promise<Response> {
  const token = await getToken();
  if (!token) throw new ApiError(401, 'Sign in to save boards to your account.');
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      ...init,
      headers: { ...init.headers, Authorization: `Bearer ${token}` },
    });
  } catch {
    throw new ApiError(0, "Can't reach ArchBoard. Check your connection.");
  }
  if (!res.ok) {
    let message = 'Something went wrong on our side. Please try again.';
    try {
      const body = (await res.json()) as { title?: string };
      if (body.title) message = body.title;
    } catch {
      /* not JSON */
    }
    throw new ApiError(res.status, message);
  }
  return res;
}

const binary = (body: Uint8Array): RequestInit => ({
  body: new Blob([new Uint8Array(body)], { type: 'application/octet-stream' }),
  headers: { 'Content-Type': 'application/octet-stream' },
});

export async function getMyBoard(getToken: GetToken): Promise<ServerBoard | null> {
  const res = await call(getToken, '/me/board');
  return ((await res.json()) as { board: ServerBoard | null }).board;
}

export async function createServerBoard(
  getToken: GetToken,
  content?: Uint8Array,
): Promise<ServerBoard> {
  const res = await call(getToken, '/boards', {
    method: 'POST',
    ...(content ? binary(content) : {}),
  });
  return ((await res.json()) as { board: ServerBoard }).board;
}

export async function getServerBoard(getToken: GetToken, id: string): Promise<ServerBoard> {
  const res = await call(getToken, `/boards/${encodeURIComponent(id)}`);
  return ((await res.json()) as { board: ServerBoard }).board;
}

export async function loadBoardContent(getToken: GetToken, id: string): Promise<Uint8Array> {
  const res = await call(getToken, `/boards/${encodeURIComponent(id)}/content`);
  return new Uint8Array(await res.arrayBuffer());
}

export async function saveBoardContent(
  getToken: GetToken,
  id: string,
  update: Uint8Array,
): Promise<void> {
  await call(getToken, `/boards/${encodeURIComponent(id)}/content`, {
    method: 'PUT',
    ...binary(update),
  });
}

export async function deleteServerBoard(getToken: GetToken, id: string): Promise<void> {
  await call(getToken, `/boards/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

/** The signed-in person's board, created on first use (one board per account). */
export async function openOrCreateAccountBoard(
  getToken: GetToken,
): Promise<{ board: ServerBoard; created: boolean }> {
  const existing = await getMyBoard(getToken);
  if (existing) return { board: existing, created: false };
  try {
    return { board: await createServerBoard(getToken), created: true };
  } catch (err) {
    // A duplicate request (another tab, a double click) created it a moment ago: use that one.
    if (!(err instanceof ApiError) || err.status !== 409) throw err;
    const board = await getMyBoard(getToken);
    if (!board) throw err;
    return { board, created: Date.now() - Date.parse(board.createdAt) < 30_000 };
  }
}
