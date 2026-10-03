/**
 * Card catalogue lookup — check who is already in the game before adding players.
 *
 *   pnpm catalog <name>            search one name (accents, order and "Jr" don't matter)
 *   pnpm catalog --check list.txt  check a list (one name per line, optional "| club" hint)
 *   pnpm catalog --stats           cards per source file / rarity, distinct people
 *   pnpm catalog --export out.csv  every card as CSV (id, names, position, nation, club, season, rarity, overall, file)
 *
 * Results are labelled EXATO (same name), TOKENS (every word of the query is in the
 * name), PARCIAL (every word starts a word of the name: "vini" → Vinícius), SOBRENOME? (only the last word matches — usually a namesake) or
 * NAO_ENCONTRADO. Always look at club/position/season: the catalogue has namesakes.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { PLAYER_SOURCES, UNIQUE_CARDS } from '../shared/game/players/index';
import type { Player } from '../shared/game/gameData';
import { rarityForBaseOverall } from '../shared/game/rarity';

interface Entry { card: Player; file: string; tokens: string[]; names: string[] }

const normalize = (text: string) => text
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase()
  .replace(/\bjr\b\.?/g, 'junior')
  .replace(/[^a-z0-9 ]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const entries: Entry[] = [
  ...PLAYER_SOURCES.flatMap(source => source.players.map(card => ({ card: { ...card, rarity: rarityForBaseOverall(card.overall) }, file: source.file }))),
  ...UNIQUE_CARDS.map(card => ({ card, file: 'uniqueCards' })),
].map(({ card, file }) => {
  const names = [card.shortName, card.fullName].filter(Boolean).map(normalize);
  return { card, file, names, tokens: [...new Set(names.flatMap(name => name.split(' ')))] };
});

type Label = 'EXATO' | 'TOKENS' | 'PARCIAL' | 'SOBRENOME?';

function search(query: string): Array<{ entry: Entry; label: Label }> {
  const q = normalize(query);
  const words = q.split(' ').filter(Boolean);
  if (!words.length) return [];
  const results: Array<{ entry: Entry; label: Label }> = [];
  for (const entry of entries) {
    if (entry.names.includes(q)) results.push({ entry, label: 'EXATO' });
    else if (words.every(word => entry.tokens.includes(word))) results.push({ entry, label: 'TOKENS' });
    else if (words.every(word => entry.tokens.some(token => token === word || (word.length >= 3 && token.startsWith(word))))) results.push({ entry, label: 'PARCIAL' });
    else if (words.length > 1 && entry.tokens.includes(words[words.length - 1])) results.push({ entry, label: 'SOBRENOME?' });
  }
  const rank: Record<Label, number> = { EXATO: 0, TOKENS: 1, PARCIAL: 2, 'SOBRENOME?': 3 };
  return results.sort((a, b) => rank[a.label] - rank[b.label] || b.entry.card.overall - a.entry.card.overall);
}

const describe = ({ card, file }: Entry) =>
  `${card.id.padEnd(28)} ${card.shortName} (${card.fullName}) · ${card.position} · ${card.nation} · ${card.club} · ${card.season} · ${card.rarity} ${card.overall} · ${file}`;

function printSearch(query: string, clubHint?: string, limit = 12) {
  let found = search(query);
  if (clubHint) {
    const hint = normalize(clubHint);
    found = found.sort((a, b) => Number(normalize(b.entry.card.club).includes(hint)) - Number(normalize(a.entry.card.club).includes(hint)));
  }
  const best = found[0]?.label ?? 'NAO_ENCONTRADO';
  console.log(`\n${best.padEnd(15)} ${query}${clubHint ? ` | ${clubHint}` : ''}`);
  for (const { entry, label } of found.slice(0, limit)) console.log(`  ${label.padEnd(11)} ${describe(entry)}`);
  if (found.length > limit) console.log(`  … +${found.length - limit}`);
}

function stats() {
  const people = new Set(entries.map(({ card }) => card.historicalPlayerId ?? card.basePlayerId ?? normalize(card.fullName || card.shortName)));
  console.log(`${entries.length} cartas · ${people.size} pessoas distintas\n`);
  const byFile = new Map<string, number>();
  const byRarity = new Map<string, number>();
  for (const { card, file } of entries) {
    byFile.set(file, (byFile.get(file) ?? 0) + 1);
    byRarity.set(card.rarity, (byRarity.get(card.rarity) ?? 0) + 1);
  }
  for (const [file, count] of byFile) console.log(`  ${String(count).padStart(5)}  ${file}`);
  console.log('');
  for (const [rarity, count] of byRarity) console.log(`  ${String(count).padStart(5)}  ${rarity}`);
}

function exportCsv(path: string) {
  const cell = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const header = ['id', 'shortName', 'fullName', 'position', 'nation', 'club', 'season', 'rarity', 'overall', 'file'];
  const rows = entries.map(({ card, file }) => [card.id, card.shortName, card.fullName, card.position, card.nation, card.club, card.season, card.rarity, card.overall, file].map(cell).join(','));
  writeFileSync(path, [header.join(','), ...rows].join('\n') + '\n');
  console.log(`${rows.length} cartas → ${path}`);
}

const [command, arg] = process.argv.slice(2);
if (!command) {
  console.log('Uso: pnpm catalog <nome> | --check lista.txt | --stats | --export arquivo.csv');
} else if (command === '--stats') {
  stats();
} else if (command === '--export') {
  exportCsv(arg ?? 'catalog.csv');
} else if (command === '--check') {
  const lines = readFileSync(arg, 'utf8').split(/\r?\n/).map(line => line.trim()).filter(line => line && !line.startsWith('#'));
  for (const line of lines) {
    const [name, club] = line.split('|').map(part => part.trim());
    printSearch(name, club, 5);
  }
} else {
  printSearch(process.argv.slice(2).join(' '));
}
