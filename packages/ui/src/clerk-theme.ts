/**
 * Clerk appearance built from our tokens, so sign-in and the user menu match the app in both
 * themes. CSS variables are used directly so the theme switches live without re-rendering.
 * Pass to <ClerkProvider appearance={clerkAppearance}>.
 */
export const clerkAppearance = {
  variables: {
    colorPrimary: 'var(--accent)',
    colorPrimaryForeground: 'var(--on-accent)',
    colorBackground: 'var(--surface-raised)',
    colorForeground: 'var(--text)',
    colorMutedForeground: 'var(--text-muted)',
    colorInput: 'var(--surface)',
    colorInputForeground: 'var(--text)',
    colorBorder: 'var(--border-strong)',
    colorDanger: 'var(--danger)',
    colorSuccess: 'var(--success)',
    colorWarning: 'var(--warning)',
    colorNeutral: 'var(--text)',
    fontFamily: 'var(--font-sans)',
    fontSize: '14px',
    borderRadius: '6px',
  },
  elements: {
    card: { boxShadow: 'var(--shadow-e3)', border: '1px solid var(--border)' },
    formButtonPrimary: { fontWeight: 500, boxShadow: 'var(--shadow-e1)' },
    footerAction: { fontSize: '13px' },
  },
} as const;
