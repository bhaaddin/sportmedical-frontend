/* The scene of every public page (hosted by WebLayout): the section transitions marked with data-fx, and - on the home
   page - the pinned measuring sequence. Pages without any mark get an empty scene, which costs nothing. */
import type { SceneContext } from '../ScrollScene';
import { applyFx } from './fx';
import measureScene from './measure';

export default function siteScene(context: SceneContext): void {
  applyFx(context.root, context);
  measureScene(context);
}
