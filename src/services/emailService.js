/**
 * MU Accounts - Enterprise Email Service
 * Powered by Resend API (https://resend.com)
 *
 * Free Tier: 3,000 emails / month (100 emails / day)
 * Dispatches live transactional emails, OTP verification codes,
 * and automated daily/weekly financial summary digests.
 */

// Default verified dispatch address or sandbox domain
export const DEFAULT_RESEND_FROM = "MU Accounts <onboarding@resend.dev>";
export const COMPANY_OWNER_EMAIL = "meganfullsd@gmail.com";

/**
 * Get active Resend API key from localStorage or fallback
 */
export const getResendApiKey = () => {
  return localStorage.getItem('rsp_resend_api_key') || '';
};

/**
 * Set and persist Resend API key
 */
export const setResendApiKey = (key) => {
  const cleanKey = (key || '').trim();
  localStorage.setItem('rsp_resend_api_key', cleanKey);
  return cleanKey;
};

/**
 * Send an email using Resend REST API
 * @param {Object} options
 * @param {string|string[]} options.to - Recipient email(s)
 * @param {string} options.subject - Email subject
 * @param {string} options.html - HTML content
 * @param {string} [options.text] - Plaintext fallback
 * @param {string} [options.from] - Custom from address (if domain verified)
 */
export async function sendEmailWithResend({ to, subject, html, text, from = DEFAULT_RESEND_FROM }) {
  const apiKey = getResendApiKey();
  const recipients = Array.isArray(to) ? to : [to];

  // If no API key configured, return diagnostic failure
  if (!apiKey) {
    console.warn('[Resend Email Service] No Resend API key configured in Settings.');
    return {
      success: false,
      error: 'Resend API key missing. Please configure your Resend API key in Profile & Settings.',
      code: 'MISSING_API_KEY',
      recipients
    };
  }

  try {
    const payload = {
      from,
      to: recipients,
      subject,
      html,
      text: text || html.replace(/<[^>]+>/g, ' ')
    };

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.error('[Resend Email API Error]:', data);
      return {
        success: false,
        error: data.message || `Resend HTTP ${response.status}: Failed to send email.`,
        code: data.name || 'RESEND_API_ERROR',
        status: response.status,
        details: data
      };
    }

    console.info('[Resend Email Dispatched Successfully]:', data);
    return {
      success: true,
      id: data.id,
      recipients,
      timestamp: new Date().toISOString()
    };
  } catch (err) {
    console.error('[Resend Network Exception]:', err);
    return {
      success: false,
      error: err.message || 'Network error connecting to Resend API.',
      code: 'NETWORK_ERROR'
    };
  }
}

/**
 * Dispatch 6-Digit Security OTP Email via Resend
 */
