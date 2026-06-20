import { useState } from 'react';
import { motion } from 'framer-motion';
import { Player, getRarityColor } from '../../lib/gameData';

interface PlayerCardProps {
  player: Player;
  selected?: boolean;
  onClick?: () => void;
  compact?: boolean;
  lite?: boolean;
  showChemistry?: boolean;
  chemScore?: number;
}

// SoFIFA mapping — updated to latest available FIFA version per player for best photo quality
// ver = FIFA edition year (e.g. 25 = FIFA 25, 24 = FIFA 24). Higher = better face scan quality.
export const SOFIFA_MAPPING: Record<string, { id: number; ver: number }> = {
  // ── IMMORTALS ──────────────────────────────────────────────────────────────
  messi:           { id: 158023, ver: 24 }, // FIFA 24 — sharp photorealistic Messi
  cristiano:       { id: 20801,  ver: 24 }, // FIFA 24 — best CR7 scan
  // ── LEGENDARY ──────────────────────────────────────────────────────────────
  xavi:            { id: 10535,  ver: 23 }, // FIFA 23 — recent FUT Heroes version
  iniesta:         { id: 41,     ver: 22 }, // ✅ CDN-verified (185427=Ørjan Nyland!) FIXED
  modric:          { id: 177003, ver: 25 }, // FIFA 25 — still active
  ramos:           { id: 155862, ver: 24 }, // FIFA 24
  pirlo:           { id: 7763,   ver: 25 }, // ✅ CDN-verified
  kaka:            { id: 138449, ver: 23 }, // FIFA 23 — FUT Icon
  maldini:         { id: 238439, ver: 25 }, // ✅ CDN-verified (was Nainggolan 178518!) FIXED
  nesta:           { id: 1088,   ver: 24 }, // ✅ CDN-verified
  buffon:          { id: 1179,   ver: 23 }, // ✅ CDN-verified (ver24 missing, ver23 works)
  neuer:           { id: 167495, ver: 25 }, // FIFA 25 — still active
  drogba:          { id: 31432,  ver: 24 }, // ✅ CDN-verified — was 41236 (=Ibrahimovic!) FIXED
  henry:           { id: 1625,   ver: 24 }, // FIFA 24 — FUT Icon
  benzema:         { id: 165153, ver: 24 }, // FIFA 24
  casillas:        { id: 5479,   ver: 25 }, // ✅ CDN-verified (was van der Sar 51539!) FIXED
  // ── GOLD ───────────────────────────────────────────────────────────────────
  alonso:          { id: 45197,  ver: 25 }, // ✅ CDN-verified (was Peter Crouch 51257!) FIXED
  busquets:        { id: 189511, ver: 24 }, // FIFA 24
  alves:           { id: 146530, ver: 23 }, // ✅ CDN-verified (was Jesús Navas!) FIXED
  marcelo:         { id: 176676, ver: 22 }, // ✅ CDN-verified (ver23 missing, ver22 works)
  lahm:            { id: 121939, ver: 24 }, // FIFA 24 — FUT Icon
  ribery:          { id: 156616, ver: 23 }, // FIFA 23 — FUT Heroes
  robben:          { id: 9014,   ver: 21 }, // ✅ CDN-verified (ver21 only) FIXED
  lampard:         { id: 242930, ver: 22 }, // ✅ FIXED — correto Icon Lampard
  gerrard:         { id: 13743,  ver: 25 }, // ✅ CDN-verified (was Matt Ritchie!) FIXED
  terry:           { id: 13732,  ver: 18 }, // ✅ CDN-verified (ver18 only) FIXED
  cech:            { id: 48940,  ver: 24 }, // FIFA 24 — FUT Icon
  sneijder:        { id: 139869, ver: 18 }, // ✅ CDN-verified (was Fernandinho 135507!) FIXED
  milito:          { id: 262271, ver: 25 }, // ✅ FIXED — correto Diego Milito
  zanetti:         { id: 1041,   ver: 24 }, // ✅ CDN-verified — was 1168 FIXED
  schweinsteiger:  { id: 121944, ver: 24 }, // FIFA 24 — FUT Icon
  neymar:          { id: 190871, ver: 24 }, // FIFA 24
  suarez:          { id: 176580, ver: 24 }, // FIFA 24
  puyol:           { id: 13038,  ver: 24 }, // ✅ CDN-verified — was 41 FIXED
  chiellini:       { id: 138956, ver: 24 }, // ✅ CDN-verified (was Tony McMahon!) FIXED
  rooney:          { id: 54050,  ver: 24 }, // FIFA 24 — FUT Icon
  giggs:           { id: 241,    ver: 22 }, // ✅ CDN-verified (ver22 only)
  scholes:         { id: 246,    ver: 24 }, // ✅ CDN-verified — was 244 FIXED
  vidic:           { id: 140601, ver: 25 }, // ✅ FIXED — correto Nemanja Vidić
  kompany:         { id: 139720, ver: 20 }, // ✅ CDN-verified (ver20 only)
  silva_david:     { id: 168542, ver: 23 }, // ✅ CDN-verified (ver24 missing, ver23 works)
  // ── SILVER ─────────────────────────────────────────────────────────────────
  valdes:          { id: 193080, ver: 17 }, // ✅ FIXED — correto Víctor Valdés
  fabregas:        { id: 162895, ver: 23 }, // ✅ CDN-verified
  pedro:           { id: 189509, ver: 23 }, // ✅ CDN-verified
  evra            : { id: 52091,  ver: 18 }, // ✅ FIXED — correto Patrice Evra
  maicon:          { id: 135455, ver: 25 }, // ✅ CDN-verified FIXED
  villa:           { id: 113422, ver: 20 }, // ✅ CDN-verified (ver20 only)
  torres:          { id: 49369,  ver: 22 }, // ✅ CDN-verified (ver22 only) — was ver24 FIXED
  aguero:          { id: 153079, ver: 22 }, // ✅ CDN-verified (ver22 only)
  bale:            { id: 173731, ver: 23 }, // ✅ CDN-verified
  seedorf:         { id: 1256,   ver: 24 }, // ✅ CDN-verified — was 139056 FIXED
  pires:           { id: 1605,   ver: 25 }, // ✅ CDN-verified (was 184035) FIXED
  bergkamp:        { id: 238388, ver: 24 }, // ✅ CDN-verified FIXED
  cannavaro:       { id: 1183,   ver: 24 }, // ✅ CDN-verified — was 186398 FIXED
  tevez:           { id: 143001, ver: 21 }, // ✅ CDN-verified (ver21 only),
  vandersar       : { id: 51539, ver: 25 },
  courtois        : { id: 192119, ver: 25 },
  terstegen       : { id: 192448, ver: 25 },
  alisson         : { id: 212831, ver: 25 },
  ederson         : { id: 210257, ver: 25 },
  donnarumma      : { id: 230621, ver: 25 },
  oblak           : { id: 200389, ver: 25 },
  szczesny        : { id: 186153, ver: 25 },
  sommer          : { id: 177683, ver: 25 }, // ✅ FIXED — correto Yann Sommer
  edouard_mendy   : { id: 234642, ver: 25 }, // ✅ FIXED2 — correto Édouard Mendy
  roberto_carlos  : { id: 238430, ver: 25 }, // ✅ FIXED — correto Roberto Carlos
  vandijk         : { id: 203376, ver: 25 },
  rubendias       : { id: 239818, ver: 25 }, // ✅ FIXED — correto Rúben Dias
  marquinhos      : { id: 207865, ver: 25 },
  araujo          : { id: 253163, ver: 25 }, // ✅ FIXED — correto Ronald Araújo
  militao         : { id: 240130, ver: 25 }, // ✅ FIXED — correto Éder Militão
  rudiger         : { id: 205452, ver: 25 },
  thiago_silva    : { id: 164240, ver: 24 },
  david_luiz      : { id: 179944, ver: 21 },
  christensen     : { id: 213661, ver: 25 },
  blanc           : { id: 238443, ver: 25 }, // ✅ FIXED — correto Laurent Blanc
  carvalho        : { id: 3622,   ver: 25 }, // ✅ FIXED — correto Ricardo Carvalho
  marquez         : { id: 26709,  ver: 25 }, // ✅ FIXED — correto Rafael Márquez
  koeman          : { id: 167680, ver: 25 }, // ✅ FIXED — correto Ronald Koeman
  cole_ashley     : { id: 34079,  ver: 25 }, // ✅ FIXED — correto Ashley Cole
  theo_hernandez  : { id: 232656, ver: 25 },
  grimaldo        : { id: 210035, ver: 25 }, // ✅ FIXED2 — correto Alejandro Grimaldo
  riise           : { id: 274967, ver: 25 }, // ✅ FIXED — correto John Arne Riise
  robertson       : { id: 216267, ver: 25 },
  hakimi          : { id: 235212, ver: 25 },
  walker          : { id: 188377, ver: 25 },
  carvajal        : { id: 204963, ver: 25 },
  frimpong        : { id: 253149, ver: 25 }, // ✅ FIXED — correto Jeremie Frimpong
  reece_james     : { id: 211522, ver: 25 }, // ✅ FIXED — correto Reece James
  azpilicueta     : { id: 184432, ver: 25 },
  gullit          : { id: 214100, ver: 24 },
  beckham         : { id: 250,    ver: 25 }, // ✅ FIXED — correto David Beckham
  keane           : { id: 238384, ver: 24 },
  rijkaard        : { id: 214098, ver: 25 }, // ✅ FIXED — correto Frank Rijkaard
  matthaus        : { id: 238435, ver: 21 }, // ✅ FIXED — correto Lothar Matthäus
  dalglish        : { id: 247699, ver: 22 }, // ✅ FIXED — correto Kenny Dalglish
  hagi            : { id: 166124, ver: 22 }, // ✅ FIXED2 — correto Gheorghe Hagi
  socrates        : { id: 190046, ver: 25 }, // ✅ FIXED — correto Sócrates
  deco            : { id: 246508, ver: 25 }, // ✅ FIXED3 — correto Deco
  veron           : { id: 7518,   ver: 20 }, // ✅ FIXED — correto Verón
  zola            : { id: 239110, ver: 24 }, // ✅ FIXED — correto Gianfranco Zola
  ruicosta        : { id: 1025,   ver: 25 }, // ✅ FIXED — correto Rui Costa
  abedipele       : { id: 167425, ver: 24 }, // ✅ FIXED — correto Abedi Pelé
  rodri           : { id: 231866, ver: 25 },
  gundogan        : { id: 186942, ver: 25 },
  kroos           : { id: 182521, ver: 24 },
  kimmich         : { id: 212622, ver: 25 }, // ✅ FIXED — correto Joshua Kimmich
  goretzka        : { id: 209658, ver: 25 },
  bruno_fernandes : { id: 212198, ver: 25 },
  odegaard        : { id: 222665, ver: 25 },
  barella         : { id: 224232, ver: 25 }, // ✅ FIXED — correto Nicolò Barella
  calhanoglu      : { id: 208128, ver: 25 }, // ✅ FIXED — correto Hakan Çalhanoğlu
  dejong          : { id: 228702, ver: 25 },
  pedri           : { id: 251854, ver: 25 }, // ✅ FIXED — correto Pedri
  casemiro        : { id: 200145, ver: 25 },
  wirtz           : { id: 256630, ver: 25 },
  xhaka           : { id: 199503, ver: 25 }, // ✅ FIXED — correto Granit Xhaka
  kante           : { id: 215914, ver: 25 },
  jorginho        : { id: 205498, ver: 25 }, // ✅ FIXED — correto Jorginho
  kovacic         : { id: 207410, ver: 25 },
  ronaldo_nazario : { id: 37576, ver: 25 },
  ibrahimovic     : { id: 41236, ver: 23 },
  rivaldo         : { id: 242950, ver: 24 }, // ✅ FIXED — correto Rivaldo (ver24)
  cruyff          : { id: 190045, ver: 25 }, // ✅ FIXED2 — correto Johan Cruyff
  nistelrooy      : { id: 10264,  ver: 25 }, // ✅ FIXED — correto Ruud van Nistelrooy
  inzaghi         : { id: 238382, ver: 24 },
  owen            : { id: 5419,   ver: 22 }, // ✅ FIXED2 — correto Michael Owen
  stoichkov       : { id: 239541, ver: 25 }, // ✅ FIXED2 — correto Hristo Stoichkov
  butragueno      : { id: 238419, ver: 24 },
  garrincha       : { id: 247553, ver: 22 }, // ✅ FIXED — correto Garrincha
  etoo            : { id: 9676,   ver: 24 }, // ✅ FIXED — correto Samuel Eto'o
  cantona         : { id: 167198, ver: 22 }, // ✅ FIXED — correto Eric Cantona
  kewell          : { id: 266801, ver: 23 }, // ✅ FIXED — correto Harry Kewell
  rummenigge      : { id: 246826, ver: 25 }, // ⚠️ CDN verificado, sem CDN alternativo
  voller          : { id: 166676, ver: 25 }, // ✅ FIXED — correto Rudi Völler
  papin           : { id: 167134, ver: 25 }, // ✅ FIXED — correto Jean-Pierre Papin
  haaland         : { id: 239085, ver: 25 },
  mbappe          : { id: 231747, ver: 25 },
  vinicius        : { id: 238794, ver: 25 },
  bellingham      : { id: 252371, ver: 25 },
  salah           : { id: 209331, ver: 25 },
  kane            : { id: 202126, ver: 25 },
  lewandowski     : { id: 188545, ver: 25 },
  griezmann       : { id: 194765, ver: 25 },
  bernardo_silva  : { id: 218667, ver: 25 },
  saka            : { id: 246669, ver: 24 }, // ✅ FIXED — correto Bukayo Saka
  rice            : { id: 234378, ver: 25 },
  martinelli      : { id: 251566, ver: 25 },
  gabriel         : { id: 232580, ver: 25 },
  gabriel_jesus   : { id: 230666, ver: 25 },
  lautaro         : { id: 231478, ver: 25 },
  leao            : { id: 241721, ver: 25 },
  dimaria         : { id: 183898, ver: 25 },
  son             : { id: 200104, ver: 25 },
  foden           : { id: 237692, ver: 21 }, // ✅ FIXED — correto Phil Foden
  dembele         : { id: 231443, ver: 25 },
  alexis_sanchez  : { id: 184941, ver: 25 },
  lukaku          : { id: 192505, ver: 25 },
  hazard          : { id: 183277, ver: 25 },
  trent           : { id: 231281, ver: 25 },
  cavani          : { id: 179813, ver: 25 },
  willian         : { id: 180403, ver: 25 },
  diego_costa     : { id: 179844, ver: 23 },
  // ── BRASILEIRÃO / HISTÓRICOS ───────────────────────────────────────────────
  filipe_luis     : { id: 164169, ver: 21 }, // ✅ FIXED — Filipe Luís
  guerrero        : { id: 183666, ver: 22 },
  gustavo_gomez   : { id: 226226, ver: 23 },
  felipe_melo     : { id: 135475, ver: 18 }, // ✅ FIXED — Felipe Melo
  pedro_g         : { id: 244589, ver: 20 },
  ganso           : { id: 187688, ver: 17 },
  lucas_moura     : { id: 200949, ver: 23 },
  fernandinho     : { id: 135507, ver: 22 },
  tardelli        : { id: 138456, ver: 20 }, // ✅ FIXED — Diego Tardelli
  alexandre_pato  : { id: 180175, ver: 23 }, // ✅ FIXED — Alexandre Pato
  luiz_adriano    : { id: 176600, ver: 16 },
  bernard         : { id: 205525, ver: 20 },
  diego_alves     : { id: 165580, ver: 22 }, // ✅ FIXED — Diego Alves
  miranda         : { id: 168609, ver: 19 }, // ✅ FIXED — Miranda
  julio_cesar     : { id: 48717, ver: 18 }, // ✅ FIXED — Júlio César
  ramires         : { id: 186146, ver: 20 },
  oscar           : { id: 188152, ver: 17 },
  giuliano        : { id: 198033, ver: 18 },
  taison          : { id: 188803, ver: 21 }, // ✅ FIXED — Taison
  luiz_gustavo    : { id: 185103, ver: 20 },
  rafinha         : { id: 168607, ver: 19 },
  felipe_anderson : { id: 210008, ver: 20 },
  lucas_leiva     : { id: 176266, ver: 20 },
  paulinho        : { id: 187961, ver: 19 }
};

