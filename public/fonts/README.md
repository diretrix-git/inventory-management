# Locally bundled fonts

The root layout imports the supported Fontsource CSS from these exact npm
packages, pinned with SHA-512 integrity records in `package-lock.json`:

- `@fontsource-variable/dm-sans@5.3.0`: DM Sans, normal variable weight 100–1000,
  default optical size; Latin and Latin Extended subsets.
- `@fontsource/ibm-plex-mono@5.3.0`: IBM Plex Mono, normal weights 400/500/600/700,
  including the package's Latin, Latin Extended, Cyrillic, Cyrillic Extended and
  Vietnamese subsets.

Packages came from the permitted `registry.npmjs.org` using npm's normal TLS
and artifact integrity verification. They identify `https://github.com/google/fonts`
as the upstream font source. No glyphs were modified or unrelated fonts substituted.
The CSS alias `DM Sans Variable` refers to the same DM Sans family.

Both packages are licensed under SIL Open Font License 1.1. Unmodified license
and copyright notices are served alongside the app at:

- `/fonts/licenses/DM-Sans-OFL.txt`
- `/fonts/licenses/IBM-Plex-Mono-OFL.txt`

Next.js bundles the referenced font files into its hashed static assets; they do
not need to be copied manually or fetched from Google during a build or page load.
`font-display: swap` and the existing `--font-sans`/`--font-mono` variables are
retained. This uses Fontsource's subset-aware CSS rather than copying only Latin
files into `next/font/local`, preserving additional glyphs such as currency signs.
The previous `next/font/google` automatic preload/fallback-metric generation is
not reproduced by this CSS approach; exact transient layout-shift parity is not
claimed. Verify visual performance separately if it is a release requirement.
