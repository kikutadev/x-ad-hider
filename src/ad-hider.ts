import { isPromotedArticle } from './ad-detection';

const CELL = '[data-testid="cellInnerDiv"]';
const HIDDEN = 'data-x-ad-hider-hidden';
const MAX_PER_FRAME = 60;

function markHidden(element: HTMLElement, hidden: boolean): void {
  if (element.hasAttribute(HIDDEN) !== hidden) element.toggleAttribute(HIDDEN, hidden);
}

function topLevelArticles(container: Element): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>('article')].filter(article =>
    !article.parentElement?.closest('article')
  );
}

/** Hide a whole virtualized cell only when it contains exactly one top-level post. */
export function processTimelineCell(cell: HTMLElement): void {
  const articles = topLevelArticles(cell);
  if (articles.length === 1) {
    markHidden(cell, isPromotedArticle(articles[0]!));
    markHidden(articles[0]!, false);
  } else {
    // X occasionally puts multiple posts in one cell. Never hide organic siblings.
    markHidden(cell, false);
    for (const article of articles) markHidden(article, isPromotedArticle(article));
  }
}

/** One observer, no polling, no network and no browser extension APIs. */
export function startAdHider(doc: Document = document): () => void {
  const pending = new Set<HTMLElement>();
  let frame = 0;
  let stopped = false;
  let observer: MutationObserver | null = null;

  function enqueue(element: Element): void {
    const cell = element.closest<HTMLElement>(CELL);
    if (cell) pending.add(cell);
    else {
      const article = element.closest<HTMLElement>('article');
      if (article && !article.parentElement?.closest('article')) pending.add(article);
    }
  }

  function discover(element: Element): void {
    enqueue(element);
    if (element.matches(CELL)) pending.add(element as HTMLElement);
    for (const cell of element.querySelectorAll<HTMLElement>(CELL)) pending.add(cell);
    if (element.matches('article') && !element.closest(CELL)) enqueue(element);
    for (const article of element.querySelectorAll<HTMLElement>('article')) {
      if (!article.closest(CELL)) enqueue(article);
    }
  }

  function flush(): void {
    frame = 0;
    if (stopped) return;
    let count = 0;
    for (const target of pending) {
      pending.delete(target);
      if (!target.isConnected) continue;
      if (target.matches(CELL)) processTimelineCell(target);
      else if (target.matches('article')) {
        const cell = target.closest<HTMLElement>(CELL);
        if (cell) processTimelineCell(cell);
        else markHidden(target, isPromotedArticle(target));
      }
      if (++count >= MAX_PER_FRAME) break;
    }
    if (pending.size) schedule();
  }

  function schedule(): void {
    if (stopped || frame) return;
    frame = doc.defaultView!.requestAnimationFrame(flush);
  }

  function scanAll(): void {
    if (stopped) return;
    for (const cell of doc.querySelectorAll<HTMLElement>(CELL)) pending.add(cell);
    for (const article of doc.querySelectorAll<HTMLElement>('article')) {
      if (!article.closest(CELL)) enqueue(article);
    }
    schedule();
  }

  function onMutation(changes: MutationRecord[]): void {
    for (const change of changes) {
      const parent = change.target.nodeType === Node.ELEMENT_NODE
        ? change.target as Element : change.target.parentElement;
      if (parent) enqueue(parent);
      // Search only the newly inserted subtrees, not the entire document on
      // every X timeline / React mutation.
      if (change.type === 'childList') {
        for (const node of change.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) discover(node as Element);
        }
      }
    }
    if (pending.size) schedule();
  }

  function onVisibility(): void {
    if (doc.visibilityState === 'visible') scanAll();
  }

  function initialize(): void {
    if (stopped || observer || !doc.documentElement) return;
    observer = new MutationObserver(onMutation);
    observer.observe(doc.documentElement, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['data-testid', 'aria-label', 'title'],
    });
    scanAll();
  }

  // document_start runs before the timeline exists. Watch React inserts once.
  initialize();
  if (!observer) doc.addEventListener('readystatechange', initialize);
  doc.addEventListener('visibilitychange', onVisibility);
  doc.defaultView?.addEventListener('pageshow', scanAll);

  return () => {
    stopped = true;
    observer?.disconnect();
    if (frame) doc.defaultView?.cancelAnimationFrame(frame);
    pending.clear();
    doc.removeEventListener('readystatechange', initialize);
    doc.removeEventListener('visibilitychange', onVisibility);
    doc.defaultView?.removeEventListener('pageshow', scanAll);
    // WXT hot reload / extension invalidation must not leave hidden posts.
    for (const element of doc.querySelectorAll<HTMLElement>(`[${HIDDEN}]`)) markHidden(element, false);
  };
}