const NATION_CODES: Record<string, string> = {
  'Argentina':        'ar',
  'Portugal':         'pt',
  'Espanha':          'es',
  'Croácia':          'hr',
  'Itália':           'it',
  'Brasil':           'br',
  'Alemanha':         'de',
  'Costa do Marfim':  'ci',
  'França':           'fr',
  'Holanda':          'nl',
  'Inglaterra':       'gb-eng',
  'República Tcheca': 'cz',
  'País de Gales':    'gb-wls',
  'Sérvia':           'rs',
  'Bélgica':          'be',
  'Uruguai':          'uy',
};

// PT-BR position abbreviations
const POS_PT: Record<string, string> = {
  GK: 'GL', CB: 'ZAG', LB: 'LE', RB: 'LD',
  LWB: 'AEL', RWB: 'AED', CDM: 'VOL', CM: 'MC',
  CAM: 'MEI', LM: 'ML', RM: 'MD',
  LW: 'ALE', RW: 'ALD', CF: 'SS', ST: 'CA',
};
const posLabel = (pos: string) => POS_PT[pos] ?? pos;

function getFlagUrl(nation: string): string | null {
  const code = NATION_CODES[nation];
  if (!code) return 'https://flagcdn.com/un.svg'; // fallback
  return `https://flagcdn.com/${code}.svg`;
}

