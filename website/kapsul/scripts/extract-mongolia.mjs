// world-atlas-аас Монголын хилийн шугамыг гаргаж src/data/mongolia-outline.ts болгоно.
// Ажиллуулах: node scripts/extract-mongolia.mjs
import { readFileSync, writeFileSync } from "fs";
import { feature } from "topojson-client";
const world = JSON.parse(readFileSync("node_modules/world-atlas/countries-50m.json", "utf8"));
const mn = feature(world, world.objects.countries).features.find((f) => f.properties.name === "Mongolia");
const ring = mn.geometry.coordinates[0].map(([lon, lat]) => [Math.round(lon * 1000) / 1000, Math.round(lat * 1000) / 1000]);
writeFileSync("src/data/mongolia-outline.ts", `// Монгол Улсын хилийн шугам (lon, lat). Эх сурвалж: Natural Earth 1:50m, world-atlas npm багцаар.\nexport const MONGOLIA_OUTLINE: [number, number][] = ${JSON.stringify(ring)};\n`);
console.log("points:", ring.length);
