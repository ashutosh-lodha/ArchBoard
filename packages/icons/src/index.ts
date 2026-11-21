export * from './types.ts';
export {
  GENERIC_ICONS,
  genericEntries,
  svgDocument,
  type GenericIcon,
  type GenericCategory,
} from './generic.ts';
export {
  createIconSearch,
  normalise,
  type IconSearch,
  type SearchHit,
  type SearchOptions,
} from './search.ts';
export { aliasesFor, slugify, titleCase } from './normalise.ts';
