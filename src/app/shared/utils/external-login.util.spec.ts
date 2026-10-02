import {
  externalProviderNames,
  externalProviders,
  hasLiveAccount,
  isExternallyLinked,
  isExternalOnly,
  isFacebookLinked,
  isGoogleLinked,
} from './external-login.util';

describe('external-login.util', () => {
  it('isGoogleLinked reads the served flag or a raw Google subject', () => {
    expect(isGoogleLinked({ googleLinked: true })).toBeTrue();
    expect(isGoogleLinked({ googleId: '1234567890' })).toBeTrue();
    expect(isGoogleLinked({ googleLinked: false, phone: '+995599000111' })).toBeFalse();
    expect(isGoogleLinked({ facebookLinked: true })).toBeFalse();
    expect(isGoogleLinked({})).toBeFalse();
    expect(isGoogleLinked(null)).toBeFalse();
    expect(isGoogleLinked(undefined)).toBeFalse();
  });

  it('isFacebookLinked reads the served flag or a raw Graph API id', () => {
    expect(isFacebookLinked({ facebookLinked: true })).toBeTrue();
    expect(isFacebookLinked({ facebookId: '10230000000000001' })).toBeTrue();
    expect(isFacebookLinked({ facebookLinked: false, facebookId: null })).toBeFalse();
    expect(isFacebookLinked({ googleLinked: true })).toBeFalse();
    expect(isFacebookLinked(null)).toBeFalse();
  });

  it('externalProviders lists every linked provider in chip order', () => {
    expect(externalProviders({ googleLinked: true })).toEqual(['google']);
    expect(externalProviders({ facebookLinked: true })).toEqual(['facebook']);
    expect(externalProviders({ facebookLinked: true, googleLinked: true })).toEqual([
      'google',
      'facebook',
    ]);
    expect(externalProviders({ googleId: 'g', facebookId: 'f' })).toEqual(['google', 'facebook']);
    expect(externalProviders({ phone: '+995599000111' })).toEqual([]);
    expect(externalProviders(undefined)).toEqual([]);
  });

  it('externalProviderNames joins the brand names', () => {
    expect(externalProviderNames({ facebookLinked: true })).toBe('Facebook');
    expect(externalProviderNames({ googleLinked: true, facebookLinked: true })).toBe(
      'Google / Facebook',
    );
    expect(externalProviderNames({})).toBe('');
  });

  it('isExternallyLinked = at least one provider', () => {
    expect(isExternallyLinked({ googleLinked: true })).toBeTrue();
    expect(isExternallyLinked({ facebookLinked: true })).toBeTrue();
    expect(isExternallyLinked({ phone: '+995599000111', email: 'a@b.ge' })).toBeFalse();
    expect(isExternallyLinked(null)).toBeFalse();
  });

  it('isExternalOnly = linked to a provider and still without a phone', () => {
    expect(isExternalOnly({ googleLinked: true, email: 'a@gmail.com' })).toBeTrue();
    // Facebook-only, no phone and no email at all
    expect(isExternalOnly({ facebookLinked: true })).toBeTrue();
    expect(isExternalOnly({ googleLinked: true, facebookLinked: true })).toBeTrue();
    expect(isExternalOnly({ googleLinked: true, phone: '+995599000111' })).toBeFalse();
    expect(isExternalOnly({ facebookLinked: true, phone: '+995599000111' })).toBeFalse();
    expect(isExternalOnly({ phone: undefined })).toBeFalse();
    expect(isExternalOnly(null)).toBeFalse();
  });

  it('hasLiveAccount: any surviving identity field; none = hard-deleted', () => {
    expect(hasLiveAccount({ phone: '+995599000111' })).toBeTrue();
    expect(hasLiveAccount({ email: 'a@gmail.com', googleLinked: true })).toBeTrue();
    expect(hasLiveAccount({ googleLinked: true })).toBeTrue();
    // A Facebook-only player may have neither phone nor email.
    expect(hasLiveAccount({ facebookLinked: true })).toBeTrue();
    expect(hasLiveAccount({ facebookId: '10230000000000001' })).toBeTrue();
    expect(hasLiveAccount({ email: 'a@gmail.com' })).toBeTrue();
    expect(hasLiveAccount({})).toBeFalse();
    expect(
      hasLiveAccount({ phone: '', email: '', googleLinked: false, facebookLinked: false }),
    ).toBeFalse();
    expect(hasLiveAccount(null)).toBeFalse();
  });
});
