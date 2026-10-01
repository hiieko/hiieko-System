import {
  DEFAULT_COMPANY_TZ,
  companyTimeZone,
  companyDateIso,
  companyDay,
  companyDayFor,
} from '../src/common/datetime/company-time';

/**
 * Slice 3 — Company day boundary.
 *
 * Europe/Bucharest uses EET (UTC+2) in winter and EEST (UTC+3) in summer.
 * 2026 DST transitions (IANA): spring-forward Sun 2026-03-29 03:00 local
 * (01:00Z) and fall-back Sun 2026-10-25 04:00 local (01:00Z). These tests pin
 * the exact instants on both sides of each transition to prove the company day
 * is derived through Intl (DST-correct) and never through the raw UTC date.
 */
describe('company-time (Slice 3 — company day boundary)', () => {
  const TZ = 'Europe/Bucharest';

  describe('companyTimeZone', () => {
    it('defaults to Europe/Bucharest when COMPANY_TZ is missing or blank', () => {
      expect(DEFAULT_COMPANY_TZ).toBe('Europe/Bucharest');
      expect(companyTimeZone({})).toBe('Europe/Bucharest');
      expect(companyTimeZone({ COMPANY_TZ: '' })).toBe('Europe/Bucharest');
      expect(companyTimeZone({ COMPANY_TZ: '   ' })).toBe('Europe/Bucharest');
    });

    it('honours a configured COMPANY_TZ and trims whitespace', () => {
      expect(companyTimeZone({ COMPANY_TZ: 'UTC' })).toBe('UTC');
      expect(companyTimeZone({ COMPANY_TZ: ' Europe/Bucharest ' })).toBe('Europe/Bucharest');
    });
  });

  describe('companyDateIso — winter (EET, UTC+2)', () => {
    it('rolls to the next company day after 22:00Z even though UTC is still yesterday', () => {
      // 2026-01-14T22:30Z = 2026-01-15 00:30 EET
      expect(companyDateIso(new Date('2026-01-14T22:30:00.000Z'), TZ)).toBe('2026-01-15');
    });

    it('stays on the company day just before midnight local', () => {
      // 2026-01-14T21:59:59Z = 2026-01-14 23:59:59 EET
      expect(companyDateIso(new Date('2026-01-14T21:59:59.000Z'), TZ)).toBe('2026-01-14');
    });
  });

  describe('companyDateIso — summer (EEST, UTC+3)', () => {
    it('rolls to the next company day after 21:00Z', () => {
      // 2026-07-01T21:30Z = 2026-07-02 00:30 EEST
      expect(companyDateIso(new Date('2026-07-01T21:30:00.000Z'), TZ)).toBe('2026-07-02');
    });

    it('does not roll before 21:00Z', () => {
      // 2026-07-01T20:30Z = 2026-07-01 23:30 EEST
      expect(companyDateIso(new Date('2026-07-01T20:30:00.000Z'), TZ)).toBe('2026-07-01');
    });
  });

  describe('companyDateIso — DST spring-forward (2026-03-29, 01:00Z)', () => {
    it('keeps 2026-03-29 for the last winter instant before the switch', () => {
      // +2h → 2026-03-29 00:30 EET
      expect(companyDateIso(new Date('2026-03-28T22:30:00.000Z'), TZ)).toBe('2026-03-29');
    });

    it('stays 2026-03-29 across the missing hour (02:00→03:00+3)', () => {
      // 00:30Z still +2 → 02:30 ; 01:30Z now +3 → 04:30
      expect(companyDateIso(new Date('2026-03-29T00:30:00.000Z'), TZ)).toBe('2026-03-29');
      expect(companyDateIso(new Date('2026-03-29T01:30:00.000Z'), TZ)).toBe('2026-03-29');
    });

    it('rolls to 2026-03-30 once +3 local passes midnight', () => {
      // 2026-03-29T21:30Z = 2026-03-30 00:30 EEST
      expect(companyDateIso(new Date('2026-03-29T21:30:00.000Z'), TZ)).toBe('2026-03-30');
    });
  });

  describe('companyDateIso — DST fall-back (2026-10-25, 01:00Z)', () => {
    it('keeps 2026-10-25 on both sides of the repeated 03:00 hour', () => {
      // 00:30Z +3 → 03:30 (first) ; 01:30Z +2 → 03:30 (second)
      expect(companyDateIso(new Date('2026-10-25T00:30:00.000Z'), TZ)).toBe('2026-10-25');
      expect(companyDateIso(new Date('2026-10-25T01:30:00.000Z'), TZ)).toBe('2026-10-25');
    });

    it('rolls into 2026-10-25 from the prior UTC evening', () => {
      // 2026-10-24T21:30Z +3 = 2026-10-25 00:30 EEST
      expect(companyDateIso(new Date('2026-10-24T21:30:00.000Z'), TZ)).toBe('2026-10-25');
    });

    it('rolls to 2026-10-26 once winter midnight passes', () => {
      // 2026-10-25T22:30Z +2 = 2026-10-26 00:30 EET
      expect(companyDateIso(new Date('2026-10-25T22:30:00.000Z'), TZ)).toBe('2026-10-26');
    });
  });

  describe('companyDateIso — default timezone from env', () => {
    const original = process.env.COMPANY_TZ;
    afterEach(() => {
      if (original === undefined) delete process.env.COMPANY_TZ;
      else process.env.COMPANY_TZ = original;
    });

    it('uses COMPANY_TZ when the timezone argument is omitted', () => {
      process.env.COMPANY_TZ = 'UTC';
      expect(companyDateIso(new Date('2026-01-14T22:30:00.000Z'))).toBe('2026-01-14');

      process.env.COMPANY_TZ = 'Europe/Bucharest';
      expect(companyDateIso(new Date('2026-01-14T22:30:00.000Z'))).toBe('2026-01-15');
    });
  });

  describe('companyDay — canonical @db.Date (UTC-midnight) encoding', () => {
    it('encodes a bare YYYY-MM-DD date as UTC midnight', () => {
      expect(companyDay('2026-01-15').toISOString()).toBe('2026-01-15T00:00:00.000Z');
      expect(companyDay('2026-03-29').toISOString()).toBe('2026-03-29T00:00:00.000Z');
      expect(companyDay('2026-10-25').toISOString()).toBe('2026-10-25T00:00:00.000Z');
    });

    it('keeps the calendar date of a full ISO timestamp (same as the old setUTCHours(0,0,0,0))', () => {
      expect(companyDay('2026-01-15T09:30:00.000Z').toISOString()).toBe('2026-01-15T00:00:00.000Z');
    });
  });

  describe('companyDayFor — today in the company timezone', () => {
    it('derives the company @db.Date for an instant', () => {
      expect(companyDayFor(new Date('2026-01-14T22:30:00.000Z'), TZ).toISOString()).toBe(
        '2026-01-15T00:00:00.000Z',
      );
      expect(companyDayFor(new Date('2026-07-01T21:30:00.000Z'), TZ).toISOString()).toBe(
        '2026-07-02T00:00:00.000Z',
      );
    });
  });
});