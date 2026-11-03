/*
 * Makes the two small fixture videos of the movement module (src/movement/fixtures/*.webm): a floor, a wall, a 1 m floor
 * marker, (for the drop jump) a 30 cm box, and a frame counter so a reviewer can SEE that the skeleton overlay is in sync.
 * 1280x720, 60 fps, 120 frames, VP9. Needs ffmpeg on PATH:   node scripts/movement-fixture-video.mjs
 */
import { spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const out = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'movement', 'fixtures');
const font = process.env.FONT ?? '/Windows/Fonts/arial.ttf';
const S = 300; // pixels per metre, the same as synth.ts
const FLOOR = 690;

function make(name, extra) {
  const filters = [
    `drawbox=x=0:y=${FLOOR}:w=1280:h=30:color=0x3a3f45:t=fill`,
    `drawbox=x=0:y=${FLOOR}:w=1280:h=3:color=0x6b727a:t=fill`,
    // 1 m marker on the floor, right of the athlete
    `drawbox=x=900:y=${FLOOR + 8}:w=${S}:h=6:color=0xd0d4d8:t=fill`,
    ...extra,
    `drawtext=fontfile='${font}':text='%{n}':x=24:y=20:fontsize=36:fontcolor=0xd0d4d8`,
  ].join(',');
  const args = [
    '-y', '-f', 'lavfi', '-i', 'color=c=0x20262c:s=1280x720:r=60:d=2',
    '-vf', filters, '-c:v', 'libvpx-vp9', '-b:v', '120k', '-crf', '38', '-g', '30', '-pix_fmt', 'yuv420p', '-an',
    resolve(out, name),
  ];
  const r = spawnSync('ffmpeg', args, { stdio: 'inherit' });
  if (r.status !== 0) throw new Error(`ffmpeg failed for ${name}`);
}

make('running-side.webm', []);
// the box the athlete drops from: 30 cm high, 50 cm wide, 40 cm behind the landing spot
make('dropjump-front.webm', [`drawbox=x=${640 - Math.round(0.4 * S) - Math.round(0.25 * S)}:y=${FLOOR - Math.round(0.3 * S)}:w=${Math.round(0.5 * S)}:h=${Math.round(0.3 * S)}:color=0x59616a:t=fill`]);