const CLUB_CRESTS: Record<string, string> = {
  'Barcelona': 'https://upload.wikimedia.org/wikipedia/en/4/47/FC_Barcelona_(crest).svg',
  'Real Madrid': 'https://upload.wikimedia.org/wikipedia/en/5/56/Real_Madrid_CF.svg',
  'Milan': 'https://upload.wikimedia.org/wikipedia/commons/d/d0/Logo_of_AC_Milan.svg',
  'Juventus': 'https://upload.wikimedia.org/wikipedia/commons/b/bc/Juventus_FC_2017_icon_%28black%29.svg',
  'Bayern Munich': 'https://upload.wikimedia.org/wikipedia/commons/1/1b/FC_Bayern_M%C3%BCnchen_logo_%282017%29.svg',
  'Chelsea': 'https://upload.wikimedia.org/wikipedia/en/c/cc/Chelsea_FC.svg',
  'Arsenal': 'https://upload.wikimedia.org/wikipedia/en/5/53/Arsenal_FC.svg',
  'Liverpool': 'https://upload.wikimedia.org/wikipedia/en/0/0c/Liverpool_FC.svg',
  'Inter Milan': 'https://upload.wikimedia.org/wikipedia/commons/0/05/FC_Internazionale_Milano_2021.svg',
  'Manchester United': 'https://upload.wikimedia.org/wikipedia/en/7/7a/Manchester_United_FC_crest.svg',
  'Manchester City': 'https://upload.wikimedia.org/wikipedia/en/e/eb/Manchester_City_FC_badge.svg'
};

