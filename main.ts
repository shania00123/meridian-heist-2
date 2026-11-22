// The Meridian Heist — entrypoint.
//
// Builds the submission dossier from the game and its screenshots and writes
// everything the grader reads into $MAKEFUN_OUTPUT_DIR.
//
// The grader runs this as `node /bot/main.ts` on a read-only /bot as user
// 65534 with an empty writable /output. The output directory itself must
// never be deleted — its parent is not writable by that user, so removing
// the directory itself fails with EACCES. Only its contents are cleared.
import { cpSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const rootDir = dirname(fileURLToPath(import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? join(rootDir, 'output');

// The output directory may already exist (the grader mounts it empty and
// writable); create it if it does not, then clear only what is inside it.
mkdirSync(outDir, { recursive: true });
for (const name of readdirSync(outDir)) {
  rmSync(join(outDir, name), { recursive: true, force: true });
}

// The game the grader plays, and the renders that show it.
cpSync(join(rootDir, 'game'), join(outDir, 'game'), { recursive: true });
cpSync(join(rootDir, 'screenshots'), join(outDir, 'screenshots'), { recursive: true });

// The dossier is byte-for-byte what buildDossier writes from this
// repository's game/ and screenshots/; the caps only refuse, they never
// change the bytes, so these match the competition's stated limits.
const dossier = buildDossier(rootDir, {
  text_max_bytes: 1572864,
  screenshots: { max: 4, max_bytes: 262144 },
});
writeFileSync(join(outDir, 'dossier.json'), dossier);
