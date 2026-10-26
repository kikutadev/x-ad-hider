import '../src/content.css';
import { startAdHider } from '../src/ad-hider';

export default defineContentScript({
  matches: ['https://x.com/*', 'https://twitter.com/*'],
  runAt: 'document_start',
  main(ctx) {
    const stop = startAdHider(document);
    ctx.onInvalidated(stop);
  },
});
