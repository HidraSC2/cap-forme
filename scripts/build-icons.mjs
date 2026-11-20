// Génère les icônes PNG de l'application à partir de public/icon.svg : node scripts/build-icons.mjs
import sharp from 'sharp';
import { readFileSync } from 'node:fs';
const svg = readFileSync('public/icon.svg');
// Version sans coins arrondis pour iOS et les icônes « maskable » (le système applique son propre masque).
const square = Buffer.from(svg.toString().replace('rx="112"', 'rx="0"'));
await sharp(svg, { density: 300 }).resize(192, 192).png().toFile('public/icon-192.png');
await sharp(square, { density: 300 }).resize(512, 512).png().toFile('public/icon-512.png');
await sharp(square, { density: 300 }).resize(180, 180).png().toFile('public/apple-touch-icon.png');
console.log('Icônes générées dans public/');
