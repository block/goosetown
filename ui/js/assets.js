import { svg } from 'https://cdn.jsdelivr.net/npm/lit-html@3.3.2/+esm';

export const SvgDefs = svg`
<defs>
  <pattern id="grass-pat" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
    <rect width="40" height="40" fill="#7CB342"/>
    <circle cx="10" cy="10" r="2" fill="#689F38"/>
    <circle cx="30" cy="25" r="1.5" fill="#689F38"/>
  </pattern>
  
  <g id="tile-water">
    <rect width="42" height="42" x="-1" y="-1" fill="#2980B9" rx="8"/>
    <path d="M 5 20 Q 15 10 25 20 T 40 20" fill="none" stroke="#4FC3F7" stroke-width="2" stroke-linecap="round" opacity="0.6"/>
  </g>

  <g id="tile-pond">
    <rect width="44" height="44" x="-2" y="-2" fill="#1565C0" rx="14"/>
    <ellipse cx="20" cy="20" rx="12" ry="6" fill="none" stroke="#64B5F6" stroke-width="1.5" opacity="0.5"/>
    <circle cx="8" cy="8" r="4" fill="#4CAF50"/>
    <path d="M 8 8 L 12 8" stroke="#1565C0" stroke-width="1.5"/>
  </g>

  <g id="tile-path">
    <!-- Base grass to let worn dirt edges feel organic -->
    <rect width="44" height="44" x="-2" y="-2" fill="#7CB342" rx="8"/>
    <circle cx="8" cy="10" r="1.6" fill="#689F38" opacity="0.8"/>
    <circle cx="32" cy="8" r="1.2" fill="#689F38" opacity="0.7"/>
    <circle cx="34" cy="30" r="1.5" fill="#689F38" opacity="0.75"/>

    <!-- Irregular dirt patch (worn into the grass) -->
    <path d="M 4 6 Q 14 0 22 4 Q 30 8 36 6 Q 42 6 44 14 Q 40 22 42 28 Q 44 36 36 38 Q 28 40 22 38 Q 14 36 6 40 Q 0 42 -2 34 Q 2 26 2 22 Q 2 14 4 6 Z" fill="#9A7B54"/>
    <path d="M 6 8 Q 15 3 22 6 Q 30 10 35 9 Q 40 9 42 15 Q 38 22 40 28 Q 42 34 35 35 Q 28 36 22 35 Q 14 33 7 36 Q 2 38 0 32 Q 3 25 3 22 Q 3 14 6 8 Z" fill="#8D6E63" opacity="0.55"/>

    <!-- Subtle footprints -->
    <ellipse cx="16" cy="18" rx="2.6" ry="4" fill="#6D4C41" opacity="0.25" transform="rotate(-18 16 18)"/>
    <ellipse cx="24" cy="26" rx="2.4" ry="3.8" fill="#6D4C41" opacity="0.22" transform="rotate(12 24 26)"/>
    <ellipse cx="30" cy="20" rx="2.2" ry="3.4" fill="#6D4C41" opacity="0.20" transform="rotate(28 30 20)"/>

    <!-- Grass tufts peeking through -->
    <path d="M 6 6 Q 7 3 8 6 M 8 6 Q 9 4 10 6" stroke="#2E7D32" stroke-width="2" fill="none" stroke-linecap="round" opacity="0.9"/>
    <path d="M 36 36 Q 37 33 38 36 M 38 36 Q 39 34 40 36" stroke="#33691E" stroke-width="2" fill="none" stroke-linecap="round" opacity="0.9"/>
  </g>

  <g id="tile-cobble">
    <!-- Warm tan/brown cobbles with darker mortar showing through as base -->
    <rect width="44" height="44" x="-2" y="-2" fill="#8D7B6B" rx="4"/>
    <rect width="18" height="18" x="2" y="2" fill="#A89279" rx="4"/>
    <rect width="18" height="18" x="20" y="2" fill="#C4AD8F" rx="4"/>
    <rect width="18" height="18" x="2" y="20" fill="#C4AD8F" rx="4"/>
    <rect width="18" height="18" x="20" y="20" fill="#A89279" rx="4"/>
  </g>

  <g id="tile-plaza">
    <rect width="44" height="44" x="-2" y="-2" fill="#616161"/>
    <polygon points="20,0 40,20 20,40 0,20" fill="#9E9E9E"/>
    <circle cx="20" cy="20" r="8" fill="#BDBDBD" stroke="#424242" stroke-width="2"/>
  </g>

  <g id="tile-stone-wall">
    <rect width="42" height="42" x="-1" y="-1" fill="#6D5C4F"/>

    <!-- Top edge highlight so it reads as a low wall -->
    <path d="M -1 1 H 41" stroke="#BFAF9F" stroke-width="2" opacity="0.65"/>
    <path d="M -1 4 H 41" stroke="#5B4B41" stroke-width="2" opacity="0.25"/>

    <rect width="18" height="12" x="0" y="0" fill="#8A7A6C" stroke="#4E4037" stroke-width="1"/>
    <rect width="22" height="12" x="18" y="0" fill="#9B8A7A" stroke="#4E4037" stroke-width="1"/>
    <rect width="24" height="12" x="-4" y="12" fill="#9B8A7A" stroke="#4E4037" stroke-width="1"/>
    <rect width="20" height="12" x="20" y="12" fill="#8A7A6C" stroke="#4E4037" stroke-width="1"/>
    <rect width="18" height="12" x="0" y="24" fill="#8A7A6C" stroke="#4E4037" stroke-width="1"/>
    <rect width="22" height="12" x="18" y="24" fill="#9B8A7A" stroke="#4E4037" stroke-width="1"/>
  </g>

  <g id="tile-bridge">
    <rect width="44" height="44" x="-2" y="-2" fill="#5D4037" rx="4"/>
    <rect width="44" height="6" x="-2" y="5" fill="#3E2723"/>
    <rect width="44" height="6" x="-2" y="29" fill="#3E2723"/>
  </g>

  <g id="tile-farm">
    <rect width="42" height="42" x="-1" y="-1" fill="#795548" rx="4"/>
    <line x1="0" y1="10" x2="40" y2="10" stroke="#5D4037" stroke-width="2"/>
    <line x1="0" y1="20" x2="40" y2="20" stroke="#5D4037" stroke-width="2"/>
    <line x1="0" y1="30" x2="40" y2="30" stroke="#5D4037" stroke-width="2"/>
    <path d="M 5 5 Q 10 0 15 5 M 10 5 L 10 10" stroke="#4CAF50" stroke-width="2" fill="none" stroke-linecap="round"/>
    <path d="M 25 5 Q 30 0 35 5 M 30 5 L 30 10" stroke="#4CAF50" stroke-width="2" fill="none" stroke-linecap="round"/>
    <path d="M 15 15 Q 20 10 25 15 M 20 15 L 20 20" stroke="#8BC34A" stroke-width="2" fill="none" stroke-linecap="round"/>
    <path d="M 5 25 Q 10 20 15 25 M 10 25 L 10 30" stroke="#4CAF50" stroke-width="2" fill="none" stroke-linecap="round"/>
    <path d="M 25 25 Q 30 20 35 25 M 30 25 L 30 30" stroke="#8BC34A" stroke-width="2" fill="none" stroke-linecap="round"/>
  </g>

  <g id="tile-fountain-grand">
    <rect width="88" height="88" x="-4" y="-4" fill="#E0E0E0" rx="8"/>
    <circle cx="40" cy="40" r="36" fill="#BDBDBD" stroke="#757575" stroke-width="3"/>
    <circle cx="40" cy="40" r="30" fill="#2980B9"/>
    <circle cx="40" cy="40" r="16" fill="#9E9E9E" stroke="#616161" stroke-width="2"/>
    <circle cx="40" cy="40" r="12" fill="#3498DB"/>
    <circle cx="40" cy="40" r="6" fill="#757575"/>
    <path d="M 40 40 Q 30 10 15 35 M 40 40 Q 50 10 65 35 M 40 40 L 40 5" stroke="#81D4FA" stroke-width="2" fill="none" class="anim-fountain" stroke-linecap="round"/>
    <path d="M 20 40 Q 25 30 30 40 M 60 40 Q 55 30 50 40 M 40 20 Q 30 25 40 30 M 40 60 Q 50 55 40 50" stroke="#B3E5FC" stroke-width="1.5" fill="none" class="anim-fountain" style="animation-delay: 0.5s"/>
    <circle cx="40" cy="40" r="22" fill="none" stroke="#64B5F6" stroke-width="1.5" opacity="0.5" class="anim-ripple"/>
    <circle cx="40" cy="40" r="28" fill="none" stroke="#64B5F6" stroke-width="1" opacity="0.3" class="anim-ripple-delay"/>
  </g>

  <g id="tree-pine">
    <polygon points="20,0 40,30 30,30 45,55 5,55 20,30 10,30" fill="#2E7D32"/>
    <polygon points="20,0 40,30 30,30 45,55 20,55" fill="#1B5E20" opacity="0.3"/>
    <rect x="16" y="55" width="8" height="15" fill="#4E342E"/>
  </g>

  <g id="tree-oak">
    <circle cx="20" cy="20" r="22" fill="#558B2F"/>
    <circle cx="10" cy="15" r="14" fill="#689F38"/>
    <circle cx="30" cy="25" r="12" fill="#33691E"/>
    <rect x="16" y="38" width="8" height="20" fill="#5D4037"/>
  </g>

  <g id="bush">
    <circle cx="20" cy="25" r="12" fill="#43A047"/>
    <circle cx="12" cy="30" r="8" fill="#2E7D32"/>
    <circle cx="28" cy="30" r="8" fill="#2E7D32"/>
    <circle cx="15" cy="20" r="3" fill="#F48FB1"/>
    <circle cx="25" cy="18" r="3" fill="#CE93D8"/>
  </g>

  <g id="rock">
    <path d="M 10 35 Q 15 20 25 20 T 35 35 Z" fill="#9E9E9E"/>
    <path d="M 15 35 Q 20 25 25 25 T 30 35 Z" fill="#BDBDBD"/>
  </g>
  
  <g id="deco-lamp">
    <rect x="18" y="10" width="4" height="30" fill="#212121"/>
    <polygon points="15,40 25,40 22,10 18,10" fill="#424242"/>
    <rect x="15" y="-5" width="10" height="15" fill="none" stroke="#212121" stroke-width="2"/>
    <circle cx="20" cy="2" r="5" fill="#FFCA28" stroke="#FFF59D" stroke-width="2" class="anim-flicker"/>
    <polygon points="12,-5 28,-5 20,-15" fill="#212121"/>
  </g>

  <g id="deco-pipes">
    <!-- Brick smokestack/chimney (factory vibe) + animated smoke -->
    <!-- Smoke puffs (staggered delays) -->
    <circle cx="22" cy="-6" r="6" fill="#BDBDBD" opacity="0.85" class="anim-smoke" style="animation-delay: -0.2s"/>
    <circle cx="14" cy="-10" r="4.5" fill="#E0E0E0" opacity="0.75" class="anim-smoke" style="animation-delay: -0.9s"/>
    <circle cx="26" cy="-13" r="3.5" fill="#EEEEEE" opacity="0.65" class="anim-smoke" style="animation-delay: -1.5s"/>

    <!-- Ground shadow/anchor -->
    <ellipse cx="20" cy="38" rx="14" ry="4" fill="#33691E" opacity="0.18"/>

    <!-- Brick base -->
    <rect x="8" y="22" width="24" height="18" rx="2" fill="#A24A3A" stroke="#5D2B22" stroke-width="2"/>
    <!-- brick rows -->
    <path d="M 10 28 H 30 M 10 34 H 30" stroke="#7A3328" stroke-width="2" opacity="0.8"/>
    <!-- mortar hints -->
    <path d="M 14 22 V 40 M 22 22 V 40 M 30 22 V 40" stroke="#D7CCC8" stroke-width="1" opacity="0.35"/>

    <!-- Narrow chimney stack (slightly tapered) -->
    <path d="M 14 24 L 26 24 L 24 4 L 16 4 Z" fill="#7D3A2C" stroke="#3E2723" stroke-width="2"/>
    <!-- top lip -->
    <path d="M 15 6 L 25 6" stroke="#B87333" stroke-width="2" stroke-linecap="round" opacity="0.75"/>
    <!-- stack highlight -->
    <path d="M 18 6 L 19 23" stroke="#BCAAA4" stroke-width="2" stroke-linecap="round" opacity="0.35"/>
  </g>

  <g id="deco-gear">
    <!-- Barrel / crate cluster (working waterfront cargo) -->
    <!-- Ground shadow -->
    <ellipse cx="20" cy="38" rx="16" ry="4.5" fill="#33691E" opacity="0.16"/>

    <!-- Crate (slightly skewed) -->
    <g transform="translate(2,16) skewX(-8)">
      <rect x="0" y="6" width="18" height="16" rx="2" fill="#8D6E63" stroke="#3E2723" stroke-width="2"/>
      <path d="M 2 10 H 16 M 2 14 H 16 M 2 18 H 16" stroke="#5D4037" stroke-width="1.5" opacity="0.55"/>
      <path d="M 2 6 L 16 22 M 16 6 L 2 22" stroke="#3E2723" stroke-width="2" opacity="0.65"/>
    </g>

    <!-- Barrel 1 -->
    <g transform="translate(18,10)">
      <ellipse cx="10" cy="10" rx="8" ry="4" fill="#A67C52" stroke="#3E2723" stroke-width="2"/>
      <rect x="2" y="10" width="16" height="20" rx="7" fill="#9C6B3C" stroke="#3E2723" stroke-width="2"/>
      <ellipse cx="10" cy="30" rx="8" ry="4" fill="#8D5E34" stroke="#3E2723" stroke-width="2"/>
      <!-- staves -->
      <path d="M 6 12 V 28 M 10 12 V 28 M 14 12 V 28" stroke="#6D4C41" stroke-width="2" opacity="0.55" stroke-linecap="round"/>
      <!-- brass/copper bands -->
      <path d="M 3 17 H 17" stroke="#B87333" stroke-width="2.5" opacity="0.95" stroke-linecap="round"/>
      <path d="M 3 24 H 17" stroke="#DAA520" stroke-width="2.5" opacity="0.95" stroke-linecap="round"/>
    </g>

    <!-- Barrel 2 (smaller, behind) -->
    <g transform="translate(10,14) scale(0.85)">
      <ellipse cx="10" cy="10" rx="8" ry="4" fill="#B07D4A" stroke="#3E2723" stroke-width="2"/>
      <rect x="2" y="10" width="16" height="20" rx="7" fill="#A06B3B" stroke="#3E2723" stroke-width="2"/>
      <ellipse cx="10" cy="30" rx="8" ry="4" fill="#8D5E34" stroke="#3E2723" stroke-width="2"/>
      <path d="M 4 20 H 16" stroke="#B87333" stroke-width="2.5" opacity="0.9" stroke-linecap="round"/>
    </g>

    <!-- Rope detail -->
    <path d="M 10 30 C 13 26 18 26 21 30" fill="none" stroke="#BCAAA4" stroke-width="2" stroke-linecap="round" opacity="0.9"/>
    <circle cx="21" cy="30" r="2" fill="#BCAAA4" opacity="0.9"/>
  </g>

  <g id="goose">
    <polygon points="16,40 4,32 8,46" fill="#FAFAFA" stroke="#B0BEC5" stroke-width="2" stroke-linejoin="round"/>
    <path d="M 38,36 Q 42,24 38,14 L 28,16 Q 32,26 30,36 Z" fill="#FAFAFA"/>
    <path d="M 38,36 Q 42,24 38,14 M 28,16 Q 32,26 30,36" fill="none" stroke="#B0BEC5" stroke-width="2"/>
    <ellipse cx="30" cy="40" rx="16" ry="12" fill="#FAFAFA" stroke="#B0BEC5" stroke-width="2"/>
    <circle cx="34" cy="14" r="8" fill="#FAFAFA" stroke="#B0BEC5" stroke-width="2"/>
    <path d="M 30,36 Q 34,32 38,36 M 28,16 Q 32,18 38,14" fill="#FAFAFA" stroke="none"/>
    <circle cx="36" cy="12" r="4" fill="#263238"/>
    <circle cx="37" cy="11" r="1.5" fill="#81D4FA"/>
    <path d="M 32 12 L 24 14" stroke="#5D4037" stroke-width="2" fill="none" stroke-linecap="round"/>
    <polygon points="41,12 49,14 43,18" fill="#FF9800" stroke="#E65100" stroke-width="1.5" stroke-linejoin="round"/>
    <rect x="22" y="51" width="4" height="8" fill="#FF9800"/>
    <polygon points="22,59 30,59 27,62" fill="#E65100"/>
    <rect x="32" y="51" width="4" height="8" fill="#FF9800"/>
    <polygon points="32,59 40,59 37,62" fill="#E65100"/>
  </g>

  <g id="top-hat">
    <line x1="24" y1="6" x2="44" y2="6" stroke="#212121" stroke-width="4" stroke-linecap="round"/>
    <rect x="28" y="-12" width="12" height="18" fill="#212121"/>
    <rect x="28" y="2" width="12" height="3" fill="#FFC107"/>
  </g>

  <g id="goose-swimming">
    <ellipse cx="20" cy="20" rx="15" ry="5" fill="none" stroke="#64B5F6" stroke-width="2" class="anim-ripple"/>
    <ellipse cx="20" cy="20" rx="25" ry="8" fill="none" stroke="#64B5F6" stroke-width="1.5" class="anim-ripple-delay"/>
    <g class="anim-swim-bob" transform="translate(-10, -20)">
      <polygon points="16,40 4,32 8,46" fill="#FAFAFA" stroke="#B0BEC5" stroke-width="2" stroke-linejoin="round"/>
      <path d="M 38,36 Q 42,24 38,14 L 28,16 Q 32,26 30,36 Z" fill="#FAFAFA"/>
      <path d="M 38,36 Q 42,24 38,14 M 28,16 Q 32,26 30,36" fill="none" stroke="#B0BEC5" stroke-width="2"/>
      <path d="M 14,40 A 16 12 0 0 1 46 40 Z" fill="#FAFAFA" stroke="#B0BEC5" stroke-width="2"/>
      <circle cx="34" cy="14" r="8" fill="#FAFAFA" stroke="#B0BEC5" stroke-width="2"/>
      <path d="M 30,36 Q 34,32 38,36 M 28,16 Q 32,18 38,14" fill="#FAFAFA" stroke="none"/>
      <circle cx="36" cy="12" r="4" fill="#263238"/>
      <circle cx="37" cy="11" r="1.5" fill="#81D4FA"/>
      <path d="M 32 12 L 24 14" stroke="#5D4037" stroke-width="2" fill="none" stroke-linecap="round"/>
      <polygon points="41,12 49,14 43,18" fill="#FF9800" stroke="#E65100" stroke-width="1.5" stroke-linejoin="round"/>
    </g>
  </g>
</defs>
`;

