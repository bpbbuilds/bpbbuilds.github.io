/**
 * Moderated player blob-cosmetic submissions.
 *
 * - A valid Discord/Supabase JWT is required for every action.
 * - Player art is stored in a private bucket and never made public from a
 *   browser request.
 * - Only profiles.is_owner may list or decide queue entries.
 * - Approval copies the validated image into the owner-visible catalog as an
 *   unpublished draft. The owner edits metadata before publishing it.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const MAX_BODY_BYTES = 3 * 1024 * 1024;
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const SUBMISSION_BUCKET = 'cosmetic-submissions';
const CATALOG_BUCKET = 'cosmetic-assets';
const SLOTS = new Set(['hat', 'face', 'neck', 'head', 'body', 'hand']);
const RARITIES = new Set(['Common', 'Rare', 'Epic', 'Legendary', 'Godly', 'Unique']);
const STATUSES = new Set(['pending', 'approved', 'rejected']);
const ALLOWED_ORIGINS = new Set([
  'https://bpbbuilds.com',
  'https://www.bpbbuilds.com',
  'https://bpbbuilds.github.io',
  'http://127.0.0.1:5500',
  'http://localhost:5500',
  'http://127.0.0.1:5501',
  'http://localhost:5501',
]);

type Action = 'submit' | 'list' | 'review';
type Body = {
  action?: Action;
  status?: string;
  id?: string;
  decision?: 'approve' | 'reject';
  cosmetic?: Record<string, unknown>;
};

function cors(req: Request) {
  const origin = String(req.headers.get('Origin') || '');
  return {
    ...(ALLOWED_ORIGINS.has(origin) ? { 'Access-Control-Allow-Origin': origin } : {}),
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
}

function json(req: Request, data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors(req), 'Content-Type': 'application/json' },
  });
}

function clip(value: unknown, max: number) {
  return String(value ?? '').trim().slice(0, max);
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function parseImage(dataUrl: string) {
  const match = /^data:(image\/(?:png|webp));base64,([A-Za-z0-9+/=\s]+)$/i.exec(dataUrl);
  if (!match) return null;
  const mime = match[1].toLowerCase();
  const encoded = match[2].replace(/\s+/g, '');
  if (!encoded || encoded.length > 4 * 1024 * 1024) return null;
  try {
    const raw = atob(encoded);
    const bytes = Uint8Array.from(raw, (char) => char.charCodeAt(0));
    if (!bytes.length || bytes.length > MAX_IMAGE_BYTES) return null;
    const png =
      bytes.length >= 8 &&
      bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
      bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a;
    const webp =
      bytes.length >= 12 &&
      bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
      bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
    if ((mime === 'image/png' && !png) || (mime === 'image/webp' && !webp)) return null;
    return { mime, bytes, extension: mime === 'image/png' ? 'png' : 'webp' };
  } catch {
    return null;
  }
}

async function authenticate(req: Request, supabaseUrl: string, anonKey: string) {
  const jwt = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!jwt) return null;
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
  const { data } = await userClient.auth.getUser();
  return data.user || null;
}

async function ownerProfile(supabase: ReturnType<typeof createClient>, userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('is_owner')
    .eq('id', userId)
    .maybeSingle();
  return !error && data?.is_owner === true;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    const origin = String(req.headers.get('Origin') || '');
    if (origin && !ALLOWED_ORIGINS.has(origin)) return json(req, { error: 'Origin not allowed' }, 403);
    return new Response('ok', { headers: cors(req) });
  }
  if (req.method !== 'POST') return json(req, { error: 'Method not allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
  if (!supabaseUrl || !serviceKey || !anonKey) return json(req, { error: 'Server misconfigured' }, 500);

  const contentLength = Number(req.headers.get('content-length') || 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return json(req, { error: 'Submission is too large.' }, 413);
  }
  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) return json(req, { error: 'Submission is too large.' }, 413);
  let body: Body;
  try {
    body = JSON.parse(raw);
  } catch {
    return json(req, { error: 'Invalid JSON' }, 400);
  }

  const user = await authenticate(req, supabaseUrl, anonKey);
  if (!user) return json(req, { error: 'Sign in with Discord first.' }, 401);
  const supabase = createClient(supabaseUrl, serviceKey);
  const action = String(body.action || '').trim() as Action;

  if (action === 'submit') return submit(req, supabase, user.id, body.cosmetic);
  if (action === 'list') {
    if (!(await ownerProfile(supabase, user.id))) return json(req, { error: 'Owner access required.' }, 403);
    return list(req, supabase, String(body.status || 'pending'));
  }
  if (action === 'review') {
    if (!(await ownerProfile(supabase, user.id))) return json(req, { error: 'Owner access required.' }, 403);
    return review(req, supabase, user.id, String(body.id || ''), String(body.decision || ''));
  }
  return json(req, { error: 'Unknown action.' }, 400);
});

async function submit(
  req: Request,
  supabase: ReturnType<typeof createClient>,
  userId: string,
  raw: Record<string, unknown> | undefined,
) {
  const name = clip(raw?.name, 120);
  const cosmeticId = clip(raw?.id, 81).toLowerCase();
  const slot = clip(raw?.slot, 40).toLowerCase();
  const rarity = clip(raw?.rarity, 40);
  const description = clip(raw?.description, 500);
  const image = parseImage(clip(raw?.imageData, MAX_BODY_BYTES));
  if (!name || !/^[a-z0-9][a-z0-9_-]{1,80}$/.test(cosmeticId) || !SLOTS.has(slot) || !RARITIES.has(rarity) || !image) {
    return json(req, { error: 'Invalid cosmetic submission.' }, 400);
  }

  const { data: allowed, error: limitError } = await supabase.rpc('consume_security_rate_limit', {
    p_endpoint: 'cosmetic-submissions',
    p_subject_id: userId,
    p_limit: 3,
    p_window: '24 hours',
  });
  if (limitError || allowed !== true) {
    return json(req, { error: 'You can submit up to three cosmetics per day.' }, 429);
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', userId)
    .maybeSingle();
  if (profileError || !profile) return json(req, { error: 'Could not load your profile.' }, 403);
  const submissionId = crypto.randomUUID();
  const imagePath = `submissions/${submissionId}.${image.extension}`;
  const { error: uploadError } = await supabase.storage.from(SUBMISSION_BUCKET).upload(imagePath, image.bytes, {
    contentType: image.mime,
    cacheControl: '0',
    upsert: false,
  });
  if (uploadError) return json(req, { error: 'Could not store cosmetic art.' }, 500);

  const { data, error } = await supabase
    .from('cosmetic_submissions')
    .insert({
      id: submissionId,
      submitter_id: userId,
      submitter_label: clip(profile.display_name, 120) || 'Discord member',
      cosmetic_id: cosmeticId,
      name,
      slot,
      rarity,
      description,
      image_path: imagePath,
      image_mime: image.mime,
    })
    .select('id, created_at, status')
    .maybeSingle();
  if (error) {
    await supabase.storage.from(SUBMISSION_BUCKET).remove([imagePath]);
    return json(req, { error: 'Could not save cosmetic submission.' }, 500);
  }
  return json(req, { ok: true, submission: data }, 201);
}

async function list(req: Request, supabase: ReturnType<typeof createClient>, rawStatus: string) {
  const status = STATUSES.has(rawStatus) ? rawStatus : 'pending';
  const { data, error } = await supabase
    .from('cosmetic_submissions')
    .select('id,created_at,status,submitter_label,cosmetic_id,name,slot,rarity,description,image_path,image_mime,reviewed_at,published_cosmetic_id')
    .eq('status', status)
    .order('created_at', { ascending: true })
    .limit(100);
  if (error) return json(req, { error: 'Could not load cosmetic submissions.' }, 500);
  const submissions = await Promise.all((data || []).map(async (row) => {
    const { data: signed } = await supabase.storage.from(SUBMISSION_BUCKET).createSignedUrl(row.image_path, 60 * 60);
    return { ...row, image_url: signed?.signedUrl || null };
  }));
  return json(req, { submissions });
}

async function review(
  req: Request,
  supabase: ReturnType<typeof createClient>,
  reviewerId: string,
  id: string,
  decision: string,
) {
  if (!isUuid(id) || (decision !== 'approve' && decision !== 'reject')) {
    return json(req, { error: 'Invalid review request.' }, 400);
  }
  const { data: submission, error } = await supabase
    .from('cosmetic_submissions')
    .select('id,status,submitter_label,cosmetic_id,name,slot,rarity,description,image_path,image_mime')
    .eq('id', id)
    .maybeSingle();
  if (error || !submission) return json(req, { error: 'Submission not found.' }, 404);
  if (submission.status !== 'pending') return json(req, { error: 'This submission has already been reviewed.' }, 409);

  const reviewedAt = new Date().toISOString();
  if (decision === 'reject') {
    const { data, error: rejectError } = await supabase
      .from('cosmetic_submissions')
      .update({ status: 'rejected', reviewed_by: reviewerId, reviewed_at: reviewedAt })
      .eq('id', id)
      .eq('status', 'pending')
      .select('id,status,reviewed_at')
      .maybeSingle();
    if (rejectError) return json(req, { error: 'Could not reject submission.' }, 500);
    if (!data) return json(req, { error: 'This submission was just reviewed elsewhere.' }, 409);
    return json(req, { ok: true, submission: data });
  }

  const { data: existing, error: existingError } = await supabase
    .from('cosmetic_drops')
    .select('id')
    .eq('id', submission.cosmetic_id)
    .maybeSingle();
  if (existingError) return json(req, { error: 'Could not check cosmetic id.' }, 500);
  if (existing) return json(req, { error: 'That cosmetic id is already in the catalog. Reject it or choose a different submission.' }, 409);

  const { data: imageBlob, error: downloadError } = await supabase.storage.from(SUBMISSION_BUCKET).download(submission.image_path);
  if (downloadError || !imageBlob) return json(req, { error: 'Could not read submitted art.' }, 500);
  const extension = submission.image_mime === 'image/webp' ? 'webp' : 'png';
  const catalogPath = `cosmetic-drops/${submission.cosmetic_id}.${extension}`;
  const { error: uploadError } = await supabase.storage.from(CATALOG_BUCKET).upload(catalogPath, imageBlob, {
    contentType: submission.image_mime,
    cacheControl: '31536000',
    upsert: false,
  });
  if (uploadError) return json(req, { error: 'Could not save approved art.' }, 500);

  const publicImage = `${Deno.env.get('SUPABASE_URL') || ''}/storage/v1/object/public/${CATALOG_BUCKET}/${catalogPath}`;
  const catalogRow = {
    id: submission.cosmetic_id,
    name: submission.name,
    slot: submission.slot,
    rarity: submission.rarity,
    grant: 'starter',
    description: submission.description,
    image: publicImage,
    artist: submission.submitter_label,
    owner: submission.submitter_label,
    kind: 'part',
    starter: true,
    swatch: '#8a5a2b',
    cost: null,
    added: new Date().toISOString().slice(0, 10),
    // Approval adds the art to the owner-visible catalog only. It must not
    // become public or announce through Discord until the owner publishes it.
    published: false,
  };
  const { data: cosmetic, error: catalogError } = await supabase
    .from('cosmetic_drops')
    .insert(catalogRow)
    .select('id,name,slot,rarity,grant,description,image,artist,owner,kind,starter,swatch,cost,added,published')
    .maybeSingle();
  if (catalogError) {
    await supabase.storage.from(CATALOG_BUCKET).remove([catalogPath]);
    return json(req, { error: 'Could not create catalog cosmetic.' }, 500);
  }
  const { data: reviewed, error: reviewError } = await supabase
    .from('cosmetic_submissions')
    .update({
      status: 'approved',
      reviewed_by: reviewerId,
      reviewed_at: reviewedAt,
      published_cosmetic_id: submission.cosmetic_id,
    })
    .eq('id', id)
    .eq('status', 'pending')
    .select('id,status,reviewed_at,published_cosmetic_id')
    .maybeSingle();
  if (reviewError || !reviewed) {
    return json(req, { error: 'Catalog cosmetic was created, but the queue could not be updated. Refresh before retrying.' }, 500);
  }
  return json(req, { ok: true, submission: reviewed, cosmetic });
}
