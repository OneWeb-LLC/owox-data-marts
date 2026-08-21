import { expect } from 'chai';

import { hashLaunchToken } from '../../src/oweb/redeem-launch-token.js';

describe('hashLaunchToken', () => {
  it('returns a stable sha256 hex digest', () => {
    expect(hashLaunchToken('abc')).to.equal(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
    );
    expect(hashLaunchToken('abc')).to.equal(hashLaunchToken('abc'));
    expect(hashLaunchToken('abc')).to.not.equal(hashLaunchToken('abcd'));
  });
});