export const BuildingBarn = svg`
<svg viewBox="0 0 160 160" width="160" height="160" overflow="visible">
  <rect x="20" y="60" width="40" height="90" fill="#5D4037" stroke="#3E2723" stroke-width="3"/>
  <path d="M 20 60 C 20 30, 60 30, 60 60" fill="#8D6E63" stroke="#3E2723" stroke-width="3"/>
  <rect x="50" y="80" width="100" height="70" fill="#C62828" stroke="#4A0000" stroke-width="3"/>
  <polygon points="40,80 100,30 160,80" fill="#4E342E" stroke="#3E2723" stroke-width="3"/>
  <circle cx="100" cy="60" r="16" fill="#DAA520" stroke="#B8860B" stroke-width="3" stroke-dasharray="6 4"/>
  <path d="M 80 150 L 80 110 A 20 20 0 0 1 120 110 L 120 150 Z" fill="#3E2723" stroke="#111" stroke-width="3"/>
  <line x1="100" y1="110" x2="100" y2="150" stroke="#111" stroke-width="2"/>
</svg>`;

export const BuildingLibrary = svg`
<svg viewBox="0 0 180 160" width="180" height="160" overflow="visible">
  <rect x="20" y="60" width="140" height="90" fill="#E0E0E0" stroke="#9E9E9E" stroke-width="3"/>
  <rect x="30" y="60" width="15" height="90" fill="#F5F5F5" stroke="#BDBDBD" stroke-width="2"/>
  <rect x="65" y="60" width="15" height="90" fill="#F5F5F5" stroke="#BDBDBD" stroke-width="2"/>
  <rect x="100" y="60" width="15" height="90" fill="#F5F5F5" stroke="#BDBDBD" stroke-width="2"/>
  <rect x="135" y="60" width="15" height="90" fill="#F5F5F5" stroke="#BDBDBD" stroke-width="2"/>
  <path d="M 10 60 Q 90 -10 170 60 Z" fill="#1565C0" stroke="#0D47A1" stroke-width="3"/>
  <polygon points="80,20 100,0 110,5 90,25" fill="#DAA520" stroke="#B8860B" stroke-width="2"/>
  <rect x="70" y="110" width="40" height="40" fill="#3E2723" stroke="#111" stroke-width="3"/>
  <circle cx="90" cy="80" r="12" fill="#4FC3F7" stroke="#0277BD" stroke-width="3" class="anim-flicker"/>
</svg>`;

