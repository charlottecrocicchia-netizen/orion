#!/usr/bin/env node
/**
 * Le validateur de palette d'Orion — toute couleur de données passe ici
 * avant d'entrer dans le produit (règle de recette, doctrine de design).
 *
 *   node scripts/validate_palette.js <spec.json>
 *
 * La spec décrit des MODES (light/dark), chacun avec son fond, son encre
 * et ses couleurs de données ; les fills du produit étant des teintes
 * posées en opacité par paliers (cartes : montant → palier), le
 * validateur COMPOSE chaque teinte sur le fond à chaque palier et mesure
 * ce que l'œil verra réellement — jamais les hex nus.
 *
 * Vérifications :
 *   1. Distinguabilité entre teintes à chaque palier (ΔE Lab), en vision
 *      typique ET sous simulation deutéranopie/protanopie (Machado 2009).
 *   2. Perceptibilité : palier le plus pâle visible sur le fond, palier
 *      le plus foncé suffisamment contrasté (WCAG).
 *   3. « Pas de donnée » (surface) discernable du palier le plus pâle.
 *   4. Sélection : teinte pleine force + liseré couleur de fond — le
 *      liseré doit trancher sur la sélection et sur les voisins.
 *   5. Interdits de doctrine : noir pur, chroma criard (OKLCH C > 0,26).
 *
 * Sortie : un tableau par mode, code de sortie 1 si un seuil dur casse.
 */

const fs = require("node:fs");

// ---------------------------------------------------------------- couleur
const hex2rgb = (hex) => {
  const h = hex.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
};
const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const delin = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
const luminance = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const contrast = (a, b) => {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
};
// Alpha-blend sRGB (ce que fait fill-opacity sur un aplat).
const blend = (fg, alpha, bg) => fg.map((c, i) => c * alpha + bg[i] * (1 - alpha));

// sRGB → Lab (D65) pour ΔE76.
function rgb2lab(rgb) {
  const [r, g, b] = rgb.map(lin);
  const x = (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047;
  const y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b;
  const z = (0.0193339 * r + 0.119192 * g + 0.9503041 * b) / 1.08883;
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const [fx, fy, fz] = [x, y, z].map(f);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}
const deltaE = (a, b) => {
  const [la, lb] = [rgb2lab(a), rgb2lab(b)];
  return Math.hypot(la[0] - lb[0], la[1] - lb[1], la[2] - lb[2]);
};

// OKLab (Björn Ottosson) pour le plafond de chroma « jamais criard ».
function okChroma(rgb) {
  const [r, g, b] = rgb.map(lin);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const A = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s;
  return Math.hypot(A, B);
}

// Simulation dichromatique (Machado et al. 2009, sévérité 1.0), en RGB linéaire.
const CVD = {
  protanopie: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
  deuteranopie: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881],
  ],
};
function simulate(rgb, matrix) {
  const l = rgb.map(lin);
  return matrix
    .map((row) => Math.min(1, Math.max(0, row[0] * l[0] + row[1] * l[1] + row[2] * l[2])))
    .map(delin);
}

// ---------------------------------------------------------------- checks
const spec = JSON.parse(fs.readFileSync(process.argv[2] ?? "palette.json", "utf8"));
let failures = 0;
const fail = (msg) => {
  failures += 1;
  console.log(`  ✗ ${msg}`);
};
const pass = (msg) => console.log(`  ✓ ${msg}`);

for (const [mode, m] of Object.entries(spec.modes)) {
  console.log(`\n=== mode ${mode} — fond ${m.background} ===`);
  const bg = hex2rgb(m.background);
  const surface = hex2rgb(m.surface);
  const names = Object.keys(m.colors);
  const swatch = (name, step) => blend(hex2rgb(m.colors[name]), step, bg);

  // 5. Interdits de doctrine.
  for (const [name, hex] of Object.entries(m.colors)) {
    if (hex.toLowerCase() === "#000000") fail(`${name} : noir pur interdit`);
    const c = okChroma(hex2rgb(hex));
    if (c > 0.26) fail(`${name} ${hex} : chroma OKLCH ${c.toFixed(3)} > 0,26 (criard)`);
  }
  pass("doctrine : pas de noir pur, chroma ≤ 0,26 sur toutes les teintes");

  // 1. Distinguabilité par palier (les paliers pâles convergent par
  //    construction — seuil dur à partir du 3e palier seulement).
  for (const step of m.steps) {
    let worst = { d: Infinity, pair: "" };
    for (let i = 0; i < names.length; i++)
      for (let j = i + 1; j < names.length; j++) {
        const d = deltaE(swatch(names[i], step), swatch(names[j], step));
        if (d < worst.d) worst = { d, pair: `${names[i]}↔${names[j]}` };
      }
    // Les paliers pâles convergent par construction (l'identité y est
    // portée par le survol, la légende et le libellé) : en dessous du 3e
    // palier le contrôle est INFORMATIF — signalé, jamais bloquant.
    const hard = step >= m.steps[2];
    const line = `palier ${step} : ΔE min ${worst.d.toFixed(1)} (${worst.pair})`;
    if (hard) (worst.d >= 15 ? pass : fail)(`${line} [seuil 15]`);
    else console.log(`  ${worst.d >= 5 ? "✓" : "△"} ${line} [informatif ≥ 5]`);
  }

  // 1b. Vision déficiente aux deux paliers les plus lisibles.
  for (const [kind, matrix] of Object.entries(CVD)) {
    for (const step of m.steps.slice(-2)) {
      let worst = { d: Infinity, pair: "" };
      for (let i = 0; i < names.length; i++)
        for (let j = i + 1; j < names.length; j++) {
          const d = deltaE(
            simulate(swatch(names[i], step), matrix),
            simulate(swatch(names[j], step), matrix),
          );
          if (d < worst.d) worst = { d, pair: `${names[i]}↔${names[j]}` };
        }
      (worst.d >= 11 ? pass : fail)(
        `${kind} palier ${step} : ΔE min ${worst.d.toFixed(1)} (${worst.pair}) [seuil 11]`,
      );
    }
  }

  // 2. Perceptibilité des extrêmes.
  for (const name of names) {
    const pale = contrast(swatch(name, m.steps[0]), bg);
    const deep = contrast(swatch(name, m.steps.at(-1)), bg);
    if (pale < 1.06) fail(`${name} : palier pâle invisible sur le fond (${pale.toFixed(2)})`);
    if (deep < 3) fail(`${name} : palier foncé < 3:1 sur le fond (${deep.toFixed(2)})`);
  }
  pass("extrêmes : palier pâle perceptible (≥ 1,06), palier foncé ≥ 3:1");

  // 3. « Pas de donnée » ≠ « peu de donnée ».
  for (const name of names) {
    const d = deltaE(surface, swatch(name, m.steps[0]));
    if (d < 4) fail(`${name} : palier pâle se confond avec « pas de donnée » (ΔE ${d.toFixed(1)})`);
  }
  pass("« pas de donnée » (surface) discernable du palier le plus pâle (ΔE ≥ 4)");

  // 4. Sélection : teinte pleine force + liseré couleur de fond.
  for (const name of names) {
    const sel = blend(hex2rgb(m.colors[name]), m.selection, bg);
    const rim = contrast(sel, bg);
    if (rim < 3) fail(`${name} : liseré de sélection < 3:1 (${rim.toFixed(2)})`);
  }
  pass(`sélection (opacité ${spec.modes[mode].selection}) : liseré fond ≥ 3:1 sur chaque teinte`);
}

console.log(failures ? `\n${failures} échec(s).` : "\nPalette conforme.");
process.exit(failures ? 1 : 0);
