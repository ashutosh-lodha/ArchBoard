import { customAlphabet } from 'nanoid';

/** URL-safe, unambiguous alphabet (no 0/O, 1/l/I). */
const alphabet = '23456789abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ';

/** 10 chars ≈ 57 bits: plenty for ids that only need to be unique within one diagram. */
export const newNodeId = customAlphabet(alphabet, 10);

/** 22 chars ≈ 128 bits: unguessable invite codes. */
export const newSecretCode = customAlphabet(alphabet, 22);
