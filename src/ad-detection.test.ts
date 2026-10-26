// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { isPromotedArticle } from './ad-detection';
import { processTimelineCell } from './ad-hider';

const article = (markup: string): HTMLElement => {
  const element = document.createElement('article');
  element.innerHTML = markup;
  return element;
};

beforeEach(() => { document.body.replaceChildren(); });

describe('conservative ad recognition', () => {
  it.each(['広告', 'プロモーション', 'Ad', 'Promoted', 'Sponsored'])('detects standalone header label %s', label => {
    expect(isPromotedArticle(article(`<div><span>${label}</span></div><div data-testid="tweetText">本文</div>`))).toBe(true);
  });

  it('finds advertised content without a status link', () => {
    expect(isPromotedArticle(article('<div data-testid="promotedIndicator"></div>'))).toBe(true);
    expect(isPromotedArticle(article('<div data-testid="placementTracking"></div>'))).toBe(false);
  });

  it('preserves organic video posts containing placementTracking inside tweetPhoto', () => {
    const organicVideo = article(
      '<div data-testid="tweetText">動画付きの通常投稿</div>' +
      '<div data-testid="tweetPhoto"><div data-testid="videoPlayer">' +
      '<div data-testid="placementTracking"></div></div></div>'
    );
    expect(isPromotedArticle(organicVideo)).toBe(false);
  });

  it('ignores words in post text, including exact-match leaf nodes', () => {
    expect(isPromotedArticle(article('<div data-testid="tweetText"><span>広告</span>を非表示にしたい</div>'))).toBe(false);
    expect(isPromotedArticle(article('<div data-testid="tweetText"><span>Sponsored</span></div>'))).toBe(false);
  });

  it('ignores quoted articles, external links, and cards', () => {
    const post = article('<div data-testid="tweetText">本文</div>' +
      '<a href="/ad"><span>Ad</span></a>' +
      '<div data-testid="card.wrapper"><span>広告</span></div>' +
      '<div data-testid="quoteTweet"><article><div data-testid="promotedIndicator"></div><span>広告</span></article></div>');
    expect(isPromotedArticle(post)).toBe(false);
  });

  it('does not hide usernames, buttons or body metadata', () => {
    expect(isPromotedArticle(article('<div data-testid="User-Name"><span>広告</span></div><div data-testid="tweetText">普通の投稿</div>'))).toBe(false);
    expect(isPromotedArticle(article('<button><span>Ad</span></button>'))).toBe(false);
    expect(isPromotedArticle(article('<div data-testid="tweetText">text</div><span>広告</span>'))).toBe(false);
    expect(isPromotedArticle(article('<span>広告会社</span><div data-testid="tweetText">text</div>'))).toBe(false);
  });

  it('does not treat a promotion marker in a nested article as outer promotion', () => {
    expect(isPromotedArticle(article('<article data-testid="promotedTweet"><span>広告</span></article>'))).toBe(false);
  });
});

describe('virtualized timeline cells', () => {
  it('hides the promoted cell, then immediately restores it after React reuses its article', () => {
    document.body.innerHTML = '<div data-testid="cellInnerDiv"><article><span>広告</span>' +
      '<div data-testid="tweetText">広告本文</div></article></div>';
    const cell = document.querySelector<HTMLElement>('[data-testid="cellInnerDiv"]')!;
    const post = cell.querySelector('article')!;
    processTimelineCell(cell);
    expect(cell.hasAttribute('data-x-ad-hider-hidden')).toBe(true);
    post.innerHTML = '<div data-testid="tweetText">通常投稿</div>';
    processTimelineCell(cell);
    expect(cell.hasAttribute('data-x-ad-hider-hidden')).toBe(false);
  });

  it('keeps ordinary siblings visible if the same cell contains multiple top-level articles', () => {
    document.body.innerHTML = '<div data-testid="cellInnerDiv">' +
      '<article><span>広告</span></article><article><div data-testid="tweetText">通常投稿</div></article></div>';
    const cell = document.querySelector<HTMLElement>('[data-testid="cellInnerDiv"]')!;
    processTimelineCell(cell);
    expect(cell.hasAttribute('data-x-ad-hider-hidden')).toBe(false);
    expect(cell.querySelectorAll('article')[0]?.hasAttribute('data-x-ad-hider-hidden')).toBe(true);
    expect(cell.querySelectorAll('article')[1]?.hasAttribute('data-x-ad-hider-hidden')).toBe(false);
  });

  it('clears the hidden flag when the cell becomes empty', () => {
    document.body.innerHTML = '<div data-testid="cellInnerDiv"><article><span>広告</span></article></div>';
    const cell = document.querySelector<HTMLElement>('[data-testid="cellInnerDiv"]')!;
    processTimelineCell(cell);
    cell.replaceChildren();
    processTimelineCell(cell);
    expect(cell.hasAttribute('data-x-ad-hider-hidden')).toBe(false);
  });
});
