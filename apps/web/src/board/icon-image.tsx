import { memo } from 'react';
import { cn } from '@archboard/ui';
import { GENERIC_BODY } from './registry.ts';

/** Category tints for generic icons (vendor icons keep their own brand colours). */
const GENERIC_TINT: Record<string, string> = {
  Clients: 'bg-[#e8f1fb] text-[#1f5fa8] dark:bg-[#15263a] dark:text-[#8cbcf0]',
  Networking: 'bg-[#efeafd] text-[#5b3fc4] dark:bg-[#231c3d] dark:text-[#b4a2f5]',
  Compute: 'bg-accent-subtle text-accent',
  Data: 'bg-[#e6f4ef] text-[#17734f] dark:bg-[#12291f] dark:text-[#6fd3a6]',
  Messaging: 'bg-[#fdf0e3] text-[#9a4f00] dark:bg-[#2e2210] dark:text-[#f5b45a]',
  Operations: 'bg-[#f1f3f6] text-[#4a5260] dark:bg-[#242830] dark:text-[#b7bec9]',
};

export interface IconImageProps {
  iconId: string;
  svgPath?: string | undefined;
  category?: string | undefined;
  size?: 'sm' | 'md';
  className?: string;
}

/**
 * Generic icons render inline (so they follow the theme); vendor icons render as images in their
 * official colours, unmodified, as their terms require.
 */
export const IconImage = memo(function IconImage({
  iconId,
  svgPath,
  category,
  size = 'md',
  className,
}: IconImageProps) {
  const box = size === 'sm' ? 'size-7 rounded-md' : 'size-9 rounded-lg';
  const body = GENERIC_BODY.get(iconId);
  if (body) {
    return (
      <span
        className={cn(
          'flex shrink-0 items-center justify-center',
          box,
          GENERIC_TINT[category ?? ''] ?? GENERIC_TINT.Compute,
          className,
        )}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.75}
          strokeLinecap="round"
          strokeLinejoin="round"
          className={size === 'sm' ? 'size-4' : 'size-5'}
          aria-hidden="true"
          // Trusted, static markup from our own icon set.
          dangerouslySetInnerHTML={{ __html: body }}
        />
      </span>
    );
  }
  return (
    <span className={cn('flex shrink-0 items-center justify-center', box, className)}>
      <img
        src={svgPath ?? `/icons/${iconId}.svg`}
        alt=""
        draggable={false}
        loading="lazy"
        className="size-full object-contain"
      />
    </span>
  );
});