export async function sendOtpEmailResend({ userEmail, otpCode, purpose = 'Account Access' }) {
  const subject = `🔐 [MU Accounts] Your Security Verification Code: ${otpCode}`;
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f172a; margin: 0; padding: 24px; color: #f8fafc; }
        .card { max-width: 520px; margin: 0 auto; background: #1e293b; border-radius: 20px; border: 1px solid #334155; padding: 32px; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5); }
        .brand { display: flex; align-items: center; gap: 12px; margin-bottom: 24px; }
        .brand-title { font-size: 20px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px; }
        .badge { display: inline-block; padding: 4px 10px; background: #3b82f6; color: #ffffff; border-radius: 9999px; font-size: 11px; font-weight: 700; text-transform: uppercase; }
        .otp-box { background: #0f172a; border: 2px dashed #6366f1; border-radius: 16px; padding: 20px; text-align: center; margin: 24px 0; }
        .otp-digits { font-size: 38px; font-weight: 900; letter-spacing: 8px; color: #38bdf8; font-family: monospace; }
        .info { font-size: 13px; color: #94a3b8; line-height: 1.6; margin-bottom: 20px; }
        .footer { font-size: 11px; color: #64748b; border-top: 1px solid #334155; padding-top: 16px; margin-top: 24px; text-align: center; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="brand">
          <div class="brand-title">MU Accounts Enterprise ERP</div>
        </div>
        <span class="badge">Security Verification</span>
        <h2 style="font-size: 18px; margin-top: 12px; color: #ffffff;">Verify Your Identity for ${purpose}</h2>
        <p class="info">
          A request was initiated from <strong>MU Accounts Software</strong> to verify account credentials for <strong>${userEmail}</strong>.
        </p>
        <div class="otp-box">
          <div style="font-size: 11px; color: #a5b4fc; text-transform: uppercase; font-weight: 700; margin-bottom: 6px;">Your 6-Digit One-Time Code</div>
          <div class="otp-digits">${otpCode}</div>
          <div style="font-size: 11px; color: #64748b; margin-top: 6px;">Valid for 10 minutes. Do not share this code.</div>
        </div>
        <p class="info">
          If you did not initiate this request, please change your security PIN immediately or contact the system administrator at <a href="mailto:meganfullsd@gmail.com" style="color: #38bdf8;">meganfullsd@gmail.com</a>.
        </p>
        <div class="footer">
          &copy; ${new Date().getFullYear()} MU Accounts Software &bull; Cloud ERP System &bull; Dispatched via Resend
        </div>
      </div>
    </body>
    </html>
  `;

  return await sendEmailWithResend({
    to: userEmail,
    subject,
    html
  });
}

/**
 * Dispatch Financial Digest Report Email via Resend
 */
export async function sendFinancialDigestEmailResend({ targetEmail, digestData }) {
  const freq = (digestData.frequency || 'Daily').toUpperCase();
  const subject = `📊 [MU Accounts] ${freq} Financial Digest & Performance Report`;
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; padding: 24px; color: #1e293b; }
        .card { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; padding: 28px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
        .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #3b82f6; padding-bottom: 16px; margin-bottom: 20px; }
        .title { font-size: 18px; font-weight: 800; color: #0f172a; }
        .pill { background: #dbeafe; color: #1e40af; font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 9999px; }
        .metric-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px; }
        .metric { background: #f1f5f9; border-radius: 12px; padding: 14px; }
        .metric-label { font-size: 11px; color: #64748b; font-weight: 600; text-transform: uppercase; }
        .metric-val { font-size: 18px; font-weight: 800; color: #0f172a; margin-top: 4px; }
        .footer { font-size: 11px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 14px; margin-top: 24px; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="header">
          <div>
            <div class="title">MU Accounts Financial Summary</div>
            <div style="font-size: 12px; color: #64748b;">Automated Scheduled Digest &bull; ${new Date().toLocaleDateString('en-IN', { dateStyle: 'full' })}</div>
          </div>
          <span class="pill">${freq} DIGEST</span>
        </div>
        
        <p style="font-size: 13px; color: #475569; margin-bottom: 16px;">
          Here is your automated business performance snapshot generated for <strong>${digestData.businessName || 'MU Accounts'}</strong>.
        </p>

        <div class="metric-grid">
          <div class="metric">
            <div class="metric-label">Gross Revenue</div>
            <div class="metric-val" style="color: #2563eb;">₹${(digestData.totalSales || 0).toLocaleString('en-IN')}</div>
          </div>
          <div class="metric">
            <div class="metric-label">Purchase Inward</div>
            <div class="metric-val" style="color: #7c3aed;">₹${(digestData.totalPurchases || 0).toLocaleString('en-IN')}</div>
          </div>
          <div class="metric">
            <div class="metric-label">Operating Expenses</div>
            <div class="metric-val" style="color: #e11d48;">₹${(digestData.totalExpenses || 0).toLocaleString('en-IN')}</div>
          </div>
          <div class="metric">
            <div class="metric-label">Overdue Aging (>25d)</div>
            <div class="metric-val" style="color: #ea580c;">₹${(digestData.overdueReceivables || 0).toLocaleString('en-IN')}</div>
          </div>
        </div>

        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px; font-size: 12px; color: #334155;">
          <strong>Active Outlets:</strong> ${digestData.branchCount || 2} Branches &bull; 
          <strong>Departments:</strong> ${digestData.departmentCount || 6} Divisions &bull;
          <strong>Generated at:</strong> ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} (IST)
        </div>

        <div class="footer">
          Dispatched from <strong>meganfullsd@gmail.com</strong> via Resend API to <strong>${targetEmail}</strong>.<br/>
          MU Accounts Enterprise Cloud ERP &copy; ${new Date().getFullYear()}
        </div>
      </div>
    </body>
    </html>
  `;

  return await sendEmailWithResend({
    to: targetEmail,
    subject,
    html
  });
}
