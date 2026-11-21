# Icons: sources, licences and how we use them

Last checked: 2026-11-21. Re-check each provider's page whenever a pack is updated.

## Summary

| Set | Source | Version | Committed to the repo? | Status |
|---|---|---|---|---|
| Generic (21 blocks) | Drawn for ArchBoard (`packages/icons/src/generic.ts`) | 1 | Yes, it's our own work | ✅ in use |
| AWS Architecture Icons | <https://aws.amazon.com/architecture/icons/> | 2026-07-31 (Q3) | **No**, downloaded at build time | ⏳ awaiting first import |
| Azure Public Service Icons | <https://learn.microsoft.com/en-us/azure/architecture/icons/> | V25 | **No**, downloaded at build time | ⏳ awaiting first import (terms must be accepted) |
| Google Cloud icons | <https://cloud.google.com/icons> | — | **No** | ⏳ download link not found yet (page renders client-side) |

Raw vendor packs are never committed. `pnpm icons:import` downloads them from the URLs in `packages/icons/sources.json`, checks a pinned SHA-256, extracts only the SVGs into `packages/icons/vendor/` (gitignored), and builds optimised copies into `packages/icons/generated/` (gitignored). The built web app serves them as static files, which is how the icons appear in diagrams.

## Terms as published (paraphrased; the provider's page is authoritative)

### AWS
- AWS lets customers and partners use the icon toolkits and assets **to create architecture diagrams**. The page names whitepapers, presentations, data sheets and posters as example uses.
- The icon page doesn't spell out rules on modifying icons, redistribution or trademarks. The general [AWS Site Terms](https://aws.amazon.com/terms/) and [trademark guidelines](https://aws.amazon.com/legal/) apply. **[VERIFY before a public launch]**
- How we comply: icons appear only as components inside users' architecture diagrams, unmodified apart from SVG optimisation, which doesn't change how they look.

### Microsoft Azure
- Microsoft permits use of the icons "in architectural diagrams, training materials, or documentation". You may copy, distribute and display them **only for that use**, and Microsoft reserves all other rights.
- **Do:** use an icon to show how products work together, label it with the product name, and show it as it appears in Azure.
- **Don't:** crop, flip, rotate, distort or otherwise change an icon's shape, or use a Microsoft product icon to represent your own product or service.
- The download page requires ticking **"I agree to the above terms"**. Someone has to accept these terms before the first import, so **the owner accepts them, not the build bot**.
- How we comply: product labels are shown next to icons (the node label defaults to the product name); nodes never rotate or crop icons; ArchBoard's own branding never uses Azure icons.

### Google Cloud
- Terms not captured yet: the icons page didn't return readable content to an automated fetch. **[TODO: read <https://cloud.google.com/icons> in a browser, record the pack URL and the usage terms here, then add the URL to sources.json.]**

## Rules ArchBoard follows for every vendor icon
1. Show it only as a component in an architecture diagram (palette, canvas, exports, templates, AI output).
2. Never alter it visually: no recolouring, cropping, rotation or distortion. SVGO optimisation keeps the rendering identical, and ids are prefixed only to avoid clashes on the page.
3. Label it with the product name by default.
4. Never use it in ArchBoard's own logo, marketing graphics or favicon.
5. Keep packs current: re-import when providers release updates (AWS quarterly), pin the new SHA-256, and update this file.

## Generic icons
ArchBoard's 21 cloud-neutral blocks are original line icons drawn for this project, licensed with the rest of the repository.
