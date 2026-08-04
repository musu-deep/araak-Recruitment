const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const allowedTypes = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
]);

const outputSchema = {
  type: 'object',
  properties: {
    first_name: { type: 'string' },
    father_name: { type: 'string' },
    grand_name: { type: 'string' },
    family_name: { type: 'string' },
    email: { type: 'string' },
    mobile: { type: 'string' },
    birth_date: { type: 'string', description: 'ISO date YYYY-MM-DD when explicitly present' },
    birth_place: { type: 'string' },
    nationality: { type: 'string', description: 'ISO 3166-1 alpha-2 country code when confidently known' },
    gender: { type: 'string', enum: ['', 'male', 'female'] },
    desired_position: { type: 'string' },
    department: { type: 'string' },
    current_address: { type: 'string' },
    hobbies: { type: 'string' },
    experiences: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          company: { type: 'string' },
          position: { type: 'string' },
          city_country: { type: 'string' },
          start_date: { type: 'string', description: 'YYYY-MM when available' },
          end_date: { type: 'string', description: 'YYYY-MM when available' },
          currently_working: { type: 'boolean' },
          responsibilities: { type: 'string' },
        },
      },
    },
    education: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          degree: { type: 'string' },
          major: { type: 'string' },
          institution: { type: 'string' },
          graduation_year: { type: 'integer' },
          grade: { type: 'string' },
        },
      },
    },
    training: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          course_name: { type: 'string' },
          provider: { type: 'string' },
          course_date: { type: 'string', description: 'YYYY-MM when available' },
        },
      },
    },
    languages: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          language_name: { type: 'string' },
          level: { type: 'string', enum: ['', 'beginner', 'intermediate', 'advanced', 'expert', 'native'] },
        },
      },
    },
    skills: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          skill_name: { type: 'string' },
          level: { type: 'string', enum: ['', 'beginner', 'intermediate', 'advanced', 'expert'] },
        },
      },
    },
  },
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
  });
}

function cleanObject(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(cleanObject).filter((item) => item !== undefined);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .map(([key, item]) => [key, cleanObject(item)])
        .filter(([, item]) => item !== undefined && item !== '' && item !== null),
    );
  }
  if (typeof value === 'string') return value.trim();
  return value;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const { fileName, mimeType, base64 } = await request.json();
    if (!fileName || !mimeType || !base64) return json({ error: 'fileName, mimeType and base64 are required' }, 400);
    if (!allowedTypes.has(String(mimeType))) return json({ error: 'Unsupported CV file type' }, 415);
    if (String(base64).length > 14_500_000) return json({ error: 'CV exceeds the 10 MB limit' }, 413);

    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) return json({ error: 'Smart CV parsing is not configured' }, 503);

    const model = Deno.env.get('GEMINI_MODEL') || 'gemini-3.6-flash';
    const prompt = [
      'Extract recruitment information from this CV.',
      'Return only information explicitly supported by the document.',
      'Do not guess sensitive or missing personal data.',
      'Use ISO dates and ISO two-letter nationality codes where possible.',
      'Write names and free-text fields in the language used by the CV.',
      `Source filename: ${String(fileName)}`,
    ].join('\n');

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          contents: [{
            role: 'user',
            parts: [
              { text: prompt },
              { inlineData: { mimeType: String(mimeType), data: String(base64) } },
            ],
          }],
          generationConfig: {
            responseFormat: {
              text: { mimeType: 'application/json', schema: outputSchema },
            },
          },
        }),
      },
    );

    const payload = await geminiResponse.json();
    if (!geminiResponse.ok) {
      console.error('Gemini CV parsing failed', payload);
      return json({ error: 'The CV could not be analysed' }, 502);
    }

    const text = payload?.candidates?.[0]?.content?.parts
      ?.map((part: { text?: string }) => part?.text || '')
      .join('')
      .trim();

    if (!text) return json({ error: 'No structured CV data was returned' }, 502);

    const fields = cleanObject(JSON.parse(text));
    return json({ fields, model });
  } catch (error) {
    console.error(error);
    return json({ error: error instanceof Error ? error.message : 'Unexpected CV parsing error' }, 500);
  }
});
