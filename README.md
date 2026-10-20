# 楚漢・棋陣 3D

Vite + TypeScript + Three.js browser game. The board, wooden Xiangqi pieces, lighting, camera, particles, and capture presentation are rendered in or around the Three.js scene. Game rules and the computer opponent are implemented in `src/rules.ts`.

## Run locally

```sh
pnpm install
pnpm dev
```

Open the local URL shown by Vite. Use the mouse wheel to zoom and drag to orbit the board. Click a red piece, then a highlighted intersection to move. Captures play a cinematic interlude using the provided artwork.

## Build

```sh
pnpm build
```

## Publish as a website with GitHub Pages

1. Create a GitHub repository and put the contents of this project at the repository root.
2. Push the `main` branch.
3. In the repository, open **Settings → Pages** and choose **GitHub Actions** as the source.
4. The included `.github/workflows/deploy.yml` builds and publishes the site. The public URL appears in the workflow's deployment summary.

The Vite build uses relative asset paths, so the game also works when the repository is hosted beneath a GitHub Pages project URL. To publish elsewhere, upload the contents of `dist/` to any static website host.
