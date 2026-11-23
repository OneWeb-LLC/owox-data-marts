import { expect } from 'chai';

import {
  DEFAULT_ONE_OS_SUPABASE_AUTH_URL,
  DEFAULT_OWEB_APP_URL,
  owebLoginUrl,
} from '../../src/oweb/constants.js';

describe('oweb satellite constants', () => {
  it('keeps control-plane login on oweb.one', () => {
    expect(owebLoginUrl()).to.match(/^https:\/\/oweb\.one\/login\?launch=/);
    expect(DEFAULT_OWEB_APP_URL).to.equal('https://oweb.one');
  });

  it('documents One OS Supabase auth host separately from control plane', () => {
    expect(DEFAULT_ONE_OS_SUPABASE_AUTH_URL).to.equal('https://auth.oweb.one');
    expect(DEFAULT_ONE_OS_SUPABASE_AUTH_URL).not.to.equal(DEFAULT_OWEB_APP_URL);
  });
});