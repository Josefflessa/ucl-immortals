import fs from 'node:fs';
import { clubIdForName, CRESTS_BY_ID } from '../shared/game/crests';
import { PLAYER_SOURCES } from '../shared/game/players/index';
import { rarityForBaseOverall } from '../shared/game/rarity';

const S = 'C:/Users/josel/AppData/Local/Temp/claude/C--Users-josel-Downloads-ucl-immortals/2f1a988b-6753-40ae-980c-0c86cb521343/scratchpad';
const final = JSON.parse(fs.readFileSync(S + '/final.json', 'utf8')) as { id: string; name: string; club: string; ed: number }[];
const nameBy = new Map(final.map(f => [f.id + '_' + f.ed, f.name]));
const rows = fs.readFileSync(S + '/rows.txt', 'utf8').split(/\r?\n/).filter(Boolean);
const comps = fs.readFileSync(S + '/comp.txt', 'utf8').trim().split(',');
const keys = final.map(f => f.id + '_' + f.ed);
const rowKeys = rows.map(r => r.split('|')[0]);
const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const POS: Record<string, string> = { GL: 'GK', ZAG: 'CB', LD: 'RB', ADD: 'RB', LE: 'LB', ADE: 'LB', VOL: 'CDM', MC: 'CM', MEI: 'CAM', ME: 'LM', MD: 'RM', PE: 'LW', PD: 'RW', SA: 'ST', ATA: 'ST' };
const CLUB: Record<string, string> = {
  'Paris Saint-Germain': 'PSG', 'Tottenham Hotspur': 'Tottenham', Spurs: 'Tottenham', 'Bayern München': 'Bayern Munich', 'FC Bayern': 'Bayern Munich',
  Inter: 'Inter Milan', 'FC Barcelona': 'Barcelona', 'Atlético de Madrid': 'Atlético Madrid', 'Athletic Club de Bilbao': 'Athletic Bilbao',
  'Olympique Lyon': 'Lyon', 'Olympique de Marseille': 'Marseille', 'AS Monaco': 'Monaco', 'Bor. Dortmund': 'Borussia Dortmund',
  'FC Schalke 04': 'Schalke', 'VfL Wolfsburg': 'Wolfsburg', '1. FC Köln': 'Köln', 'Wolverhampton Wanderers': 'Wolves',
  'TSG 1899 Hoffenheim': 'Hoffenheim', 'Valencia CF': 'Valencia', 'Villarreal CF': 'Villarreal', 'Sevilla FC': 'Sevilla', 'FC Porto': 'Porto',
  'SL Benfica': 'Benfica', 'LOSC Lille': 'Lille', 'OGC Nice': 'Nice', 'Roma FC': 'Roma', 'Newcastle Utd': 'Newcastle',
  'Bayer 04 Leverkusen': 'Bayer Leverkusen', 'Stade Rennes': 'Rennes', 'Manchester Utd': 'Manchester United', 'CSKA Moskva': 'CSKA Moscow', 'Spartak Moskva': 'Spartak Moscow', 'A. Makhachkala': 'Anzhi Makhachkala',
  'Nacional de Montevideo': 'Nacional', 'L.A. Galaxy': 'LA Galaxy', 'Málaga CF': 'Málaga', 'Galatasaray SK': 'Galatasaray', 'West Ham United': 'West Ham', 'Lokomotiv Moskva': 'Lokomotiv Moscow',
};
const NATION: Record<string, string> = { 'Países Baixos': 'Holanda', 'Bósnia e Herz.': 'Bósnia' };
const SHORT: Record<string, string> = {
  'Givanildo Vieira de Souza': 'Hulk', 'Anderson Luis de Carvalho': 'Nenê', 'Rio Antonio Mavuba': 'Mavuba', 'Yevgen Konoplyanka': 'Konoplyanka', 'Seydou Doumbia': 'Doumbia', 'Ronaldo Aparecido Rodrigues Naldo': 'Naldo', 'Kevin-Prince Boateng': 'K.-P. Boateng',
  'Klaas-Jan Huntelaar': 'Huntelaar', 'Hatem Ben Arfa': 'Ben Arfa', 'Stephan El Shaarawy': 'El Shaarawy', 'Rafael van der Vaart': 'Van der Vaart',
  'Mark van Bommel': 'Van Bommel', 'Stefan de Vrij': 'De Vrij', 'Kevin De Bruyne': 'De Bruyne', 'Virgil van Dijk': 'Van Dijk',
  'Matthijs de Ligt': 'De Ligt', 'Donny van de Beek': 'Van de Beek', 'Giovanni Di Lorenzo': 'Di Lorenzo', 'Antonio Di Natale': 'Di Natale',
  'Ángel Di María': 'Di María', 'Felipe Monteiro': 'Felipe Monteiro', 'Thiago Motta': 'Thiago Motta',
};
const NAMEFULL: Record<string, string> = { 'Ronaldo Aparecido Rodrigues Naldo': 'Ronaldo Aparecido Rodrigues' };