export const BuildingForge = svg`
<svg viewBox="0 0 160 160" width="160" height="160" overflow="visible">
  <polygon points="10,150 30,70 130,70 150,150" fill="#757575" stroke="#424242" stroke-width="3"/>
  <rect x="100" y="20" width="20" height="50" fill="#9E9E9E" stroke="#616161" stroke-width="3"/>
  <circle cx="110" cy="25" r="12" fill="#BDBDBD" class="anim-smoke"/>
  <path d="M 50 150 L 50 100 C 50 85 110 85 110 100 L 110 150 Z" fill="#212121" stroke="#111" stroke-width="3"/>
  <path d="M 60 150 Q 75 110 80 135 Q 90 110 100 150 Z" fill="#FF5722" class="anim-flicker"/>
  <path d="M 65 150 Q 75 125 80 145 Q 85 125 95 150 Z" fill="#FFC107" class="anim-flicker"/>
</svg>`;

export const BuildingFactory = svg`
<svg viewBox="0 0 160 160" width="160" height="160" overflow="visible">
  <polygon points="10,100 40,70 40,100 70,70 70,100 100,70 100,100 150,100 150,70 150,100" fill="#B0BEC5" stroke="#78909C" stroke-width="3"/>
  <rect x="110" y="30" width="15" height="70" fill="#757575" stroke="#424242" stroke-width="3"/>
  <rect x="135" y="20" width="15" height="80" fill="#757575" stroke="#424242" stroke-width="3"/>
  <circle cx="117" cy="30" r="10" fill="#BDBDBD" class="anim-smoke"/>
  <circle cx="142" cy="20" r="14" fill="#BDBDBD" class="anim-smoke"/>
  <rect x="10" y="100" width="140" height="50" fill="#D84315" stroke="#BF360C" stroke-width="3"/>
  <circle cx="120" cy="125" r="18" fill="#78909C" stroke="#455A64" stroke-width="3" stroke-dasharray="6 4" class="anim-flicker"/>
  <rect x="30" y="110" width="30" height="40" fill="#3E2723" stroke="#111" stroke-width="3"/>
</svg>`;

