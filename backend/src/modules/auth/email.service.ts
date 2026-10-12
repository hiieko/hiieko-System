import { Injectable, Logger } from '@nestjs/common';

/**
 * Minimal transactional email sender (Phase 3, Piece 1 — password reset).
 *
 * Provider: Resend — chosen for its flat free tier (100 emails/day) and a one-call
 * REST API that needs no SDK dependency. Sending uses Node's global `fetch`, so no
 * new package is installed.
 *
 * Degradation rules:
 * - No `RESEND_API_KEY` configured (e.g. local dev before the key is supplied):
 *   the send is a no-op that logs a warning. The caller still returns 200, so the
 *   API never leaks whether an account exists.
 * - A provider error is thrown up to AuthService, which logs it and still answers
 *   200 (see forgotPassword) for the same reason.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  async sendPasswordReset(to: string, rawToken: string): Promise<void> {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      this.logger.warn(`[EMAIL] RESEND_API_KEY is not set — skip reset email to ${to}`);
      return;
    }

    const from = process.env.RESEND_FROM || 'HIIEKO <noreply@hiieko.app>';
    const appUrl = (process.env.PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/+$/, '');
    const resetUrl = `${appUrl}/forgot-password/reset?token=${encodeURIComponent(rawToken)}`;

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject: 'Reset your HIIEKO password',
        text: [
          'You asked to reset your HIIEKO password.',
          '',
          `Open this link to choose a new password (it stays valid for 30 minutes):`,
          resetUrl,
          '',
          'If you did not request this, you can safely ignore this email.',
        ].join('\n'),
        html: [
          '<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#0f172a">',
          '  <p style="margin:0 0 8px">You asked to reset your HIIEKO password.</p>',
          '  <p style="margin:0 0 16px">Open the button below to choose a new password. The link stays valid for <strong>30 minutes</strong>.</p>',
          '  <p style="margin:0 0 16px"><a href="' + resetUrl + '" style="display:inline-block;padding:10px 18px;background-color:#2563eb;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:bold">Reset your password</a></p>',
          '  <p style="margin:0 0 8px;font-size:12px;color:#64748b">Or paste this link into your browser:</p>',
          '  <p style="margin:0 0 16px;font-size:12px;color:#64748b;word-break:break-all">' + resetUrl + '</p>',
          '  <p style="margin:0;font-size:12px;color:#64748b">If you did not request this, you can safely ignore this email.</p>',
          '</div>',
        ].join(''),
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(`Resend API error ${response.status}: ${detail}`);
    }

    this.logger.log(`[EMAIL] password reset email sent to ${to}`);
  }
}