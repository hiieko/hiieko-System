/**
 * Regression tests for month boundaries and Europe/Bucharest timezone behavior.
 *
 * Verifies:
 * 1. Correct month bounds computation (leap years, varying month lengths)
 * 2. Daylight Saving Time transitions (March and October transitions for Europe/Bucharest)
 * 3. Company day derivation across DST boundaries
 */

import { Test, TestingModule } from '@nestjs/testing';
import { AttendanceService } from '../src/modules/attendance/attendance.service';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { AuditService } from '../src/common/audit/audit.service';
import { companyDateIso, companyDay, companyDayFor, companyTimeZone } from '../src/common/datetime/company-time';

describe('Month boundaries and Europe/Bucharest timezone', () => {
  describe('Month bounds computation (frontend utils parity)', () => {
    it('computes February bounds for leap year (2024)', () => {
      // 2024 is a leap year
      const feb2024 = '2024-02';
      const start = companyDay(`${feb2024}-01`);
      const end = companyDay(`${feb2024}-29`);

      expect(start.toISOString()).toBe('2024-02-01T00:00:00.000Z');
      expect(end.toISOString()).toBe('2024-02-29T00:00:00.000Z');
    });

    it('computes February bounds for non-leap year (2023)', () => {
      const feb2023 = '2023-02';
      const start = companyDay(`${feb2023}-01`);
      const end = companyDay(`${feb2023}-28`);

      expect(start.toISOString()).toBe('2023-02-01T00:00:00.000Z');
      expect(end.toISOString()).toBe('2023-02-28T00:00:00.000Z');
    });

    it('computes 31-day month bounds (January, March, etc.)', () => {
      const jan2026 = '2026-01';
      const start = companyDay(`${jan2026}-01`);
      const end = companyDay(`${jan2026}-31`);

      expect(start.toISOString()).toBe('2026-01-01T00:00:00.000Z');
      expect(end.toISOString()).toBe('2026-01-31T00:00:00.000Z');
    });

    it('computes 30-day month bounds (April, June, etc.)', () => {
      const apr2026 = '2026-04';
      const start = companyDay(`${apr2026}-01`);
      const end = companyDay(`${apr2026}-30`);

      expect(start.toISOString()).toBe('2026-04-01T00:00:00.000Z');
      expect(end.toISOString()).toBe('2026-04-30T00:00:00.000Z');
    });
  });

  describe('Europe/Bucharest DST transitions', () => {
    const originalTz = process.env.COMPANY_TZ;

    beforeEach(() => {
      process.env.COMPANY_TZ = 'Europe/Bucharest';
    });

    afterAll(() => {
      if (originalTz === undefined) delete process.env.COMPANY_TZ;
      else process.env.COMPANY_TZ = originalTz;
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    describe('Spring forward (March DST transition)', () => {
      // Europe/Bucharest springs forward on last Sunday of March
      // 2026: March 29 at 03:00 → 04:00 (EET → EEST)

      it('derives correct company day just before spring forward', () => {
        // 2026-03-29 01:30 UTC = 2026-03-29 03:30 EET (still winter time)
        jest.useFakeTimers().setSystemTime(new Date('2026-03-29T01:30:00.000Z'));

        const todayIso = companyDateIso();
        expect(todayIso).toBe('2026-03-29');
      });

      it('derives correct company day after spring forward', () => {
        // 2026-03-29 03:30 UTC = 2026-03-29 06:30 EEST (summer time, jumped from 04:00 to 05:00)
        jest.useFakeTimers().setSystemTime(new Date('2026-03-29T03:30:00.000Z'));

        const todayIso = companyDateIso();
        expect(todayIso).toBe('2026-03-29');
      });

      it('derives correct company day during the transition hour', () => {
        // 2026-03-29 02:00 UTC = 04:00 EEST (the skipped hour becomes 05:00)
        // This tests that Intl handles the non-existent local time correctly
        jest.useFakeTimers().setSystemTime(new Date('2026-03-29T02:00:00.000Z'));

        const todayIso = companyDateIso();
        expect(todayIso).toBe('2026-03-29');
      });

      it('attendance check-in on spring-forward night uses correct calendar date', () => {
        // 2026-03-28 23:00 UTC = 2026-03-29 01:00 EET
        // This is still March 29 in company calendar
        jest.useFakeTimers().setSystemTime(new Date('2026-03-28T23:00:00.000Z'));

        const todayIso = companyDateIso();
        expect(todayIso).toBe('2026-03-29');

        // Company day for this instant
        const companyDate = companyDayFor();
        expect(companyDate.toISOString()).toBe('2026-03-29T00:00:00.000Z');
      });
    });

    describe('Fall back (October DST transition)', () => {
      // Europe/Bucharest falls back on last Sunday of October
      // 2026: October 25 at 04:00 → 03:00 (EEST → EET)

      it('derives correct company day just before fall back', () => {
        // 2026-10-25 00:30 UTC = 2026-10-25 03:30 EEST (still summer time)
        jest.useFakeTimers().setSystemTime(new Date('2026-10-25T00:30:00.000Z'));

        const todayIso = companyDateIso();
        expect(todayIso).toBe('2026-10-25');
      });

      it('derives correct company day after fall back', () => {
        // 2026-10-25 02:30 UTC = 2026-10-25 04:30 EET (winter time, after falling back)
        jest.useFakeTimers().setSystemTime(new Date('2026-10-25T02:30:00.000Z'));

        const todayIso = companyDateIso();
        expect(todayIso).toBe('2026-10-25');
      });

      it('derives correct company day during the repeated hour', () => {
        // The hour 03:00-04:00 occurs twice (once in EEST, once in EET)
        // 2026-10-25 01:00 UTC could be 04:00 EEST OR 04:00 EET depending on interpretation
        // Intl handles this by picking the first occurrence (still EEST)
        jest.useFakeTimers().setSystemTime(new Date('2026-10-25T01:00:00.000Z'));

        const todayIso = companyDateIso();
        expect(todayIso).toBe('2026-10-25');
      });

      it('attendance check-out on fall-back night uses correct calendar date', () => {
        // 2026-10-24 22:00 UTC = 2026-10-25 01:00 EEST
        // This is October 25 in company calendar
        jest.useFakeTimers().setSystemTime(new Date('2026-10-24T22:00:00.000Z'));

        const todayIso = companyDateIso();
        expect(todayIso).toBe('2026-10-25');

        const companyDate = companyDayFor();
        expect(companyDate.toISOString()).toBe('2026-10-25T00:00:00.000Z');
      });
    });

    describe('Month filtering across DST boundaries', () => {
      it('March 2026 month bounds are correct (contains spring-forward)', () => {
        const marchStart = companyDay('2026-03-01');
        const marchEnd = companyDay('2026-03-31');

        expect(marchStart.toISOString()).toBe('2026-03-01T00:00:00.000Z');
        expect(marchEnd.toISOString()).toBe('2026-03-31T00:00:00.000Z');
      });

      it('October 2026 month bounds are correct (contains fall-back)', () => {
        const octStart = companyDay('2026-10-01');
        const octEnd = companyDay('2026-10-31');

        expect(octStart.toISOString()).toBe('2026-10-01T00:00:00.000Z');
        expect(octEnd.toISOString()).toBe('2026-10-31T00:00:00.000Z');
      });
    });

    describe('Company day at edge times', () => {
      it('22:00 UTC on last day of month is next calendar day in Europe/Bucharest', () => {
        // 2026-01-31 22:00 UTC = 2026-02-01 00:00 EET
        jest.useFakeTimers().setSystemTime(new Date('2026-01-31T22:00:00.000Z'));

        const todayIso = companyDateIso();
        expect(todayIso).toBe('2026-02-01');
      });

      it('21:59 UTC on last day of month is still that day in Europe/Bucharest', () => {
        // 2026-01-31 21:59 UTC = 2026-01-31 23:59 EET
        jest.useFakeTimers().setSystemTime(new Date('2026-01-31T21:59:00.000Z'));

        const todayIso = companyDateIso();
        expect(todayIso).toBe('2026-01-31');
      });

      it('00:01 UTC is 02:01 local time (next calendar day in winter)', () => {
        // 2026-01-01 00:01 UTC = 2026-01-01 02:01 EET
        jest.useFakeTimers().setSystemTime(new Date('2026-01-01T00:01:00.000Z'));

        const todayIso = companyDateIso();
        expect(todayIso).toBe('2026-01-01');
      });

      it('00:01 UTC is 03:01 local time (next calendar day in summer)', () => {
        // 2026-07-01 00:01 UTC = 2026-07-01 03:01 EEST
        jest.useFakeTimers().setSystemTime(new Date('2026-07-01T00:01:00.000Z'));

        const todayIso = companyDateIso();
        expect(todayIso).toBe('2026-07-01');
      });
    });
  });

  describe('Timezone configuration', () => {
    it('defaults to Europe/Bucharest when COMPANY_TZ is unset', () => {
      const tz = companyTimeZone({});
      expect(tz).toBe('Europe/Bucharest');
    });

    it('respects COMPANY_TZ override', () => {
      const tz = companyTimeZone({ COMPANY_TZ: 'America/New_York' });
      expect(tz).toBe('America/New_York');
    });

    it('trims whitespace from COMPANY_TZ', () => {
      const tz = companyTimeZone({ COMPANY_TZ: '  Europe/Berlin  ' });
      expect(tz).toBe('Europe/Berlin');
    });

    it('falls back to default for blank COMPANY_TZ', () => {
      const tz = companyTimeZone({ COMPANY_TZ: '' });
      expect(tz).toBe('Europe/Bucharest');
    });
  });
});
