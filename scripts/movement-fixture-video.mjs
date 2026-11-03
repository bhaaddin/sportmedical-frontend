/*
 * Makes the two small fixture videos of the movement module (src/movement/fixtures/*.webm) to match the two real pipeline
 * results next to them (*.result.json): same size (1920x1080), 60 fps and frame count. A dark wall, a floor line where the
 * athlete's feet land, a 1 m floor marker and a frame counter, so a reviewer can SEE that the overlay is in sync.
 * Needs ffmpeg on PATH:   node scripts/movement-fixture-video.mjs
 */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const out = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'movement', 'fixtures');
const font = process.env.FONT ?? '/Windows/Fonts/arial.ttf';

function make(name, resultFile) {
  const r = JSON.parse(readFileSync(resolve(out, resultFile), 'utf8'));
  const { width, height, frameCount, fps } = r.video;
  /* the floor is where the lowest foot point ever gets to */
  let floor = 0;
  for (const f of r.skeleton.frames) for (const k of f.slice(15, 23)) if (k[1] !== null && k[1] > floor) floor = k[1];
  floor = Math.round(floor + 6);
  const metre = Math.round(1 / r.scale.metersPerPixel);
  const filters = [
    `drawbox=x=0:y=${floor}:w=${width}:h=${height - floor}:color=0x3a3f45:t=fill`,
    `drawbox=x=0:y=${floor}:w=${width}:h=4:color=0x6b727a:t=fill`,
    `drawbox=x=${width - metre - 120}:y=${floor + 16}:w=${metre}:h=8:color=0xd0d4d8:t=fill`,
    `drawtext=fontfile='${font}':text='%{n}':x=32:y=28:fontsize=56:fontcolor=0xd0d4d8`,
  ].join(',');
  const args = [
    '-y', '-f', 'lavfi', '-i', `color=c=0x20262c:s=${width}x${height}:r=${fps}:d=${frameCount / fps}`,
    '-vf', filters, '-frames:v', String(frameCount), '-c:v', 'libvpx-vp9', '-b:v', '150k', '-crf', '40', '-g', '30', '-pix_fmt', 'yuv420p', '-an',
    resolve(out, name),
  ];
  const res = spawnSync('ffmpeg', args, { stdio: 'inherit' });
  if (res.status !== 0) throw new Error(`ffmpeg failed for ${name}`);
}

make('running-side.webm', 'running_side.result.json');
make('dropjump-front.webm', 'drop_jump_front.result.json');