export const BuildingHall = svg`
<svg viewBox="0 0 180 160" width="180" height="160" overflow="visible">
  <rect x="20" y="70" width="140" height="80" fill="#FFF3E0" stroke="#BCAAA4" stroke-width="3"/>
  <path d="M 10 70 C 10 10 170 10 170 70 Z" fill="#00838F" stroke="#006064" stroke-width="3"/> 
  <circle cx="90" cy="45" r="14" fill="#FFECB3" stroke="#FFB300" stroke-width="3"/>
  <line x1="90" y1="45" x2="90" y2="35" stroke="#111" stroke-width="2"/>
  <line x1="90" y1="45" x2="98" y2="45" stroke="#111" stroke-width="2"/>
  <path d="M 70 150 L 70 110 A 12 12 0 0 1 110 110 L 110 150 Z" fill="#5D4037" stroke="#3E2723" stroke-width="3"/>
</svg>`;

export const BuildingTower = svg`
<svg viewBox="0 0 160 160" width="160" height="160" overflow="visible">
  <polygon points="40,150 120,150 100,50 60,50" fill="#78909C" stroke="#455A64" stroke-width="3"/>
  <rect x="50" y="20" width="60" height="30" fill="#546E7A" stroke="#263238" stroke-width="3"/>
  <circle cx="80" cy="35" r="12" fill="#81D4FA" stroke="#0277BD" stroke-width="3" class="anim-flicker"/>
  <polygon points="40,20 120,20 80,-20" fill="#3949AB" stroke="#1C2833" stroke-width="3"/>
  <path d="M 65 150 L 65 120 A 15 15 0 0 1 95 120 L 95 150 Z" fill="#3E2723" stroke="#111" stroke-width="3"/>
</svg>`;