function getBasePlayerId(playerId: string): string {
  return Object.keys(SOFIFA_MAPPING).find(key => playerId === key || playerId.startsWith(key + '_')) || playerId.split('_')[0];
}

function buildSofifaUrl(playerId: string, size: 360 | 120 = 360): string | null {
  const baseId = getBasePlayerId(playerId);
  const m = SOFIFA_MAPPING[baseId];
  if (!m) return null;
  const padded = String(m.id).padStart(6, '0');
  return `https://cdn.sofifa.net/players/${padded.slice(0,3)}/${padded.slice(3,6)}/${m.ver}_${size}.png`;
}

function getCardTheme(rarity: string) {
  switch (rarity) {
    case 'immortal':  return { bg: 'linear-gradient(160deg,#130c01 0%,#2c1d02 45%,#3d2a03 75%,#130c01 100%)', border: '#FFD700', glow: '0 0 32px rgba(255,215,0,.5),inset 0 0 20px rgba(255,215,0,.18)', accent: '#FFD700', badgeBg: 'rgba(255,215,0,.12)', statColor: '#FFD700', nameGlow: 'rgba(255,215,0,.5)', isPremium: true };
    case 'legendary': return { bg: 'linear-gradient(160deg,#0f0702 0%,#24120a 45%,#361b0a 75%,#0f0702 100%)', border: '#FF8C00', glow: '0 0 24px rgba(255,140,0,.4),inset 0 0 14px rgba(255,140,0,.15)', accent: '#FF8C00', badgeBg: 'rgba(255,140,0,.12)', statColor: '#FF8C00', nameGlow: 'rgba(255,140,0,.4)', isPremium: true };
    case 'gold':      return { bg: 'linear-gradient(160deg,#050509 0%,#18140c 50%,#231e12 85%,#050509 100%)', border: '#C9A84C', glow: '0 0 16px rgba(201,168,76,.22)', accent: '#C9A84C', badgeBg: 'rgba(201,168,76,.1)', statColor: '#E8D080', nameGlow: 'rgba(201,168,76,.35)', isPremium: false };
    case 'silver':    return { bg: 'linear-gradient(160deg,#040408 0%,#121220 55%,#1c1c2e 90%,#040408 100%)', border: '#A8A8B8', glow: 'none', accent: '#C0C0D0', badgeBg: 'rgba(168,168,184,.1)', statColor: '#D0D0E0', nameGlow: 'rgba(168,168,184,.28)', isPremium: false };
    default:          return { bg: 'linear-gradient(160deg,#040202 0%,#150e08 55%,#1f1510 90%,#040202 100%)', border: '#CD7F32', glow: 'none', accent: '#CD7F32', badgeBg: 'rgba(205,127,50,.1)', statColor: '#D09060', nameGlow: 'rgba(205,127,50,.28)', isPremium: false };
  }
}

