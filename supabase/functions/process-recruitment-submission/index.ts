import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
  });
}

function escapeHtml(value: unknown) {
  return String(value ?? '').replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  })[character]!);
}

function readSecretKey() {
  const legacy = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (legacy) return legacy;
  try {
    const keys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}');
    return keys.default || Object.values(keys)[0] || '';
  } catch {
    return '';
  }
}

async function sendEmail(to: string[], subject: string, html: string) {
  const resendKey = Deno.env.get('RESEND_API_KEY');
  const from = Deno.env.get('FROM_EMAIL');
  if (!resendKey || !from || !to.length) return { skipped: true };

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to, subject, html }),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload?.message || 'Email delivery failed');
  return payload;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = readSecretKey();
  if (!supabaseUrl || !serviceKey) return json({ error: 'Server database credentials are missing' }, 500);

  try {
    const { applicationId, submissionToken } = await request.json();
    if (!applicationId || !submissionToken) return json({ error: 'applicationId and submissionToken are required' }, 400);

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: application, error: applicationError } = await admin
      .from('employment_applications')
      .select('*')
      .eq('id', applicationId)
      .eq('submission_token', submissionToken)
      .single();

    if (applicationError || !application) return json({ error: 'Application was not found' }, 404);

    const [{ data: attachments }, { data: meeting }] = await Promise.all([
      admin.from('employment_attachments').select('file_name,file_path,file_type,file_size').eq('application_id', applicationId),
      admin.from('meeting_requests').select('*').eq('application_id', applicationId).maybeSingle(),
    ]);

    const form = application.data || {};
    const reference = `AR-${new Date().getUTCFullYear()}-${String(application.id).slice(0, 8).toUpperCase()}`;
    const applicantName = application.applicant_name || [form.first_name, form.father_name, form.family_name].filter(Boolean).join(' ');
    const desiredPosition = application.desired_position || form.desired_position || 'طلب توظيف عام';
    const department = form.department || 'غير محدد';
    const locationStatus = form.location_status === 'inside' ? 'داخل المملكة' : form.location_status === 'outside' ? 'خارج المملكة' : 'غير محدد';
    const attachmentNames = (attachments || []).map((item) => item.file_name).join('، ') || 'لا توجد مرفقات مسجلة';

    const summaryHtml = `
      <div dir="rtl" style="font-family:Arial,sans-serif;line-height:1.8;color:#17352c;max-width:720px;margin:auto">
        <h2 style="color:#0c6a4d">طلب توظيف جديد — مجموعة اراك</h2>
        <p><strong>رقم الطلب:</strong> ${escapeHtml(reference)}</p>
        <table style="border-collapse:collapse;width:100%">
          <tr><td style="padding:8px;border:1px solid #dde8e3"><strong>المتقدم</strong></td><td style="padding:8px;border:1px solid #dde8e3">${escapeHtml(applicantName)}</td></tr>
          <tr><td style="padding:8px;border:1px solid #dde8e3"><strong>الوظيفة</strong></td><td style="padding:8px;border:1px solid #dde8e3">${escapeHtml(desiredPosition)}</td></tr>
          <tr><td style="padding:8px;border:1px solid #dde8e3"><strong>القسم</strong></td><td style="padding:8px;border:1px solid #dde8e3">${escapeHtml(department)}</td></tr>
          <tr><td style="padding:8px;border:1px solid #dde8e3"><strong>الموقع</strong></td><td style="padding:8px;border:1px solid #dde8e3">${escapeHtml(locationStatus)}</td></tr>
          <tr><td style="padding:8px;border:1px solid #dde8e3"><strong>البريد</strong></td><td style="padding:8px;border:1px solid #dde8e3">${escapeHtml(application.email)}</td></tr>
          <tr><td style="padding:8px;border:1px solid #dde8e3"><strong>الجوال</strong></td><td style="padding:8px;border:1px solid #dde8e3">${escapeHtml(application.mobile)}</td></tr>
          <tr><td style="padding:8px;border:1px solid #dde8e3"><strong>الراتب المتوقع</strong></td><td style="padding:8px;border:1px solid #dde8e3">${escapeHtml(form.expected_salary)} ${escapeHtml(form.salary_currency)}</td></tr>
          <tr><td style="padding:8px;border:1px solid #dde8e3"><strong>المرفقات</strong></td><td style="padding:8px;border:1px solid #dde8e3">${escapeHtml(attachmentNames)}</td></tr>
          <tr><td style="padding:8px;border:1px solid #dde8e3"><strong>طلب مقابلة</strong></td><td style="padding:8px;border:1px solid #dde8e3">${meeting ? `${escapeHtml(meeting.preferred_date)} ${escapeHtml(meeting.preferred_time)} — بانتظار اعتماد الموارد البشرية` : 'لم يطلب المتقدم موعداً'}</td></tr>
        </table>
        <p style="margin-top:18px">البيانات الكاملة محفوظة في جدول <code>employment_applications</code>، والمرفقات في مخزن <code>employment-attachments</code>.</p>
      </div>`;

    const applicantHtml = `
      <div dir="rtl" style="font-family:Arial,sans-serif;line-height:1.9;color:#17352c;max-width:680px;margin:auto">
        <h2 style="color:#0c6a4d">تم استلام طلب التوظيف</h2>
        <p>الأستاذ/ة ${escapeHtml(applicantName)}،</p>
        <p>نشكر لك اهتمامك بالانضمام إلى مجموعة اراك للتنمية وشركاتها. تم استلام طلبك بنجاح وإحالته إلى فريق الموارد البشرية للمراجعة.</p>
        <p><strong>رقم الطلب:</strong> ${escapeHtml(reference)}</p>
        <p>طلب الموعد الذي تقترحه لا يُعد موعداً مؤكداً؛ سيتواصل الفريق معك لاعتماد الموعد أو اقتراح بديل.</p>
        <p>مع خالص التقدير،<br>فريق الموارد البشرية — مجموعة اراك للتنمية</p>
      </div>`;

    const hrEmail = Deno.env.get('HR_EMAIL') || 'louiabdalla1@gmail.com';
    const odooAlias = Deno.env.get('ODOO_RECRUITMENT_ALIAS') || '';
    const hrRecipients = [...new Set([hrEmail, odooAlias].filter(Boolean))];
    const delivery: Record<string, unknown> = {};
    let integrationStatus = 'completed';
    let integrationError: string | null = null;

    try {
      delivery.hr = await sendEmail(hrRecipients, `طلب توظيف جديد: ${applicantName || reference}`, summaryHtml);
      if (application.email) delivery.applicant = await sendEmail([application.email], `تأكيد استلام طلب التوظيف ${reference}`, applicantHtml);
      if ((delivery.hr as { skipped?: boolean })?.skipped) integrationStatus = 'stored';
    } catch (emailError) {
      integrationStatus = 'partial_failure';
      integrationError = emailError instanceof Error ? emailError.message : 'Email delivery failed';
    }

    await admin.from('employment_applications').update({
      integration_status: integrationStatus,
      integration_error: integrationError,
      confirmation_sent_at: delivery.applicant && !(delivery.applicant as { skipped?: boolean }).skipped ? new Date().toISOString() : null,
    }).eq('id', applicationId);

    return json({ ok: true, reference, integrationStatus, delivery });
  } catch (error) {
    console.error(error);
    return json({ error: error instanceof Error ? error.message : 'Unexpected processing error' }, 500);
  }
});
