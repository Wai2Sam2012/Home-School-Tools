# Home-School-Tools

Learning tools and games for home school. Each tool lives in its own folder.

| Tool | Description |
| --- | --- |
| [Arithmetic Odyssey](arithmetic-odyssey/) | An offline math adventure game for the iPad, with Dino Tour and Truck Off-Road (US national parks) themes. Includes the dinosaur and national park fact files. Planned in [GAME-PLAN.md](arithmetic-odyssey/GAME-PLAN.md). |

## Website

The repository is published with GitHub Pages at `https://wai2sam2012.github.io/Home-School-Tools/`. The start page ([index.html](index.html)) links to each tool. Every push to `main` runs the tests and republishes the site ([.github/workflows/deploy.yml](.github/workflows/deploy.yml)); tests, tools and raw downloads are left out.

One-time setup: **Settings → Pages → Build and deployment → Source: GitHub Actions**.

## Conventions

- One folder per tool, named in lowercase with hyphens (no spaces), so web addresses stay simple.
- This repository is public. Never commit personal data, player saves or backups, or pictures you are not allowed to share.
- Prefix commit messages with the tool, e.g. `[Arithmetic Odyssey] Add math engine`.
