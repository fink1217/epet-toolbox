// 吉祥物「小黃」：一隻戴護目鏡的小雞，在步驟裡出來提醒。
// mascot({ mood }) 回傳 SVG 字串。mood：happy | think | warn | cheer | sleep

const EYES = {
  happy: '<path d="M38 50 q5 -6 10 0 M62 50 q5 -6 10 0" stroke="#1E1F22" stroke-width="3.2" fill="none" stroke-linecap="round"/>',
  cheer: '<path d="M38 50 q5 -7 10 0 M62 50 q5 -7 10 0" stroke="#1E1F22" stroke-width="3.2" fill="none" stroke-linecap="round"/>',
  think: '<circle cx="44" cy="49" r="4" fill="#1E1F22"/><circle cx="67" cy="47" r="4" fill="#1E1F22"/><circle cx="45.5" cy="47.5" r="1.3" fill="#fff"/><circle cx="68.5" cy="45.5" r="1.3" fill="#fff"/>',
  warn: '<circle cx="43" cy="49" r="5" fill="#fff" stroke="#1E1F22" stroke-width="2.4"/><circle cx="67" cy="49" r="5" fill="#fff" stroke="#1E1F22" stroke-width="2.4"/><circle cx="43" cy="49" r="2" fill="#1E1F22"/><circle cx="67" cy="49" r="2" fill="#1E1F22"/>',
  sleep: '<path d="M38 51 q5 4 10 0 M62 51 q5 4 10 0" stroke="#1E1F22" stroke-width="3" fill="none" stroke-linecap="round"/>',
};

const EXTRA = {
  happy: '',
  cheer: '<path d="M14 40 l-8 -8 M12 52 l-10 0 M96 40 l8 -8 M98 52 l10 0" stroke="#FFB020" stroke-width="3" stroke-linecap="round"/>',
  think: '<circle cx="98" cy="20" r="3" fill="#DDD3C2"/><circle cx="104" cy="10" r="4.5" fill="#DDD3C2"/>',
  warn: '<path d="M96 14 v14" stroke="#D93F3F" stroke-width="5" stroke-linecap="round"/><circle cx="96" cy="36" r="3" fill="#D93F3F"/>',
  sleep: '<text x="88" y="24" font-family="Huninn, sans-serif" font-size="16" fill="#8A8F98">z</text><text x="98" y="14" font-family="Huninn, sans-serif" font-size="12" fill="#8A8F98">z</text>',
};

export function mascot({ mood = 'happy', goggles = true } = {}) {
  const eyes = EYES[mood] || EYES.happy;
  const gog = goggles
    ? '<path d="M24 30 q31 -14 62 0" stroke="#4A4D55" stroke-width="4" fill="none" stroke-linecap="round"/>' +
      '<rect x="34" y="20" width="18" height="12" rx="6" fill="#9FE3DE" stroke="#4A4D55" stroke-width="3"/>' +
      '<rect x="58" y="20" width="18" height="12" rx="6" fill="#9FE3DE" stroke="#4A4D55" stroke-width="3"/>'
    : '';
  return `<svg class="mascot" viewBox="0 0 110 110" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <ellipse cx="55" cy="102" rx="30" ry="5" fill="#1E1F22" opacity=".08"/>
  <path d="M55 8 q-6 -6 -2 -8 q2 4 6 1 q-1 5 -4 7z" fill="#FF9F0A"/>
  <ellipse cx="55" cy="58" rx="38" ry="40" fill="#FFC93C"/>
  <ellipse cx="55" cy="66" rx="26" ry="26" fill="#FFE08A"/>
  <path d="M18 66 q-10 6 -4 16 q8 -2 10 -10z" fill="#FFB020"/>
  <path d="M92 66 q10 6 4 16 q-8 -2 -10 -10z" fill="#FFB020"/>
  ${gog}
  ${eyes}
  <path d="M50 58 l5 7 l5 -7z" fill="#FF8A00"/>
  <circle cx="34" cy="62" r="5" fill="#FF8A8A" opacity=".45"/>
  <circle cx="76" cy="62" r="5" fill="#FF8A8A" opacity=".45"/>
  <path d="M44 97 v5 M40 102 h8 M66 97 v5 M62 102 h8" stroke="#FF8A00" stroke-width="3" stroke-linecap="round"/>
  ${EXTRA[mood] || ''}
</svg>`;
}
