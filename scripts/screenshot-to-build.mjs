/**
 * Screenshot → build pipeline (vision + catalog map + sprite match).
 *
 * Flow:
 *  1) Vision LLM lists items with name + cell + size + rotation
 *  2) Names resolve to Supabase catalog; footprints validated vs item-shapes.json
 *  3) NCC sprite confirm; weak / shape-mismatch → cropped shortlist re-ask
 *
 * Usage:
 *   node scripts/screenshot-to-build.mjs path/to/shot.png
 *
 * Env:
 *   OPENAI_API_KEY (preferred) or OPENROUTER_API_KEY
 *   STB_PROVIDER=openai|openrouter
 *   OPENAI_MODEL (default gpt-4.1)
 *   OPENAI_MODEL_SHORTLIST (default gpt-4.1-mini)
 *   STB_SKIP_SPRITE=1
 *   SUPABASE_DB_URL + SUPABASE_DB_PASSWORD
 *   OR_MODEL, OR_TIMEOUT_MS, OR_MAX_TOKENS
 *   STB_VISION_CACHE
 */
import './screenshot-to-build/index.mjs';
