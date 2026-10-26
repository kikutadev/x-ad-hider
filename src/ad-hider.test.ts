// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { startAdHider } from './ad-hider';

let stop: (() => void) | undefined;
const hidden = (id: string): boolean => document.getElementById(id)!.hasAttribute('data-x-ad-hider-hidden');

async function eventually(callback: () => void): Promise<void> {
  await vi.waitFor(callback, { timeout: 1200 });
}

beforeEach(() => { document.body.replaceChildren(); });
afterEach(() => { stop?.(); stop = undefined; });

describe('mutation-driven lifecycle', () => {
  it('preserves video posts with placementTracking in the media player', async () => {
    document.body.innerHTML = '<div id="video" data-testid="cellInnerDiv"><article>' +
      '<div data-testid="tweetText">普通の動画投稿</div>' +
      '<div data-testid="tweetPhoto"><div data-testid="videoPlayer"><div data-testid="placementTracking"></div></div></div>' +
      '</article></div>';
    stop = startAdHider();
    await new Promise(resolve => setTimeout(resolve, 80));
    expect(hidden('video')).toBe(false);
  });

  it('hides ads added after startup and keeps organic posts visible', async () => {
    stop = startAdHider();
    document.body.insertAdjacentHTML('beforeend',
      '<div id="ad" data-testid="cellInnerDiv"><article><span>広告</span><div data-testid="tweetText">広告</div></article></div>' +
      '<div id="normal" data-testid="cellInnerDiv"><article><div data-testid="tweetText"><span>広告</span>の話</div></article></div>');
    await eventually(() => expect(hidden('ad')).toBe(true));
    expect(hidden('normal')).toBe(false);
  });

  it('handles infinite scroll and SPA replacement of the entire timeline', async () => {
    document.body.innerHTML = '<main id="timeline"><div id="first" data-testid="cellInnerDiv"><article><span>Ad</span></article></div></main>';
    stop = startAdHider();
    await eventually(() => expect(hidden('first')).toBe(true));
    document.getElementById('timeline')!.innerHTML =
      '<div id="second" data-testid="cellInnerDiv"><article><span>Promoted</span></article></div>';
    await eventually(() => expect(hidden('second')).toBe(true));
  });

  it('restores a recycled cell on text mutation and classifies it again', async () => {
    document.body.innerHTML = '<div id="slot" data-testid="cellInnerDiv"><article><span>広告</span><div data-testid="tweetText">ad</div></article></div>';
    stop = startAdHider();
    await eventually(() => expect(hidden('slot')).toBe(true));
    document.querySelector('#slot span')!.firstChild!.textContent = '通常';
    await eventually(() => expect(hidden('slot')).toBe(false));
    document.querySelector('#slot span')!.firstChild!.textContent = '広告';
    await eventually(() => expect(hidden('slot')).toBe(true));
  });

  it('restores visibility when the promotion marker is removed', async () => {
    document.body.innerHTML = '<div id="slot" data-testid="cellInnerDiv"><article><span data-testid="promotedIndicator"></span></article></div>';
    stop = startAdHider();
    await eventually(() => expect(hidden('slot')).toBe(true));
    document.querySelector('span')!.removeAttribute('data-testid');
    await eventually(() => expect(hidden('slot')).toBe(false));
  });

  it('does not hide an organic outer post containing a promoted quote', async () => {
    document.body.innerHTML = '<div id="normal" data-testid="cellInnerDiv"><article>' +
      '<div data-testid="tweetText">通常投稿</div><article><span data-testid="promotedIndicator"></span></article>' +
      '</article></div>';
    stop = startAdHider();
    await eventually(() => expect(hidden('normal')).toBe(false));
  });

  it('clears extension-added visibility flags and disconnects on invalidation', async () => {
    document.body.innerHTML = '<div id="slot" data-testid="cellInnerDiv"><article><span>広告</span></article></div>';
    stop = startAdHider();
    await eventually(() => expect(hidden('slot')).toBe(true));
    stop();
    stop = undefined;
    expect(hidden('slot')).toBe(false);
    document.body.insertAdjacentHTML('beforeend', '<div id="new" data-testid="cellInnerDiv"><article><span>広告</span></article></div>');
    await new Promise(resolve => setTimeout(resolve, 80));
    expect(hidden('new')).toBe(false);
  });
});
