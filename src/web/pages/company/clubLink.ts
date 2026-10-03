/* ══════════════════════════════════════════════════════════════
   "MÁM ODKAZ OD KLUBU" — what an athlete pastes

   The club sends its athletes a link to the registration page, `…/klub/<token>`
   (src/api/publicClub.ts builds it). The athlete may paste the whole link, a link
   without the scheme, or only the token. All of them lead to this site's own
   `/klub/<token>`: the token is the only thing taken from the input, so a link
   that points at another host can never send the athlete there.
   ══════════════════════════════════════════════════════════════ */

/** The segment after `/klub/` in a pasted link, or null. */
const TOKEN_IN_LINK = /(?:^|\/)klub\/([^/?#\s]+)/i;

/** A bare token: letters, digits and the URL-safe punctuation tokens are made of. */
const BARE_TOKEN = /^[A-Za-z0-9._~-]{4,200}$/;

export const CLUB_PATH_PREFIX = '/klub/';

/** The token inside whatever the athlete pasted, or null when there is none. */
export function extractClubToken(input: string): string | null {
  const text = input.trim();
  if (text === '') return null;

  const inLink = TOKEN_IN_LINK.exec(text);
  if (inLink !== null) {
    let token = inLink[1];
    try {
      token = decodeURIComponent(token);
    } catch {
      // A broken escape: keep the text as it is, the check below decides.
    }
    return BARE_TOKEN.test(token) ? token : null;
  }
  return BARE_TOKEN.test(text) ? text : null;
}

/** '/klub/<token>' for the pasted text, or null when it holds no usable token. */
export function clubLinkTarget(input: string): string | null {
  const token = extractClubToken(input);
  return token === null ? null : `${CLUB_PATH_PREFIX}${encodeURIComponent(token)}`;
}
