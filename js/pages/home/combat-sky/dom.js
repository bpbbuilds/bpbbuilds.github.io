/**
 * Combat-sky DOM — layer order matches Core/Main.tscn Background.
 */

function texUrl(root, name) {
  // Single quotes — safe inside style="...". Applied inline so urls resolve
  // against the document, not combat-sky.css.
  return `url('${root}assets/theme/backgrounds/combat/${name}')`;
}

function maskInline(root, name) {
  const u = texUrl(root, name);
  return `-webkit-mask-image:${u};mask-image:${u}`;
}

function rootPrefix() {
  const raw = document.body?.dataset?.root ?? './';
  return raw.endsWith('/') ? raw : `${raw}/`;
}

export function combatSkyRoot() {
  return rootPrefix();
}

export function buildSkyDom(root) {
  const host = document.createElement('div');
  host.className = 'combat-sky';
  host.setAttribute('aria-hidden', 'true');

  const img = (file) => `${root}assets/theme/backgrounds/combat/${file}`;

  host.innerHTML = `
    <div class="combat-sky__stage">
      <div class="combat-sky__sky"></div>
      <div class="combat-sky__celestial" data-layer="sun" style="--w:282px;--h:282px;--sx:1.4;--sy:1.4">
        <img src="${img('Sun.png')}" alt="" width="282" height="282" decoding="async" />
      </div>
      <div class="combat-sky__celestial combat-sky__star" data-layer="star1" style="--w:106px;--h:125px;--sx:0.91;--sy:0.91">
        <img src="${img('Star.png')}" alt="" width="106" height="125" decoding="async" />
      </div>
      <div class="combat-sky__celestial combat-sky__star" data-layer="star2" style="--w:106px;--h:125px;--sx:1.11;--sy:1.11">
        <img src="${img('Star.png')}" alt="" width="106" height="125" decoding="async" />
      </div>
      <div class="combat-sky__celestial combat-sky__star" data-layer="star3" style="--w:106px;--h:125px;--sx:0.69;--sy:0.69">
        <img src="${img('Star.png')}" alt="" width="106" height="125" decoding="async" />
      </div>
      <div class="combat-sky__celestial" data-layer="moon" style="--w:270px;--h:294px">
        <img src="${img('Moon.png')}" alt="" width="270" height="294" decoding="async" />
      </div>
      <div class="combat-sky__spr" data-layer="shrubbery"
        style="--x:1179px;--y:350px;--w:601px;--h:147px;--rot:-14.8deg;${maskInline(root, 'Shrubbery.png')}"></div>
      <div class="combat-sky__windmill" data-layer="windmill"
        style="--x:1062px;--y:371px;--w:82px;--h:162px;--sy:1.012">
        <div class="combat-sky__windmill-tower" style="${maskInline(root, 'Windmill.png')}"></div>
        <div class="combat-sky__blade-pivot">
          <div class="combat-sky__blades" style="${maskInline(root, 'WindmillBlades.png')}"></div>
        </div>
      </div>
      <div class="combat-sky__spr" data-layer="mountains"
        style="--x:399px;--y:367px;--w:765px;--h:242px;${maskInline(root, 'Mountains.png')}"></div>
      <div class="combat-sky__spr" data-layer="hill3"
        style="--x:967.5px;--y:458px;--w:1920px;--h:511px;--sx:0.983;${maskInline(root, 'Hill3.png')}"></div>
      <div class="combat-sky__spr" data-layer="house"
        style="--x:853.8px;--y:415.5px;--w:125px;--h:82px;--sx:1.232;--sy:1.232;${maskInline(root, 'House.png')}"></div>
      <div class="combat-sky__spr" data-layer="windows"
        style="--x:858.5px;--y:416.25px;--w:104px;--h:41px;--sx:1.221;--sy:1.159;${maskInline(root, 'Windows.png')}"></div>
      <div class="combat-sky__spr" data-layer="roof"
        style="--x:853.5px;--y:383px;--w:151px;--h:55px;--sx:1.238;--sy:1.241;${maskInline(root, 'Roof.png')}"></div>
      <div class="combat-sky__spr" data-layer="hill2"
        style="--x:955px;--y:675px;--w:1920px;--h:595px;--sx:0.991;${maskInline(root, 'Hill2.png')}"></div>
      <div class="combat-sky__ground"></div>
      <div class="combat-sky__spr" data-layer="hill1"
        style="--x:959.5px;--y:754px;--w:1920px;--h:633px;--sx:0.998;${maskInline(root, 'Hill1.png')}"></div>
      <div class="combat-sky__spr" data-layer="path"
        style="--x:1439px;--y:828px;--w:968px;--h:499px;${maskInline(root, 'Path.png')}"></div>
      <div class="combat-sky__speckles" style="background-image:${texUrl(root, 'Speckles.jpg')}"></div>
    </div>
  `;
  return host;
}
