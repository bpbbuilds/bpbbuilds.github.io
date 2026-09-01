/**
 * Modular BPB-style item tooltip renderer.
 *
 * Usage (no database yet):
 *   const el = ItemTooltip.render(itemData);
 *   container.appendChild(el);
 *
 * Later with Supabase:
 *   const { data: item } = await supabase.from('items').select('*').eq('id', id).single();
 *   container.appendChild(ItemTooltip.render(item));
 *
 * Expected item shape:
 * {
 *   name: "Blood Goobert",
 *   rarity: "Legendary",          // Common|Rare|Epic|Legendary|Godly|Unique
 *   type: "Pet",
 *   class: "Neutral",             // or ["Neutral"] / class list
 *   extraTypes: ["Vampiric"],     // optional tags shown as icons
 *   cost: 14,
 *   effect: "Start of battle: Gain 5 <Vampirism>.\n\n6 <Star> item activations: Deal 10 <Effect> with 100% lifesteal. Deal +1 for each <Vampirism>."
 * }
 */

(() => {
  const CDN = "https://awerc.github.io/bpb-cdn";

  /**
   * Glossary copy. Scan order must match game Tooltip.gd `keywords`
   * (spikes → vampirism → … → empower), not Object key insertion alone.
   */
  const KEYWORD_ORDER = [
    "Spikes",
    "Vampirism",
    "Poison",
    "Regeneration",
    "Block",
    "Luck",
    "Blind",
    "Mana",
    "Heat",
    "Cold",
    "Empower",
  ];

  /**
   * Glossary bodies from Keywords.csv (*_DESCR). Keep intentional \\n —
   * spikes_DESCR hard-breaks after "taking " so it stays 2 lines like the game.
   */
  const KEYWORDS = {
    Spikes: "Deals 1 damage when taking\n <Melee>-damage (up to 100% of the damage).",
    Vampirism: "Heals for 1 when dealing <Melee>-damage (up to 100% of the damage).",
    Poison: "Deals 1 damage every 2s.",
    Regeneration: "Heals for 1 every 2s.",
    Block: "Absorbs 1 damage.",
    Luck: "Increases accuracy by 5%.",
    Blind: "Decreases accuracy by 5%.",
    Mana: "Resource used by magic items.",
    Heat: "All items trigger 2% faster.",
    Cold: "All items trigger 2% slower.",
    Empower: "Weapons deal +1 damage.",
  };

  /**
   * Game TYPE_*_NAME / TYPE_*_DESCR (ItemTooltip.addReferenceExplanations).
   * Not part of item DESCR — appended under the main effect with the item's cooldown.
   */
  const TYPE_LABELS = {
    Card: "Playing Card",
    Gem: "Gemstone",
    Spell: "Spell",
  };

  const TYPE_DESCRIPTIONS = {
    // Keywords.csv TYPE_*_DESCR — not part of item DESCR
    Card: "On reveal: Starts revealing the <Star> Playing card. Revealing this card takes {cd}s.",
    Gem: "Can be placed in backpack or in gemstone sockets.",
    Potion:
      "After being consumed also applies the effect of the <Star> Potion above without consuming it.",
  };

  /** Cubes that extend Cube.gd (Hypercube does not). */
  const CUBE_IDS = new Set([
    "gold_cube",
    "plastic_cube",
    "chrome_cube",
    "bismuth_cube",
  ]);

  const SPIRIT_IDS = new Set(["cat_spirit", "owl_spirit", "badger_spirit"]);

  /**
   * Catalog-only lines from game getDescription overrides
   * (ItemTooltip library state — not placement/deck counters).
   */
  function catalogExtraLines(item) {
    const prepend = [];
    const append = [];
    const id = String(item.id || "");
    const params =
      item.params && typeof item.params === "object" ? item.params : {};

    if (item.requires) {
      prepend.push(`Requires: ${item.requires}.`);
    }

    if (CUBE_IDS.has(id)) {
      const penalty = params.penalty ?? params.p5 ?? 80;
      append.push(
        `If another cube advanced the <Star> item's cooldown before, cooldown advance is {red}reduced by{/red} ${penalty}%.`,
      );
    }

    if (SPIRIT_IDS.has(id)) {
      append.push("You can only have 1 Spirit Companion.");
    }

    if (id === "mr_struggles") {
      append.push("Plushies are offered in the shop.");
    }

    // shop field "Neutral 1" / "Neutral 2" / "Neutral 1,2" → appear rounds
    if (id === "just_stats") append.push("Always offered in round 1.");
    if (id === "more_stats") append.push("Always offered in round 2.");
    if (id === "unidentified_skill") {
      append.push("Always offered in rounds 1 and 2.");
    }

    return { prepend, append };
  }

  /** Game effect tags → CDN icon stem (or local asset). */
  const ICON_ALIAS = {
    Bl: "Block",
    bl: "Block",
    Regen: "Regeneration",
    Lucky: "Luck",
    Shopchance: "Luck",
    ShopChance: "Luck",
    Food: "Nature",
  };

  /** Property-row / type icons from game extract (local). */
  const LOCAL_TOOLTIP_ICONS = new Set([
    "Damage",
    "Cooldown",
    "Stamina",
    "Accuracy",
    "CritChance",
    "Block",
    "Effect",
    "Melee",
    "Ranged",
    "Magic",
    "Holy",
    "Dark",
    "Nature",
    "Fire",
    "Ice",
    "Vampiric",
    "Treasure",
    "Musical",
    "Lightning",
    "Engineer",
    "Star",
    "Star2",
    "Star3",
  ]);

  /** Icons served from repo when CDN has no webp. */
  const LOCAL_ICONS = {
    Stamina: "assets/tooltips/icons/Stamina.png",
    Block: "assets/icons/tooltip/Block.png",
    Gold: "assets/tooltips/icons/Gold.png",
  };

  const CLASS_FRAMES = new Set([
    "Adventurer",
    "Berserker",
    "Mage",
    "Ranger",
    "Reaper",
    "Pyromancer",
    "Engineer",
    "Skill",
  ]);

  /** Type tags that render as footer icons (game Util.iconTextures keys). */
  const TYPE_ICON_TAGS = new Set([
    "Melee",
    "Ranged",
    "Magic",
    "Holy",
    "Dark",
    "Nature",
    "Fire",
    "Ice",
    "Vampiric",
    "Treasure",
    "Musical",
    "Lightning",
    "Effect",
  ]);

  function assetUrl(relPath) {
    const root = document.body?.dataset?.root ?? "./";
    const prefix = root.endsWith("/") ? root : `${root}/`;
    return `${prefix}${relPath.replace(/^\//, "")}`;
  }

  function iconUrl(name) {
    const raw = String(name || "");
    const aliased = ICON_ALIAS[raw] || raw;
    if (LOCAL_TOOLTIP_ICONS.has(aliased) || aliased === "Gold") {
      if (aliased === "Gold") return assetUrl("assets/tooltips/icons/Gold.png");
      return assetUrl(`assets/tooltips/icons/${aliased}.png`);
    }
    const local = LOCAL_ICONS[aliased] || LOCAL_ICONS[raw];
    if (local) return assetUrl(local);
    return `${CDN}/icons/${aliased}.webp`;
  }

  /** Thin fade line used between property rows (game copies divider1 onto each prop). */
  function propDividerUrl(frameKey) {
    const key = String(frameKey || "Common");
    if (CLASS_FRAMES.has(key)) {
      return assetUrl(`assets/tooltips/dividers/Divider_${key}.png`);
    }
    return assetUrl(`assets/tooltips/dividers/Divider2_${key}.png`);
  }

  /** Section divider (same thin fade family as prop rows — not the dotted Divider1). */
  function dividerUrl(frameKey) {
    return propDividerUrl(frameKey);
  }

  function escapeHtml(text) {
    return String(text)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  /** Game Util.iconSizes (px height); default 28. */
  const INLINE_ICON_PX = {
    Spikes: 25,
    Vampirism: 23,
    Poison: 28,
    Regeneration: 28,
    Block: 28,
    Luck: 28,
    Blind: 25,
    Mana: 28,
    Heat: 28,
    Cold: 28,
    Empower: 28,
    Gold: 30,
    Melee: 28,
    Ranged: 28,
    Effect: 28,
    Star: 30,
    Star2: 30,
    Star3: 30,
    Lightning: 28,
    Engineer: 28,
  };

  function iconImg(name, alt = name) {
    const raw = String(name || "");
    const aliased = ICON_ALIAS[raw] || raw;
    const px = INLINE_ICON_PX[aliased] || INLINE_ICON_PX[raw] || 28;
    // Fixed box (game [img=0xN]) — avoid wide non-square sprites stretching the line
    return `<img class="bpb-tooltip__ico" alt="" width="${px}" height="${px}" src="${iconUrl(name)}" style="width:${px}px;height:${px}px" />`;
  }

  /**
   * Convert tagged effect text into HTML.
   * Supports:
   *   <IconName>  -> icon image
   *   numbers / +n / n% -> gold spans
   *   leading "Label:" on a line -> cream label color
   */
  /** Game $red[…] wraps — not icons. Also strip bad imports that became <Red>. */
  const COLOR_WRAP = new Set(["red", "green", "blue"]);

  function formatEffectText(raw) {
    if (!raw) return "";

    let text = String(raw);
    // Legacy bad convert: "$red[1 <Poison>…]" → "<Red> 1 <Poison>…"
    text = text.replace(/<Red>\s*/g, "{red}").replace(/<Green>\s*/g, "{green}").replace(/<Blue>\s*/g, "{blue}");
    // Close color wraps at sentence end / string end when opened by legacy strip
    // Prefer explicit {red}…{/red} from the descr converter.
    text = text.replace(/\{(red|green|blue)\}([\s\S]*?)(?:\{\/\1\}|(?=\n\n)|$)/gi, (_, color, inner) => {
      return `{${color.toLowerCase()}}${inner}{/${color.toLowerCase()}}`;
    });

    const colors = [];
    text = text.replace(/\{(red|green|blue)\}([\s\S]*?)\{\/\1\}/gi, (_, color, inner) => {
      const token = `%%CLR${colors.length}%%`;
      colors.push({ color: color.toLowerCase(), inner });
      return token;
    });

    // Park icons as %%ICO0%%… (unlimited). Number highlighting must skip these
    // tokens — otherwise %%ICO10%% becomes %%ICO1<span>0</span>%% and leaks.
    const icons = [];
    text = text.replace(/<([A-Za-z][A-Za-z0-9]*)>/g, (_, name) => {
      // Never treat color names as icons
      if (COLOR_WRAP.has(String(name).toLowerCase())) return "";
      const token = `%%ICO${icons.length}%%`;
      icons.push(iconImg(name));
      return token;
    });

    // Paragraph break before a new ability label after a sentence
    // (covers older DB rows that lost game \~ / $t breaks, e.g. Broom)
    text = text.replace(/\.\s+(?=[A-Z][^:\n]{0,48}:)/g, ".\n\n");

    text = escapeHtml(text);

    // Gold numbers on plain text only — leave %%ICOn%% tokens intact
    text = text.replace(/%%ICO\d+%%|(?<![A-Za-z])(\+?\d+(?:\.\d+)?%?)/g, (match, num) => {
      if (match.startsWith("%%ICO")) return match;
      return `<span class="bpb-tooltip__n">${num}</span>`;
    });

    // Color simple leading labels like "Start of battle:" / "On hit:"
    text = text
      .split(/\n/)
      .map((line) => {
        const m = line.match(/^([A-Za-z][^:<%]*:)/);
        if (!m) return line;
        return `<span class="bpb-tooltip__label">${m[1]}</span>` + line.slice(m[1].length);
      })
      .join("\n");

    // Restore icons last
    text = text.replace(/%%ICO(\d+)%%/g, (_, i) => icons[Number(i)] || "");

    // Color wraps: format inner (icons/numbers) then wrap
    text = text.replace(/%%CLR(\d+)%%/g, (_, i) => {
      const { color, inner } = colors[Number(i)];
      const formatted = formatEffectText(inner);
      return `<span class="bpb-tooltip__${color}">${formatted}</span>`;
    });

    return text.replaceAll("\n\n", "<br><br>").replaceAll("\n", "<br>");
  }

  function frameKeyForItem(item) {
    if (item.type === "Skill") return "Skill";
    if (item.rarity === "Unique") {
      const classes = classList(item).filter((c) => c && c !== "Neutral");
      if (classes.length === 1 && CLASS_FRAMES.has(classes[0])) return classes[0];
      return "Unique";
    }
    return item.rarity || "Common";
  }

  function classList(item) {
    if (Array.isArray(item.class) && item.class.length) return item.class;
    if (typeof item.class === "string" && item.class) return [item.class];
    return ["Neutral"];
  }

  function keywordsUsedInEffect(effect) {
    const text = String(effect || "");
    // Game scans Tooltip.gd keyword list in order, keeps first-seen duplicates out
    return KEYWORD_ORDER.filter((key) => {
      return text.includes(`<${key}>`) || new RegExp(`\\b${key}\\b`).test(text);
    });
  }

  /**
   * Game $t[…] / \\~ blocks → separate sections with dividers.
   * Recover missing breaks on older DB rows that lost \\n\\n.
   */
  function splitEffectBlocks(raw) {
    let text = String(raw || "").trim();
    if (!text || text === "-" || text === "–" || text === "—") return [];
    text = text.replace(/\r\n/g, "\n");
    // "…. On hit:" / "…. Start of battle:" when paragraphs were flattened
    text = text.replace(/\.\s+(?=[A-Z][^:\n]{0,48}:)/g, ".\n\n");
    // Trailing passive lines often start with "Deals "
    text = text.replace(/\.\s+(?=Deals\b)/g, ".\n\n");
    return text
      .split(/\n\n+/)
      .map((p) => p.trim())
      .filter(Boolean);
  }

  function formatKeywordLine(key) {
    const body = KEYWORDS[key];
    const icons = [];
    let text = body.replace(/<([A-Za-z][A-Za-z0-9]*)>/g, (_, name) => {
      const token = `%%ICO${icons.length}%%`;
      icons.push(iconImg(name));
      return token;
    });
    text = escapeHtml(text);
    text = text.replace(/%%ICO\d+%%|(?<![A-Za-z])(\+?\d+(?:\.\d+)?%?)/g, (match, num) => {
      if (match.startsWith("%%ICO")) return match;
      return `<span class="bpb-tooltip__n">${num}</span>`;
    });
    text = text.replace(/%%ICO(\d+)%%/g, (_, i) => icons[Number(i)] || "");
    // Keywords.csv hard line breaks (spikes_DESCR)
    text = text.replace(/\n/g, "<br>");

    return `${iconImg(key)} <span class="bpb-tooltip__kw">${escapeHtml(key)}</span>: ${text}`;
  }

  /** TYPE_*_DESCR row — gold type name like the game highlight(typeName). */
  function formatTypeDescriptionLine(item) {
    const type = String(item.type || "").trim();
    const template = TYPE_DESCRIPTIONS[type];
    if (!template) return "";
    const label = TYPE_LABELS[type] || type;
    const cd = item.cooldown ?? item.cd ?? null;
    let body = template;
    if (cd != null && cd !== "") {
      body = body.replace(/\{cd\}/g, String(fmtNum(cd)));
    } else {
      body = body.replace(/\{cd\}/g, "?");
    }
    return (
      `<span class="bpb-tooltip__kw">${escapeHtml(label)}</span>: ` +
      formatEffectText(body)
    );
  }

  function fmtNum(n) {
    if (n == null || n === "") return null;
    const num = Number(n);
    if (Number.isNaN(num)) return String(n);
    return Number.isInteger(num) ? String(num) : String(num);
  }

  /**
   * Combat property rows — mirrors ItemTooltip.gd setupProperties gates:
   * Damage (weapon+canDamage) → Stamina (weapon) → Accuracy (!=0) →
   * Cooldown (weapon+canEmpower) → Crit (canDamage && crit!=0).
   * CSV `chance` / `cooldown` on non-weapons feed $chance / $cd in effect text only.
   */
  function propRow(name, value, icon, perSecond, valueTint, psTint) {
    const tintCls = (t) =>
      t === 1 ? " bpb-tooltip__stat--up" : t === -1 ? " bpb-tooltip__stat--down" : "";
    const ps = perSecond
      ? `<span class="bpb-tooltip__prop-ps${tintCls(psTint)}">(${escapeHtml(perSecond)}/s)</span>`
      : "";
    const iconHtml = icon
      ? `<img class="bpb-tooltip__prop-icon" alt="" width="22" height="22" src="${iconUrl(icon)}" />`
      : `<span class="bpb-tooltip__prop-icon" aria-hidden="true"></span>`;
    return (
      `<div class="bpb-tooltip__prop">` +
      `<span class="bpb-tooltip__prop-name">${escapeHtml(name)}:</span>` +
      iconHtml +
      `<span class="bpb-tooltip__prop-vals">` +
      `<span class="bpb-tooltip__prop-value${tintCls(valueTint)}">${escapeHtml(value)}</span>` +
      ps +
      `</span>` +
      `</div>`
    );
  }

  /** Game isStatModified: >0 better (green), <0 worse (orange). */
  function statTint(betterDelta) {
    const n = Number(betterDelta);
    if (!Number.isFinite(n) || Math.abs(n) < 1e-4) return 0;
    return n > 0 ? 1 : -1;
  }

  function avgDam(lo, hi) {
    const a = Number(lo);
    const b = Number(hi);
    const x = Number.isFinite(a) ? a : b;
    const y = Number.isFinite(b) ? b : a;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return NaN;
    return (x + y) / 2;
  }

  /** Game ItemDescriptor.isWeapon — Type.Weapon in types. */
  function isWeaponItem(item) {
    const type = String(item.type || "");
    if (/weapon/i.test(type)) return true;
    const extras = Array.isArray(item.extraTypes)
      ? item.extraTypes
      : Array.isArray(item.extra_types)
        ? item.extra_types
        : [];
    return extras.some((t) => /^weapon$/i.test(String(t)));
  }

  /** Game Item.canDamage — base min damage > 0 or Lifesteal tag. */
  function canDamageItem(item) {
    const dMin = Number(item.damageMin ?? item.damage_min);
    const dMax = Number(item.damageMax ?? item.damage_max);
    if ((!Number.isNaN(dMin) && dMin > 0) || (!Number.isNaN(dMax) && dMax > 0)) {
      return true;
    }
    const tags = Array.isArray(item.tags) ? item.tags : [];
    return tags.some((t) => /lifesteal/i.test(String(t)));
  }

  function formatCombatStats(item, frameKey) {
    const rows = [];

    const dMin = item.damageMin ?? item.damage_min;
    const dMax = item.damageMax ?? item.damage_max;
    const cdRaw = item.cooldown;
    const cd = cdRaw != null && cdRaw !== "" ? Number(cdRaw) : null;
    const stamRaw = item.staminaCost ?? item.stamina_cost;
    const stam = stamRaw != null && stamRaw !== "" ? Number(stamRaw) : null;
    const weapon = isWeaponItem(item);
    const damages = canDamageItem(item);
    // Game: canBeEmpowered = isWeapon && canDamage
    const empowerable = weapon && damages;

    const acc = item.accuracy;
    const cat = item.catalogStats;
    const baseLo = cat ? cat.damageMin : Number(dMin);
    const baseHi = cat ? cat.damageMax : Number(dMax);
    const baseCd = cat && Number.isFinite(cat.cooldown) ? cat.cooldown : cd;
    const baseStam = cat && Number.isFinite(cat.staminaCost) ? cat.staminaCost : stam;
    const baseAcc = cat && Number.isFinite(cat.accuracy) ? cat.accuracy : Number(acc);

    if (weapon && damages && (dMin != null || dMax != null)) {
      const a = fmtNum(dMin ?? dMax);
      const b = fmtNum(dMax ?? dMin);
      const range = a === b ? a : `${a}-${b}`;
      let dps = null;
      let dpsTint = 0;
      if (cd && cd > 0) {
        const liveAvg = avgDam(dMin ?? dMax, dMax ?? dMin);
        if (!Number.isNaN(liveAvg)) {
          dps = fmtNum(Math.round((liveAvg / cd) * 10) / 10);
          if (cat && baseCd > 0) {
            const baseAvg = avgDam(baseLo, baseHi);
            if (!Number.isNaN(baseAvg)) {
              dpsTint = statTint(liveAvg / cd - baseAvg / baseCd);
            }
          }
        }
      }
      const dmgTint = cat ? statTint(avgDam(dMin, dMax) - avgDam(baseLo, baseHi)) : 0;
      rows.push(propRow("Damage", range, "Damage", dps, dmgTint, dpsTint));
    }

    if (weapon) {
      const stamVal = stam != null && !Number.isNaN(stam) ? stam : 0;
      let stamPs = null;
      let stamPsTint = 0;
      if (cd && cd > 0) {
        stamPs = fmtNum(Math.round((stamVal / cd) * 10) / 10);
        if (cat && baseCd > 0 && Number.isFinite(Number(baseStam))) {
          stamPsTint = statTint(Number(baseStam) / baseCd - stamVal / cd);
        }
      }
      const stamTint = cat && Number.isFinite(Number(baseStam))
        ? statTint(Number(baseStam) - stamVal)
        : 0;
      rows.push(propRow("Stamina cost", fmtNum(stamVal), "Stamina", stamPs, stamTint, stamPsTint));
    }

    if (weapon && acc != null && acc !== "" && Number(acc) !== 0) {
      const accTint = cat && Number.isFinite(baseAcc) ? statTint(Number(acc) - baseAcc) : 0;
      rows.push(propRow("Accuracy", `${fmtNum(acc)}%`, "Accuracy", null, accTint, 0));
    }

    // Cooldown property: weapons that can be empowered only (not Flute/accessories).
    if (empowerable && cd != null && !Number.isNaN(cd) && cd !== 0) {
      const cdTint = cat && Number.isFinite(Number(baseCd)) && Number(baseCd) > 0
        ? statTint(Number(baseCd) - cd)
        : 0;
      rows.push(propRow("Cooldown", `${fmtNum(cd)}s`, "Cooldown", null, cdTint, 0));
    }

    // Crit Chance: runtime critChancePercent only — NOT CSV `chance` ($chance in effect).
    const critRaw = item.critChance ?? item.crit_chance ?? item.critChancePercent;
    const crit = critRaw != null && critRaw !== "" ? Number(critRaw) : null;
    if (damages && crit != null && !Number.isNaN(crit) && crit !== 0) {
      const baseCrit =
        cat && Number.isFinite(Number(cat.critChance)) ? Number(cat.critChance) : 0;
      const critTint = cat ? statTint(crit - baseCrit) : 0;
      rows.push(
        propRow("Crit Chance", `${fmtNum(crit)}%`, "CritChance", null, critTint, 0),
      );
    }

    // Block is not a TooltipProperty row in-game ($block/$bl appear in effect text).

    if (!rows.length) return "";

    const div = `<img class="bpb-tooltip__divider bpb-tooltip__divider--prop" alt="" width="310" height="8" src="${propDividerUrl(frameKey)}" />`;
    // Dividers between rows only (trailing divider after the last row reads as a stray dash before cost).
    const body = rows
      .map((row, i) => (i < rows.length - 1 ? row + div : row))
      .join("");
    return `<div class="bpb-tooltip__props">${body}</div>`;
  }

  const STAT_MOD_ORDER = ["damage", "stamina", "speed", "accuracy", "chance", "block"];
  const STAT_MOD_LABEL = {
    damage: "Damage",
    stamina: "Stamina",
    speed: "Speed",
    accuracy: "Accuracy",
    chance: "Chance",
    block: "Block",
  };

  const VIA_LABEL = {
    vampirism: "Vampirism",
    spikes: "Spikes",
    empower: "Empower",
    heat: "Heat",
    cold: "Cold",
    lucky: "Luck",
    blind: "Blind",
    poison: "Poison",
    regeneration: "Regeneration",
    mana: "Mana",
    __direct__: "Bonus",
  };

  const STACK_ICON_FILE = {
    vampirism: "Vampirism.png",
    spikes: "Spikes.png",
    empower: "Empower.png",
    heat: "Heat.png",
    cold: "Cold.png",
    lucky: "Lucky.png",
    blind: "Blind.png",
    poison: "Poison.png",
    regeneration: "Regeneration.png",
    mana: "Mana.png",
  };

  function fmtModAmount(mod) {
    const n = Number(mod.amount) || 0;
    const sign = n > 0 ? "+" : "";
    if (mod.unit === "factor") {
      const pct = Math.round(n * 1000) / 10;
      const pctStr = Number.isInteger(pct) ? String(pct) : String(pct);
      return `${sign}${pctStr}%`;
    }
    if (mod.stat === "accuracy") {
      const a = Math.round(n * 10) / 10;
      return `${sign}${a}%`;
    }
    const v = Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);
    return `${sign}${v}`;
  }

  function fmtModBadge(mod) {
    const raw = fmtModAmount(mod);
    if (raw.startsWith("+")) return raw.slice(1);
    return raw;
  }

  /** Sim-only: chance roll / proc counters for debugging. */
  function formatChanceDebug(item) {
    const rolls = Number(item.chanceRolls) || 0;
    if (!(rolls > 0)) return "";
    const procs = Number(item.chanceProcs) || 0;
    return (
      `<div class="bpb-tooltip__chance-debug">` +
      `<span class="bpb-tooltip__chance-debug-label">Chance procs</span>` +
      `<span class="bpb-tooltip__chance-debug-val">${escapeHtml(String(procs))} / ${escapeHtml(String(rolls))}</span>` +
      `</div>`
    );
  }

  /** Sim-only: live combat bonuses — 2-col grid, collapsible causes, HUD source badges. */
  function formatStatMods(item, options = {}) {
    const mods = Array.isArray(item.statMods) ? item.statMods : [];
    const chanceDebug = formatChanceDebug(item);
    if (!mods.length && !chanceDebug) return "";

    const assetRoot = String(options.assetRoot || "../");
    const root = assetRoot.endsWith("/") ? assetRoot : `${assetRoot}/`;

    /** @param {string} id */
    const catalogItem = (id) => {
      if (!id || typeof options.getCatalogItem !== "function") return null;
      return options.getCatalogItem(id) || null;
    };

    /** @param {object} mod */
    const spriteForMod = (mod) => {
      if (typeof options.getSpriteUrlForId !== "function") return "";
      if (mod.source === "this item") return options.getSpriteUrlForId(item.id);
      const id = mod.sourceId || (mod.source !== "__total__" ? mod.source : "");
      if (!id) return "";
      return options.getSpriteUrlForId(id);
    };

    /** @param {object} mod */
    const labelForMod = (mod) => {
      if (mod.source === "this item") return "this item";
      const id = mod.sourceId || mod.source;
      const cat = catalogItem(id);
      if (cat?.name) return String(cat.name);
      if (mod.source && mod.source !== "__total__") return String(mod.source);
      return id ? String(id) : "combat";
    };

    /** @param {string | null | undefined} via */
    const stackIconSrc = (via) => {
      const file = via ? STACK_ICON_FILE[via] : null;
      if (!file) return "";
      return `${root}assets/icons/status/buff/${file}`;
    };

    /** @param {object[]} list */
    const causeTotal = (list) => {
      const flagged = list.find((m) => m.isCauseTotal);
      if (flagged) return Number(flagged.amount) || 0;
      return list.reduce((sum, m) => sum + (Number(m.amount) || 0), 0);
    };

    const VIA_ORDER = [
      "vampirism",
      "spikes",
      "empower",
      "heat",
      "cold",
      "lucky",
      "blind",
      "poison",
      "regeneration",
      "mana",
      "__direct__",
    ];

    const byStat = new Map();
    for (const m of mods) {
      const stat = String(m.stat || "");
      if (!stat) continue;
      const list = byStat.get(stat) || [];
      list.push(m);
      byStat.set(stat, list);
    }

    /**
     * @param {string} stat
     */
    function buildStatCell(stat) {
      const list = byStat.get(stat);
      if (!list?.length) return "";

      /** @type {Map<string, object[]>} */
      const byVia = new Map();
      for (const m of list) {
        const via = m.via ? String(m.via) : "__direct__";
        const bucket = byVia.get(via) || [];
        bucket.push(m);
        byVia.set(via, bucket);
      }

      const viaOrder = [
        ...VIA_ORDER.filter((k) => byVia.has(k)),
        ...[...byVia.keys()].filter((k) => !VIA_ORDER.includes(k)),
      ];

      const causeRows = viaOrder
        .map((via) => {
          const bucket = byVia.get(via) || [];
          if (!bucket.length) return "";
          const total = causeTotal(bucket);
          if (Math.abs(total) <= 1e-6) return "";

          const label = VIA_LABEL[via] || via;
          const iconSrc = stackIconSrc(via === "__direct__" ? null : via);
          const iconHtml = iconSrc
            ? `<img class="bpb-tooltip__mod-stack-icon" src="${escapeHtml(iconSrc)}" alt="" width="20" height="20" draggable="false" />`
            : "";

          const totalMod = { ...bucket[0], amount: total };
          const causeBody =
            `<span class="bpb-tooltip__mod-amt">${escapeHtml(fmtModAmount(totalMod))}</span>` +
            iconHtml +
            `<span class="bpb-tooltip__mod-cause-label">${escapeHtml(label)}</span>`;

          const breakdownItems = bucket.filter(
            (m) => !m.isCauseTotal && m.source !== "__total__",
          );
          const breakdown = breakdownItems
            .map((m) => {
              const srcUrl = spriteForMod(m);
              const srcLabel = labelForMod(m);
              const iconInner = srcUrl
                ? `<img src="${escapeHtml(srcUrl)}" alt="" draggable="false" decoding="async" />`
                : `<span class="bpb-tooltip__mod-chip-fallback" aria-hidden="true">•</span>`;
              return (
                `<div class="bpb-tooltip__mod-chip" title="${escapeHtml(srcLabel)}" aria-label="${escapeHtml(`${fmtModAmount(m)} ${srcLabel}`)}">` +
                `<span class="bpb-tooltip__mod-chip-stack">` +
                `<span class="bpb-tooltip__mod-chip-icon">${iconInner}</span>` +
                `<span class="bpb-tooltip__mod-chip-count">${escapeHtml(fmtModBadge(m))}</span>` +
                `</span>` +
                `</div>`
              );
            })
            .join("");

          if (breakdown) {
            return (
              `<details class="bpb-tooltip__mod-via">` +
              `<summary class="bpb-tooltip__mod-cause">` +
              `<span class="bpb-tooltip__mod-chevron" aria-hidden="true"></span>` +
              causeBody +
              `</summary>` +
              `<div class="bpb-tooltip__mod-breakdown">${breakdown}</div>` +
              `</details>`
            );
          }

          return (
            `<div class="bpb-tooltip__mod-via bpb-tooltip__mod-via--static">` +
            `<div class="bpb-tooltip__mod-cause bpb-tooltip__mod-cause--static">${causeBody}</div>` +
            `</div>`
          );
        })
        .filter(Boolean)
        .join("");

      if (!causeRows) return "";
      return (
        `<div class="bpb-tooltip__mod-cell" data-stat="${escapeHtml(stat)}">` +
        `<div class="bpb-tooltip__mod-stat">${escapeHtml(STAT_MOD_LABEL[stat] || stat)}</div>` +
        causeRows +
        `</div>`
      );
    }

    const GRID_PAIRS = [
      ["damage", "stamina"],
      ["speed", "accuracy"],
      ["chance", "block"],
    ];

    const gridRows = GRID_PAIRS.map(([left, right]) => {
      const l = buildStatCell(left);
      const r = buildStatCell(right);
      if (!l && !r) return "";
      return `<div class="bpb-tooltip__mods-row">${l}${r}</div>`;
    }).filter(Boolean);

    const extraStats = [...byStat.keys()].filter(
      (k) => !STAT_MOD_ORDER.includes(k),
    );
    const extraCells = extraStats
      .map((stat) => {
        const cell = buildStatCell(stat);
        return cell ? `<div class="bpb-tooltip__mods-row">${cell}</div>` : "";
      })
      .filter(Boolean);

    if (!gridRows.length && !extraCells.length && !chanceDebug) return "";

    const title = mods.length ? "Changed by" : "Combat";
    return (
      `<div class="bpb-tooltip__mods">` +
      `<div class="bpb-tooltip__mods-title">${escapeHtml(title)}</div>` +
      `<div class="bpb-tooltip__mods-scroll">` +
      `<div class="bpb-tooltip__mods-grid">${gridRows.join("")}${extraCells.join("")}</div>` +
      chanceDebug +
      `</div>` +
      `</div>`
    );
  }

  /**
   * Footer type: "Melee Weapon" → Melee icon + "Weapon" label (game behavior).
   * Extra types without icons (Pet, …) become textExtras like game extraTypesLabel.
   * @returns {{ icons: string[], label: string, textExtras: string[] }}
   */
  function resolveTypeDisplay(item) {
    const type = String(item.type || "").trim();
    const extras = Array.isArray(item.extraTypes)
      ? item.extraTypes.map(String)
      : Array.isArray(item.extra_types)
        ? item.extra_types.map(String)
        : [];
    const icons = [];
    /** @type {string[]} */
    const textExtras = [];

    const titleCase = (tag) =>
      String(tag).trim().replace(/^\w/, (c) => c.toUpperCase());

    const pushExtra = (tag) => {
      const titled = titleCase(tag);
      if (!titled || titled === "Treasure" || titled === "Weapon") return;
      if (TYPE_ICON_TAGS.has(titled)) icons.push(titled);
      else if (!textExtras.includes(titled)) {
        // Game: types missing from Util.iconTextures → ExtraTypes text (Pet, …)
        textExtras.push(titled);
      }
    };

    const compound = type.match(/^(Melee|Ranged)\s+Weapon$/i);
    if (compound) {
      const kind = /^ranged$/i.test(compound[1]) ? "Ranged" : "Melee";
      // Game footer: extra type icons (Fire, Effect, …) then Melee/Ranged + "Weapon"
      for (const tag of extras) pushExtra(tag);
      icons.push(kind);
      return { icons, label: "Weapon", textExtras };
    }

    for (const tag of extras) pushExtra(tag);

    if (!icons.length && TYPE_ICON_TAGS.has(type)) {
      icons.push(type);
    }

    return {
      icons,
      label: TYPE_LABELS[type] || type,
      textExtras,
    };
  }

  /**
   * Older imports swapped $bl (icon) and $block (number), e.g.
   * "45 30 reached: … to <Block> 30" → "45 <Block> reached: … to 30 <Block>"
   */
  function repairSwappedBlockTokens(effect, item) {
    let text = String(effect || "");
    const block = item.block ?? item.block_value;
    if (block == null || block === "") return text;
    const b = String(block);
    const reReached = new RegExp(`\\b(\\d+)\\s+${b.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s+reached:`, "g");
    text = text.replace(reReached, "$1 <Block> reached:");
    const reTail = new RegExp(`to\\s+<Block>\\s+${b.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([.\\s]|$)`, "g");
    text = text.replace(reTail, `to ${b} <Block>$1`);
    return text;
  }

  /**
   * Failed descr convert left `$p2s` as `<P2s>` (fake icon). Resolve from item.params.
   * Game: $p2s = indexed param 2 + "s" (seconds), same family as $cds.
   * Also repair stale imports that wrote the wrong number for named cd/stamina.
   */
  function expandUnresolvedParamTags(effect, item) {
    let text = String(effect || "");
    const params =
      item.params && typeof item.params === "object" ? item.params : {};
    const indexed = [];
    let hasIndexed = false;
    for (let i = 1; i <= 10; i++) {
      if (params[`p${i}`] != null && params[`p${i}`] !== "") {
        indexed[i - 1] = params[`p${i}`];
        hasIndexed = true;
      }
    }
    if (!hasIndexed) {
      for (const [k, v] of Object.entries(params)) {
        if (/^p\d+$/i.test(k)) continue;
        indexed.push(v);
      }
    }
    text = text.replace(/<P(\d+)(s?)>/gi, (full, n, sfx) => {
      const v = indexed[Number(n) - 1];
      if (v == null || v === "") return full;
      return sfx ? `${v}s` : String(v);
    });
    // Big Bloodthorne etc.: template `$p3s` ≡ named `cd` — fix wrong baked numbers
    if (params.cd != null && params.cd !== "") {
      text = text.replace(
        /(cooldown to )\d+(?:\.\d+)?s\b/gi,
        `$1${params.cd}s`,
      );
    }
    if (params.stamina != null && params.stamina !== "") {
      text = text.replace(
        /(stamina usage to )\d+(?:\.\d+)?\b/gi,
        `$1${params.stamina}`,
      );
    }
    return text;
  }

  function render(item, options = {}) {
    if (!item || !item.name) {
      throw new Error("ItemTooltip.render(item) requires at least item.name");
    }

    const rarity = item.rarity || "Common";
    const frameKey = frameKeyForItem(item);
    const classes = classList(item);
    const typeDisplay = resolveTypeDisplay(item);
    const showCost = item.cost != null && item.cost !== "";
    // Skip empty / placeholder effects (DB sometimes stores "-" for no description)
    let rawEffect = expandUnresolvedParamTags(
      repairSwappedBlockTokens(String(item.effect || "").trim(), item),
      item,
    );
    const extras = catalogExtraLines(item);
    if (extras.prepend.length) {
      rawEffect = extras.prepend.join("\n\n") + (rawEffect ? `\n\n${rawEffect}` : "");
    }
    if (extras.append.length) {
      rawEffect = (rawEffect ? `${rawEffect}\n\n` : "") + extras.append.join("\n\n");
    }
    const keywords = keywordsUsedInEffect(rawEffect);
    // Game: $t / \\n\\n ability lines share ONE description panel (paragraph gaps only).
    // Dividers sit around that panel and between keyword glossary rows — not between
    // "While…" / "On hit…" / "Deals…".
    const effectParts = splitEffectBlocks(rawEffect);
    const effectHtml = effectParts.length
      ? formatEffectText(effectParts.join("\n\n"))
      : "";
    const sectionDiv = `<img class="bpb-tooltip__divider" alt="" width="310" height="10" src="${dividerUrl(frameKey)}" />`;

    const root = document.createElement("aside");
    root.className = "bpb-tooltip";
    root.dataset.rarity = rarity;
    root.dataset.frame = frameKey;
    root.setAttribute("role", "tooltip");
    if (options.className) root.classList.add(options.className);

    // Game order: stats → one effect block → keyword glossary (dividers) → cost → footer
    const sections = [];

    const statsHtml = formatCombatStats(item, frameKey);
    const modsHtml =
      options.showChangedBy === false ? '' : formatStatMods(item, options);
    const useSidecar = options.statModsSidecar === true && Boolean(modsHtml);

    if (statsHtml) sections.push(statsHtml);
    if (modsHtml && !useSidecar) {
      if (statsHtml) sections.push(sectionDiv);
      sections.push(modsHtml);
    }

    if (effectHtml) {
      if (statsHtml || (modsHtml && !useSidecar)) sections.push(sectionDiv);
      sections.push(
        `<div class="bpb-tooltip__block"><div class="bpb-tooltip__effect">${effectHtml}</div></div>`,
      );
    }

    // Type glossary (Playing Card / Gem) — game addReferenceExplanations before keywords
    const typeDescrHtml = formatTypeDescriptionLine(item);
    if (typeDescrHtml) {
      sections.push(sectionDiv);
      sections.push(
        `<div class="bpb-tooltip__block bpb-tooltip__block--small"><div class="bpb-tooltip__effect">${typeDescrHtml}</div></div>`,
      );
    }

    // Keyword glossary — each entry gets its own divider (game addSubDescription)
    for (const key of keywords) {
      sections.push(sectionDiv);
      sections.push(
        `<div class="bpb-tooltip__block bpb-tooltip__block--small"><div class="bpb-tooltip__effect">${formatKeywordLine(key)}</div></div>`,
      );
    }

    // Cost after glossary (keeps ability text contiguous like the game)
    if (showCost) {
      sections.push(sectionDiv);
      sections.push(
        `<div class="bpb-tooltip__cost">` +
          `<span class="bpb-tooltip__label">Item cost</span>: ` +
          `<span class="bpb-tooltip__cost-value"><span class="bpb-tooltip__n">${escapeHtml(item.cost)}</span>` +
          `<img class="bpb-tooltip__gold" alt="" width="22" height="22" src="${iconUrl("Gold")}" /></span>` +
          `</div>`
      );
    }

    // Thin fade into footer (Divider2 family — never the dotted Divider1)
    sections.push(sectionDiv);

    const rarityIcons = classes
      .map((c) => `<img alt="${escapeHtml(c)}" src="${iconUrl(c)}" />`)
      .join("");

    const typeIcons = typeDisplay.icons
      .map((t) => `<img alt="${escapeHtml(t)}" src="${iconUrl(t)}" />`)
      .join("");

    sections.push(
      `<div class="bpb-tooltip__footer"><div class="bpb-tooltip__rarity">${rarityIcons}<span>${escapeHtml(rarity)}</span></div><div class="bpb-tooltip__type">${typeIcons}<span>${escapeHtml(typeDisplay.label)}</span></div></div>`,
    );

    // Game ExtraTypes label — own VBox row under the rarity/type footer
    const textExtras = typeDisplay.textExtras || [];
    if (textExtras.length) {
      sections.push(
        `<div class="bpb-tooltip__extra-types">${textExtras
          .map((t) => escapeHtml(t))
          .join("  ")}</div>`,
      );
    }

    root.innerHTML =
      `<div class="bpb-tooltip__inner"><div class="bpb-tooltip__stack">` +
      `<h1 class="bpb-tooltip__title">${escapeHtml(item.name)}</h1>` +
      `<div class="bpb-tooltip__sections">${sections.join("")}</div>` +
      `</div></div>`;

    if (!useSidecar) return root;

    /** Nine-patch overlap (px) — sidecar overlaps main frame so panels touch. */
    const PATCH_R_BY_FRAME = {
      Common: 40,
      Rare: 49,
      Epic: 41,
      Legendary: 48,
      Godly: 52,
      Unique: 39,
    };
    const PATCH_L_BY_FRAME = {
      Common: 27,
      Rare: 32,
      Epic: 32,
      Legendary: 29,
      Godly: 52,
      Unique: 22,
    };

    const sidecarLeft = options.sidecarLeft === true;
    const patchOverlap = sidecarLeft
      ? PATCH_L_BY_FRAME[frameKey] ?? 29
      : PATCH_R_BY_FRAME[frameKey] ?? 48;

    const cluster = document.createElement('div');
    cluster.className = 'bpb-tooltip-cluster';
    if (sidecarLeft) {
      cluster.classList.add('bpb-tooltip-cluster--flip');
      cluster.dataset.sidecarLeft = '1';
    }
    cluster.style.setProperty('--bpb-sidecar-overlap', `${patchOverlap}px`);
    cluster.appendChild(root);

    const sidecar = document.createElement('aside');
    sidecar.className = 'bpb-tooltip-sidecar';
    sidecar.setAttribute('role', 'complementary');
    sidecar.setAttribute('aria-label', 'Changed by');
    sidecar.innerHTML = modsHtml;
    cluster.appendChild(sidecar);

    return cluster;
  }

  /** Replace container contents with a rendered tooltip. */
  function mount(container, item, options) {
    const el = typeof container === "string" ? document.querySelector(container) : container;
    if (!el) throw new Error("ItemTooltip.mount: container not found");
    el.replaceChildren(render(item, options));
    return el.firstElementChild;
  }

  window.ItemTooltip = { render, mount, KEYWORDS, CDN };
})();
