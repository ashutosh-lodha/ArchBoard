// Apply the saved theme before first paint (no flash). Kept as a file so the CSP can forbid
// inline scripts. Must stay in sync with THEME_BOOTSTRAP_SCRIPT in packages/ui/src/theme.tsx.
(function () {
  try {
    var p = localStorage.getItem('archboard.theme');
    var d =
      p === 'dark' ||
      ((!p || p === 'system') && matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.dataset.theme = d ? 'dark' : 'light';
  } catch {
    // Storage blocked (private mode): fall back to the light theme.
  }
})();