export const BuildingScriptorium = svg`
<svg viewBox="0 0 160 160" width="160" height="160" overflow="visible">
  <rect x="20" y="70" width="120" height="80" fill="#D7CCC8" stroke="#8D6E63" stroke-width="3"/>
  <line x1="20" y1="70" x2="140" y2="150" stroke="#5D4037" stroke-width="3"/>
  <line x1="140" y1="70" x2="20" y2="150" stroke="#5D4037" stroke-width="3"/>
  <rect x="70" y="70" width="20" height="80" fill="#5D4037"/>
  <polygon points="10,70 80,20 150,70" fill="#8D6E63" stroke="#4E342E" stroke-width="3"/>
  <path d="M 80 10 Q 100 -20 120 -10 Q 110 10 90 20 Z" fill="#FAFAFA" stroke="#BDBDBD" stroke-width="2"/>
  <line x1="80" y1="10" x2="120" y2="-10" stroke="#9E9E9E" stroke-width="2"/>
  <rect x="65" y="110" width="30" height="40" fill="#4E342E" stroke="#111" stroke-width="3"/>
</svg>`;

export const BuildingApothecary = svg`
<svg viewBox="0 0 160 160" width="160" height="160" overflow="visible">
  <rect x="30" y="60" width="100" height="90" fill="#BCAAA4" stroke="#8D6E63" stroke-width="3"/>
  <polygon points="20,60 80,10 140,60" fill="#5D4037" stroke="#3E2723" stroke-width="3"/>
  <!-- Hanging Sign -->
  <line x1="130" y1="70" x2="160" y2="70" stroke="#111" stroke-width="3"/>
  <rect x="140" y="70" width="20" height="30" fill="#FFF8E1" stroke="#FFC107" stroke-width="2"/>
  <!-- Potion icon -->
  <circle cx="150" cy="90" r="5" fill="#E91E63"/>
  <polygon points="148,90 152,90 150,75" fill="#E91E63"/>
  <!-- Door -->
  <path d="M 65 150 L 65 110 A 15 15 0 0 1 95 110 L 95 150 Z" fill="#795548" stroke="#111" stroke-width="3"/>
</svg>`;

export const BuildingMarket = svg`
<svg viewBox="0 0 160 160" width="160" height="160" overflow="visible">
  <rect x="10" y="80" width="140" height="70" fill="#FFECB3" stroke="#FFB300" stroke-width="3"/>
  <!-- Striped Awning -->
  <path d="M 0 80 L 160 80 L 150 40 L 10 40 Z" fill="#F44336" stroke="#B71C1C" stroke-width="2"/>
  <polygon points="10,80 30,80 25,40 10,40" fill="#FFF"/>
  <polygon points="50,80 70,80 65,40 55,40" fill="#FFF"/>
  <polygon points="90,80 110,80 105,40 95,40" fill="#FFF"/>
  <polygon points="130,80 150,80 145,40 135,40" fill="#FFF"/>
  <!-- Wheat Sign -->
  <circle cx="80" cy="20" r="16" fill="#FFCA28" stroke="#FF8F00" stroke-width="2"/>
  <!-- Door -->
  <rect x="65" y="110" width="30" height="40" fill="#8D6E63" stroke="#3E2723" stroke-width="3"/>
</svg>`;
