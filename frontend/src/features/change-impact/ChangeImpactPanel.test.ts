import { describe, expect, it } from 'vitest';
import { matchesImpactSearch } from './ChangeImpactPanel';

const item = {
  campaign: { id: '10001', name: 'TuMV LG Remote IT ROAS' },
  adGroup: { id: '20002', name: 'Ad group 3' },
};

describe('change impact search', () => {
  it('matches campaign and ad group names or IDs', () => {
    expect(matchesImpactSearch(item, 'remote')).toBe(true);
    expect(matchesImpactSearch(item, 'AD GROUP 3')).toBe(true);
    expect(matchesImpactSearch(item, '10001')).toBe(true);
  });

  it('does not match unrelated text such as AC', () => {
    expect(matchesImpactSearch(item, 'AC')).toBe(false);
  });
});
