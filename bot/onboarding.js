/**
 * Server onboarding. Everyone gets the main channels.
 * A question adds the forums and the extra info channels.
 */
const API = 'https://discord.com/api/v10';

const WELCOME = '1554348212423368835';
const RULES = '1555345682678943829';
const NEWS = '1555346068298924052';
const MAIN = '1554346073974243448';
const BUILDS = '1553880481001644062';
const EVENTS = '1555378550750584843';
const BOTS = '1555306905067323402';
const IDEAS = '1554346585729540096';
const COSMETICS = '1555344242690359387';
const PAST = '1555394602549383188';
const QUEST = '1555379005916446882';
const MARKET = '1555376106486370314';
const PREMIUM = '1555374702069948486';

const DEFAULTS = [WELCOME, RULES, NEWS, MAIN, BUILDS, EVENTS, BOTS];
const PROMPT_TITLE = 'What else do you want to see?';

let snowflakeSeq = 1n;

function snowflake() {
  snowflakeSeq += 1n;
  const ts = BigInt(Date.now()) - 1420070400000n;
  return ((ts << 22n) | snowflakeSeq).toString();
}

/**
 * @param {string} token
 * @param {string} apiPath
 * @param {string} [method]
 * @param {object | null} [body]
 */
async function discord(token, apiPath, method = 'GET', body) {
  return fetch(`${API}${apiPath}`, {
    method,
    headers: {
      Authorization: `Bot ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

/**
 * @param {{ id?: string, title?: string, options?: { id?: string, title?: string }[] } | undefined} current
 * @param {string} title
 * @param {string} description
 * @param {string} emoji
 * @param {string} channelId
 */
function option(current, title, description, emoji, channelId) {
  const found = current?.options?.find((row) => row.title === title);
  return {
    id: found?.id || snowflake(),
    title,
    description,
    emoji_id: null,
    emoji_name: emoji,
    emoji_animated: false,
    channel_ids: [channelId],
    role_ids: [],
  };
}

/**
 * @param {Record<string, string>} env
 */
export async function syncOnboarding(env) {
  const token = env.DISCORD_BOT_TOKEN || '';
  const guildId = env.DISCORD_GUILD_ID || '';
  if (!token || !guildId) {
    console.error('Onboarding skipped: missing Discord env');
    return;
  }
  const currentRes = await discord(token, `/guilds/${guildId}/onboarding`);
  const current = currentRes.ok ? await currentRes.json() : {};
  const prompt = (current.prompts || []).find((row) => row.title === PROMPT_TITLE);
  const body = {
    enabled: true,
    mode: 1,
    default_channel_ids: DEFAULTS,
    prompts: [{
      id: prompt?.id || snowflake(),
      type: 0,
      title: PROMPT_TITLE,
      single_select: false,
      required: false,
      in_onboarding: true,
      options: [
        option(prompt, 'Item ideas', 'Suggest an item', '💡', IDEAS),
        option(prompt, 'Cosmetics', 'Submit a blob cosmetic', '🎀', COSMETICS),
        option(prompt, 'Past events', 'Finished events', '🏁', PAST),
        option(prompt, 'Quest', 'Quest updates', '🧭', QUEST),
        option(prompt, 'Market', 'Market movement', '📈', MARKET),
        option(prompt, 'Premium', 'What Premium includes', '👑', PREMIUM),
      ],
    }],
  };
  let patched = await discord(token, `/guilds/${guildId}/onboarding`, 'PATCH', body);
  if (patched.status === 405) patched = await discord(token, `/guilds/${guildId}/onboarding`, 'PUT', body);
  if (!patched.ok) {
    const detail = await patched.text();
    console.error(`Onboarding failed (${patched.status}): ${detail.slice(0, 300)}`);
    return;
  }
  console.log('Onboarding is on');
}