const existing = PLAYER_SOURCES.filter(s => s.file !== 'fifaIndex2000Expansion').flatMap(s => s.players);
const ids = new Set(existing.map(p => p.id));
const out: string[] = [];
const drops: string[] = [];
const noCrest = new Set<string>();
const slug = (s: string) => norm(s).replace(/ /g, '_');
const esc = (s: string) => s.replace(/'/g, "\\'");
const mismatch: string[] = [];

rows.forEach((row, i) => {
  const [key, posRaw, ovrS, nationRaw, clubRaw, face, visS, jumpS] = row.split('|');
  if (!nameBy.has(key)) { mismatch.push(key); return; }
  if (['200641_16', '170481_15', '170481_13', '169051_13', '176949_13'].includes(key)) return;
  const full0 = nameBy.get(key)!;
  const ed = +key.split('_')[1];
  const season = (2000 + ed - 1) + '/' + String(ed).padStart(2, '0');
  const club = CLUB[clubRaw] ?? clubRaw;
  const nation = NATION[nationRaw] ?? nationRaw;
  const pos = POS[posRaw.split(' ')[0]];
  if (!pos) throw new Error('pos ' + posRaw + ' ' + key);
  const [rit, fin, pas, dri, def, phy] = face.split(' ').map(Number);
  const ovr = +ovrS, vis = +visS, jump = +jumpS;
  const cRaw = comps[i];
  const comp = cRaw === '?' ? null : +cRaw.split('@')[0];
  const gk = pos === 'GK';
  const short = SHORT[full0] ?? (() => { const t = full0.split(' '); return t.length === 1 ? full0 : t[t.length - 1]; })();
  const full = NAMEFULL[full0] ?? full0;
  const composure = comp ?? Math.round((vis + dri) / 2);
  const defending = gk ? ovr + 4 : def;
  const physical = gk ? jump : phy;
  const id = (slug(short) + '_' + slug(club) + '_' + season.replace('/', '_')).replace(/_+/g, '_');
  const cid = clubIdForName(club);
  const sur = norm(full).split(' ').pop()!;
  const clash = existing.filter(p => clubIdForName(p.club) === cid && (norm(p.fullName).split(' ').pop() === sur || norm(p.shortName).split(' ').pop() === sur));
  if (clash.length || ids.has(id)) { drops.push(full + ' | ' + club + ' ' + season + '  <= ' + clash.map(c => c.fullName + ' ' + c.club + ' ' + c.season).join(', ')); return; }
  if (!CRESTS_BY_ID[cid]) noCrest.add(club);
  ids.add(id);
  out.push(`  { id: '${id}', shortName: '${esc(short)}', fullName: '${esc(full)}', position: '${pos}', nation: '${nation}', club: '${club}', season: '${season}', rarity: '${rarityForBaseOverall(ovr)}', overall: ${ovr},\n    pace: ${rit}, shooting: ${fin}, passing: ${pas}, dribbling: ${dri}, defending: ${defending}, physical: ${physical}, composure: ${composure}, vision: ${vis}, traits: [], photoUrl: '/players/fifaindex-versions/${key}.webp' },`);
});

console.log('rows', rows.length, 'ok', out.length, 'drops', drops.length, 'mismatch', mismatch.join(','), 'keysEqual', JSON.stringify(rowKeys) === JSON.stringify(keys));
console.log('DROPS\n' + drops.join('\n'));
console.log('NO CREST: ' + [...noCrest].join('; '));
fs.writeFileSync(S + '/gen-body.txt', out.join('\n') + '\n');
