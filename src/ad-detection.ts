/** Recognize X promotional UI without examining user-authored post text.
 * Inspect only X's promotional UI, never the body of user-authored posts.
 */
const AD_LABELS = new Set([
  'ad', 'ads', 'promoted', 'sponsored', 'advertisement',
  '広告', 'プロモーション', 'スポンサー',
]);

const EXPLICIT_PROMOTION = [
  '[data-testid="promotedIndicator"]',
  '[data-testid="promotedTweet"]',
  '[data-testid="promotedLabel"]',
  '[data-testid="adLabel"]',
].join(',');

const NON_LABEL_CONTEXT = [
  '[data-testid="tweetText"]',
  '[data-testid="card.wrapper"]',
  '[data-testid="quoteTweet"]',
  '[data-testid="User-Name"]',
  '[data-testid="UserCell"]',
  'button', '[role="button"]', 'a', '[role="link"]',
  'time', 'svg',
].join(',');

function isOwnedByArticle(element: Element, article: HTMLElement): boolean {
  return element.closest('article') === article && !element.closest(NON_LABEL_CONTEXT);
}

function hasAdLabel(value: string | null): boolean {
  return AD_LABELS.has((value ?? '').replace(/\s+/g, ' ').trim().toLowerCase());
}

/** Fail open: a doubtful label leaves the organic post visible. */
export function isPromotedArticle(article: HTMLElement): boolean {
  if (article.matches('[data-testid="promotedTweet"]')) return true;

  for (const marker of article.querySelectorAll(EXPLICIT_PROMOTION)) {
    // A promoted quote inside an organic post does not make its parent an ad.
    if (marker.closest('article') !== article) continue;
    // Do not treat placementTracking as an ad marker. Real X also inserts it
    // inside organic videos (tweetPhoto/videoPlayer).
    if (marker.matches('[data-testid="promotedTweet"], [data-testid="promotedIndicator"]')) return true;
    if (hasAdLabel(marker.getAttribute('aria-label')) || hasAdLabel(marker.textContent)) return true;
  }

  // X also uses an unmarked, standalone "Ad" / "広告" span in the header.
  // Only accept a leaf before the post body, not nested posts, authors, links,
  // cards or user-controlled tweet text.
  const body = [...article.querySelectorAll('[data-testid="tweetText"]')]
    .find(element => element.closest('article') === article);
  for (const leaf of article.querySelectorAll('span, div')) {
    if (leaf.childElementCount !== 0 || !isOwnedByArticle(leaf, article)) continue;
    if (!hasAdLabel(leaf.textContent)) continue;
    if (body && !(leaf.compareDocumentPosition(body) & Node.DOCUMENT_POSITION_FOLLOWING)) continue;
    return true;
  }
  return false;
}