// Dedicated Player Photo using SoFIFA transparent high-res assets
// Fallback chain: latest_ver_360 → latest_ver_120 → ver23_360 → ver22_360 → placeholder
function PlayerPhoto({ playerId, fullName, size, lowRes = false }: { playerId: string; fullName: string; size: number; lowRes?: boolean }) {
  const baseId = getBasePlayerId(playerId);
  const m = SOFIFA_MAPPING[baseId];

  const urls: string[] = [];
  if (m) {
    const padded = String(m.id).padStart(6, '0');
    const prefix = `https://cdn.sofifa.net/players/${padded.slice(0,3)}/${padded.slice(3,6)}`;
    if (lowRes) {
      urls.push(`${prefix}/${m.ver}_120.png`);
    } else {
      urls.push(`${prefix}/${m.ver}_360.png`);
      if (m.ver > 23) urls.push(`${prefix}/23_360.png`);
      if (m.ver > 22) urls.push(`${prefix}/22_360.png`);
      urls.push(`${prefix}/${m.ver}_120.png`);
    }
  }

  const [urlIdx, setUrlIdx] = useState(0);
  const [failed, setFailed] = useState(false);

  const url = urls[urlIdx] ?? null;

  const handleError = () => {
    if (urlIdx < urls.length - 1) {
      setUrlIdx(prev => prev + 1);
    } else {
      setFailed(true);
    }
  };

  if (failed || !url) {
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.35, opacity: 0.2 }}>
        ⚽
      </div>
    );
  }

  return (
    <img
      src={url}
      alt={fullName}
      referrerPolicy="no-referrer"
      onError={handleError}
      style={{
        width: '100%',
        height: '100%',
        objectFit: 'contain',
        objectPosition: 'center bottom',
        filter: 'drop-shadow(0 6px 14px rgba(0,0,0,.65))',
      }}
    />
  );
}

