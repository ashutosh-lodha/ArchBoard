import type { z } from 'zod';
import { DiagramV1Shape, type DiagramV1 } from './schema.ts';

export interface DiagramIssue {
  /** JSON path such as "edges[2].target". */
  path: string;
  /** Human-readable message suitable for showing in the import dialog. */
  message: string;
}

export type ValidationResult =
  { ok: true; diagram: DiagramV1 } | { ok: false; issues: DiagramIssue[] };

export interface ValidateOptions {
  /** Returns true if the icon id exists in the registry. Omit to skip the check. */
  iconExists?: (iconId: string) => boolean;
}

function formatPath(path: ReadonlyArray<PropertyKey>): string {
  let out = '';
  for (const part of path) {
    if (typeof part === 'number') out += `[${part}]`;
    else out += out ? `.${String(part)}` : String(part);
  }
  return out || '(root)';
}

function zodIssues(error: z.ZodError): DiagramIssue[] {
  return error.issues.map((issue) => ({ path: formatPath(issue.path), message: issue.message }));
}

/**
 * Cross-field rules the structural schema cannot express. Returns issues instead of throwing so
 * an import can show every problem at once.
 */
export function checkIntegrity(diagram: DiagramV1, options: ValidateOptions = {}): DiagramIssue[] {
  const issues: DiagramIssue[] = [];
  const nodeIndex = new Map<string, number>();
  const seenIds = new Map<string, string>();

  diagram.nodes.forEach((node, i) => {
    const previous = seenIds.get(node.id);
    if (previous) {
      issues.push({
        path: `nodes[${i}].id`,
        message: `Id "${node.id}" is already used by ${previous}.`,
      });
    } else {
      seenIds.set(node.id, `node ${i + 1}`);
      nodeIndex.set(node.id, i);
    }
    if (node.kind === 'component' && options.iconExists && !options.iconExists(node.iconId)) {
      issues.push({
        path: `nodes[${i}].iconId`,
        message: `Node ${i + 1} ("${node.label}") uses an unknown icon "${node.iconId}".`,
      });
    }
  });

  diagram.nodes.forEach((node, i) => {
    if (node.parentId === undefined) return;
    const parentIdx = nodeIndex.get(node.parentId);
    if (parentIdx === undefined) {
      issues.push({
        path: `nodes[${i}].parentId`,
        message: `Node ${i + 1} is inside a missing group "${node.parentId}".`,
      });
      return;
    }
    if (diagram.nodes[parentIdx]?.kind !== 'group') {
      issues.push({
        path: `nodes[${i}].parentId`,
        message: `Node ${i + 1} is inside "${node.parentId}", which is not a group.`,
      });
    }
  });

  // Parent cycles: walk up from every node; a walk longer than the node count is a cycle.
  const parentOf = new Map(diagram.nodes.map((n) => [n.id, n.parentId]));
  diagram.nodes.forEach((node, i) => {
    let current = node.parentId;
    let steps = 0;
    while (current !== undefined && steps <= diagram.nodes.length) {
      if (current === node.id) {
        issues.push({
          path: `nodes[${i}].parentId`,
          message: `Group nesting loops back to "${node.id}".`,
        });
        break;
      }
      current = parentOf.get(current);
      steps++;
    }
  });

  diagram.edges.forEach((edge, i) => {
    const previous = seenIds.get(edge.id);
    if (previous) {
      issues.push({
        path: `edges[${i}].id`,
        message: `Id "${edge.id}" is already used by ${previous}.`,
      });
    } else {
      seenIds.set(edge.id, `edge ${i + 1}`);
    }
    for (const end of ['source', 'target'] as const) {
      if (!nodeIndex.has(edge[end])) {
        issues.push({
          path: `edges[${i}].${end}`,
          message: `Edge ${i + 1} points to a missing node "${edge[end]}".`,
        });
      }
    }
    if (edge.source === edge.target) {
      issues.push({ path: `edges[${i}]`, message: `Edge ${i + 1} connects a node to itself.` });
    }
  });

  return issues;
}

/** Parse unknown input (an imported file, a template, AI output) into a valid DiagramV1. */
export function validateDiagram(input: unknown, options: ValidateOptions = {}): ValidationResult {
  const parsed = DiagramV1Shape.safeParse(input);
  if (!parsed.success) return { ok: false, issues: zodIssues(parsed.error) };
  const issues = checkIntegrity(parsed.data, options);
  return issues.length ? { ok: false, issues } : { ok: true, diagram: parsed.data };
}

/** Like validateDiagram but throws; for trusted inputs such as built-in templates and tests. */
export function parseDiagram(input: unknown, options: ValidateOptions = {}): DiagramV1 {
  const result = validateDiagram(input, options);
  if (!result.ok) {
    const lines = result.issues.map((i) => `  ${i.path}: ${i.message}`).join('\n');
    throw new Error(`Invalid diagram:\n${lines}`);
  }
  return result.diagram;
}
