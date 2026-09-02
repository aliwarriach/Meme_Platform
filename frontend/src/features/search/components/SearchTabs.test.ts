import { describe, expect, test } from '@jest/globals';

import { selectAutoTab } from '@/features/search/components/SearchTabs';
import type { SearchAllResponse } from '@/services/search';

const emptySection = { items: [], count: 0, capped: false, has_more: false };

function sectionsWith(nonEmpty: (keyof SearchAllResponse)[]): SearchAllResponse {
  const base: SearchAllResponse = {
    challenges: { ...emptySection },
    posts: { ...emptySection },
    people: { ...emptySection },
    communities: { ...emptySection },
    tags: { ...emptySection },
  };
  for (const key of nonEmpty) {
    // The item shape doesn't matter for this selection logic, only presence/length.
    base[key] = { ...emptySection, items: [{} as never], count: 1 };
  }
  return base;
}

describe('selectAutoTab', () => {
  test('picks the first tab (in Challenges/Posts/People/Communities/Tags order) with results', () => {
    expect(selectAutoTab(sectionsWith(['tags']))).toBe('tags');
    expect(selectAutoTab(sectionsWith(['communities', 'tags']))).toBe('communities');
    expect(selectAutoTab(sectionsWith(['posts', 'challenges']))).toBe('challenges');
  });

  test('falls back to Challenges when every section is empty rather than picking nothing', () => {
    expect(selectAutoTab(sectionsWith([]))).toBe('challenges');
  });

  test('never opens on Challenges just because it is first, when Challenges is empty', () => {
    expect(selectAutoTab(sectionsWith(['people']))).toBe('people');
  });
});
