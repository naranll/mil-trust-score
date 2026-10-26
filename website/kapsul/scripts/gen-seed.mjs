// seed.sql-ийг src/data/stats.ts-ээс үүсгэнэ (давхардалгүй байлгах)
import { readFileSync, writeFileSync } from "fs";
const src = readFileSync("src/data/stats.ts", "utf8");
const sources = {};
for (const m of src.matchAll(/const (\w+): Source = \{\s*name: "([^"]+)",\s*url: "([^"]*)",?\s*\};/g)) sources[m[1]] = [m[2], m[3]];
const rows = [];
for (const m of src.matchAll(/\{ key: "([^"]+)", dataset: "([^"]+)", label: "([^"]+)", value: ([\d.]+), unit: "([^"]+)", period: "([^"]+)", source: (\w+) \}/g)) {
  const [, key, dataset, label, value, unit, period, s] = m;
  const [sn, su] = sources[s];
  const q = (x) => "'" + x.replace(/'/g, "''") + "'";
  rows.push(`(${q(key)}, ${q(dataset)}, ${q(label)}, ${value}, ${q(unit)}, ${q(period)}, ${q(sn)}, ${q(su)})`);
}
writeFileSync("supabase/seed.sql", `-- src/data/stats.ts-ээс автоматаар үүсгэсэн. Гараар бүү засаарай: node scripts/gen-seed.mjs\ninsert into public.mil_stats (key, dataset, label, value, unit, period, source_name, source_url) values\n${rows.join(",\n")}\non conflict (key) do update set dataset = excluded.dataset, label = excluded.label, value = excluded.value, unit = excluded.unit, period = excluded.period, source_name = excluded.source_name, source_url = excluded.source_url;\n`);
console.log(rows.length, "rows");
