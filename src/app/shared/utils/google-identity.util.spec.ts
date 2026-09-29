import { hasLiveAccount, isGoogleLinked, isGoogleOnly } from './google-identity.util';

describe('google-identity.util', () => {
  it('isGoogleLinked reads the served flag or a raw Google subject', () => {
    expect(isGoogleLinked({ googleLinked: true })).toBeTrue();
    expect(isGoogleLinked({ googleId: '1234567890' })).toBeTrue();
    expect(isGoogleLinked({ googleLinked: false, phone: '+995599000111' })).toBeFalse();
    expect(isGoogleLinked({})).toBeFalse();
    expect(isGoogleLinked(null)).toBeFalse();
    expect(isGoogleLinked(undefined)).toBeFalse();
  });

  it('isGoogleOnly = linked to Google and still without a phone', () => {
    expect(isGoogleOnly({ googleLinked: true, email: 'a@gmail.com' })).toBeTrue();
    expect(isGoogleOnly({ googleLinked: true, phone: '+995599000111' })).toBeFalse();
    expect(isGoogleOnly({ phone: undefined })).toBeFalse();
  });

  it('hasLiveAccount: any surviving identity field; none = hard-deleted', () => {
    expect(hasLiveAccount({ phone: '+995599000111' })).toBeTrue();
    expect(hasLiveAccount({ email: 'a@gmail.com', googleLinked: true })).toBeTrue();
    expect(hasLiveAccount({ googleLinked: true })).toBeTrue();
    expect(hasLiveAccount({ email: 'a@gmail.com' })).toBeTrue();
    expect(hasLiveAccount({})).toBeFalse();
    expect(hasLiveAccount({ phone: '', email: '', googleLinked: false })).toBeFalse();
    expect(hasLiveAccount(null)).toBeFalse();
  });
});