export default function PlayerCard({ player, selected = false, onClick, compact = false, lite = false, showChemistry = false, chemScore = 0 }: PlayerCardProps) {
  const baseColor = getRarityColor(player.rarity);
  const theme = getCardTheme(player.rarity);
  const baseId = getBasePlayerId(player.id);
  const hasPhoto = !!SOFIFA_MAPPING[baseId];

  // ─── COMPACT CARD ────────────────────────────────────────────────────────
  if (compact) {
    const CompactWrapper = lite ? 'div' : motion.div;
    const compactMotion = lite ? {} : {
      whileHover: onClick ? { scale: 1.06, y: -3 } : {},
      whileTap: onClick ? { scale: 0.97 } : {},
    };
    return (
      <CompactWrapper
        {...compactMotion}
        onClick={onClick}
        className={`relative select-none rounded-xl overflow-hidden flex flex-col ${onClick ? 'cursor-pointer' : ''}`}
        style={{ width: 80, height: 112, background: theme.bg, border: selected ? '2px solid #fff' : `1.5px solid ${theme.border}`, boxShadow: selected ? '0 0 18px rgba(255,255,255,.7)' : theme.glow }}
      >
        {theme.isPremium && !lite && <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(120deg,transparent 30%,rgba(255,255,255,.07) 50%,transparent 70%)', animation: 'shimmer 2.8s infinite ease-in-out' }} />}

        {/* Top: OVR + POS + flag */}
        <div className="flex items-center justify-between px-1.5 pt-1.5 flex-shrink-0 z-10">
          <div className="flex flex-col leading-none">
            <span style={{ fontFamily: 'Bebas Neue,sans-serif', color: '#fff', fontSize: 17, lineHeight: 1 }}>{player.overall}</span>
            <span style={{ fontFamily: 'Rajdhani,sans-serif', color: theme.accent, fontSize: 8, fontWeight: 800, letterSpacing: '0.05em' }}>{posLabel(player.position)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            {getFlagUrl(player.nation) && (
              <img 
                src={getFlagUrl(player.nation)!} 
                alt={player.nation} 
                className="w-4 h-3 object-cover rounded-[1px] border border-white/10"
              />
            )}
            {CLUB_CRESTS[player.club] && (
              <img 
                src={CLUB_CRESTS[player.club]} 
                alt={player.club} 
                className="w-4 h-4 object-contain filter drop-shadow(0 1px 2px rgba(0,0,0,0.5))"
              />
            )}
          </div>
        </div>

        {/* Photo zone — fits exactly inside container, aligned to bottom */}
        <div className="flex-1 flex items-end justify-center overflow-hidden mx-1 pb-1" style={{ minHeight: 0 }}>
          {hasPhoto ? (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'end', justifyContent: 'center' }}>
              <PlayerPhoto playerId={player.id} fullName={player.fullName} size={50} lowRes={lite} />
            </div>
          ) : (
            <span style={{ fontSize: 24, opacity: 0.2 }}>⚽</span>
          )}
        </div>

        {/* Name + chemistry */}
        <div className="flex flex-col items-center flex-shrink-0 pb-1 px-1 z-10">
          <div className="w-full text-center truncate" style={{ fontFamily: 'Rajdhani,sans-serif', fontSize: 9, fontWeight: 800, color: '#fff', background: 'rgba(0,0,0,.6)', borderRadius: 4, padding: '1px 2px', letterSpacing: '0.04em' }}>
            {player.shortName.toUpperCase()}
          </div>
          {showChemistry && (
            <div className="flex gap-0.5 mt-0.5">
              {[0,1,2].map(i => (
                <div key={i} style={{ width: 4, height: 4, borderRadius: '50%', backgroundColor: i < chemScore ? '#22C55E' : '#1a1a2e', boxShadow: i < chemScore ? '0 0 4px #22C55E' : 'none', border: '1px solid rgba(255,255,255,.1)' }} />
              ))}
            </div>
          )}
        </div>
        {!lite && <style>{`@keyframes shimmer{0%,100%{opacity:.4}50%{opacity:1}}`}</style>}
      </CompactWrapper>
    );
  }

  // ─── FULL CARD (200 × 340) ───────────────────────────────────────────────
  const CardWrapper = lite ? 'div' : motion.div;
  const cardMotionProps = lite ? {} : {
    whileHover: { scale: 1.04, y: -5 },
    whileTap: onClick ? { scale: 0.97 } : {},
  };

  return (
    <CardWrapper
      {...cardMotionProps}
      onClick={onClick}
      className={`relative select-none rounded-2xl overflow-hidden flex flex-col ${onClick ? 'cursor-pointer' : ''}`}
      style={{ width: 200, height: 340, background: theme.bg, border: selected ? '3px solid #fff' : `2px solid ${theme.border}`, boxShadow: selected ? '0 0 36px rgba(255,255,255,.8),inset 0 0 18px rgba(255,255,255,.1)' : theme.glow }}
    >
      {/* Grid overlay */}
      <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.035) 1px,transparent 1px)', backgroundSize: '14px 14px' }} />

      {/* Rarity glow blob */}
      <div className="absolute pointer-events-none" style={{ top: -40, left: -40, width: 150, height: 150, borderRadius: '50%', background: baseColor, filter: 'blur(55px)', opacity: .22 }} />

      {/* Shimmer */}
      {theme.isPremium && !lite && <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(120deg,transparent 25%,rgba(255,255,255,.07) 50%,transparent 75%)', animation: 'shimmer 3s infinite ease-in-out' }} />}

      {/* ── TOP ROW — compact to maximise photo space ── */}
      <div className="relative z-10 flex items-start justify-between px-3 pt-2.5 flex-shrink-0">
        <div className="flex flex-col items-start leading-none">
          <span style={{ fontFamily: 'Bebas Neue,sans-serif', fontSize: 40, lineHeight: .88, color: '#fff', textShadow: `0 0 22px ${theme.nameGlow}` }}>{player.overall}</span>
          <span className="mt-1 px-1.5 py-0.5 rounded-md uppercase" style={{ fontFamily: 'Rajdhani,sans-serif', fontSize: 10, fontWeight: 900, letterSpacing: '0.08em', color: theme.accent, background: theme.badgeBg, border: `1px solid ${theme.border}55` }}>{posLabel(player.position)}</span>
        </div>
        <div className="flex flex-col items-end gap-1.5 leading-none">
          <div className="flex items-center gap-1.5">
            {getFlagUrl(player.nation) && (
              <img 
                src={getFlagUrl(player.nation)!} 
                alt={player.nation} 
                className="w-5.5 h-3.5 object-cover rounded-[2px] border border-white/10 filter drop-shadow(0 1px 2px rgba(0,0,0,0.4))"
              />
            )}
            {CLUB_CRESTS[player.club] && (
              <img 
                src={CLUB_CRESTS[player.club]} 
                alt={player.club} 
                className="w-6 h-6 object-contain filter drop-shadow(0 2px 4px rgba(0,0,0,0.5))"
              />
            )}
          </div>
          <span className="text-[9px] font-bold tracking-wider px-1.5 py-0.5 rounded" style={{ fontFamily: 'Rajdhani,sans-serif', color: '#6a6a8a', background: 'rgba(0,0,0,.45)', border: '1px solid rgba(255,255,255,.05)' }}>{player.season}</span>
          <span className="text-[9px] font-extrabold tracking-wider uppercase truncate max-w-[90px] text-right" style={{ fontFamily: 'Rajdhani,sans-serif', color: theme.accent, opacity: .85 }}>{player.club}</span>
        </div>
      </div>

      {/* ── PHOTO ZONE — tall flex-1 for maximum photo size ── */}
      <div className="relative flex-1 flex items-end justify-center overflow-visible mx-1 mt-0 mb-0" style={{ minHeight: 0 }}>
        {/* Watermark */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none" style={{ opacity: .04 }}>
          <span style={{ fontFamily: 'Bebas Neue,sans-serif', fontSize: 60, color: '#fff', whiteSpace: 'nowrap', transform: 'rotate(-10deg)' }}>{player.shortName.toUpperCase()}</span>
        </div>

        {hasPhoto ? (
          <div style={{ width: '100%', height: '115%', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', overflow: 'hidden' }}>
            <PlayerPhoto playerId={player.id} fullName={player.fullName} size={180} lowRes={lite} />
          </div>
        ) : (
          <div className="flex items-center justify-center w-full h-full" style={{ fontSize: 56, opacity: .15 }}>⚽</div>
        )}
      </div>

      {/* ── NAME BANNER ── */}
      <div className="flex-shrink-0 mx-2 mb-1.5 py-1.5 rounded-xl text-center" style={{ background: 'linear-gradient(90deg,rgba(0,0,0,.85) 0%,rgba(0,0,0,.95) 50%,rgba(0,0,0,.85) 100%)', border: `1px solid ${theme.border}22`, boxShadow: `0 0 14px rgba(0,0,0,.5),inset 0 1px 0 rgba(255,255,255,.04)`, zIndex: 5 }}>
        <span style={{ fontFamily: 'Bebas Neue,sans-serif', fontSize: 20, letterSpacing: '0.08em', color: '#fff', textShadow: `0 0 16px ${theme.nameGlow}` }}>{player.shortName.toUpperCase()}</span>
      </div>

      {/* ── STATS ── */}
      <div className="flex-shrink-0 mx-2 mb-1.5 rounded-xl animate-fade-in" style={{ background: 'rgba(0,0,0,.35)', border: `1px solid ${theme.border}18`, display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', zIndex: 5 }}>
        {[{l:'RIT',v:player.pace},{l:'FIN',v:player.shooting},{l:'PAS',v:player.passing},{l:'DRI',v:player.dribbling},{l:'DEF',v:player.defending},{l:'FIS',v:player.physical}].map((s,i) => (
          <div key={i} className="flex flex-col items-center py-1.5">
            <span style={{ fontFamily: 'Rajdhani,sans-serif', fontSize: 8, fontWeight: 700, color: '#555577', letterSpacing: '0.05em' }}>{s.l}</span>
            <span style={{ fontFamily: 'Rajdhani,sans-serif', fontSize: 13, fontWeight: 900, color: theme.statColor, lineHeight: 1.1 }}>{s.v}</span>
          </div>
        ))}
      </div>

      {/* ── TRAITS FOOTER ── */}
      <div className="flex-shrink-0 flex justify-center items-center gap-1 pb-2.5 px-2 text-[7.5px]" style={{ zIndex: 5 }}>
        {player.traits.length > 0
          ? player.traits.slice(0,2).map((t,i) => (
              <span key={i} className="font-bold px-1.5 py-0.5 rounded-full truncate" style={{ fontFamily: 'Rajdhani,sans-serif', color: 'rgba(255,255,255,.5)', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)', maxWidth: 85 }} title={t}>⭐ {t}</span>
            ))
          : <span style={{ fontFamily: 'Rajdhani,sans-serif', fontSize: 8, fontWeight: 800, letterSpacing: '0.12em', color: theme.accent, opacity: .7 }}>{player.rarity.toUpperCase()}</span>
        }
      </div>

      {!lite && <style>{`@keyframes shimmer{0%,100%{opacity:.4}50%{opacity:1}}`}</style>}
    </CardWrapper>
  );
}
