import { useState, memo } from 'react';
import { motion } from 'framer-motion';
import { Player, getRarityColor } from '../../lib/gameData';
import { traitEffectLabel } from '../../lib/traits';

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
  stoichkov       : { id: 239541, ver: 23 }, // ✅ FIXED3 — ver25 era 404; ver23 carrega (rosto conferido)
  butragueno      : { id: 238419, ver: 24 },
  garrincha       : { id: 247553, ver: 22 }, // ✅ FIXED — correto Garrincha
  pele            : { id: 237067, ver: 24 }, // EA id 237067 (fut.gg) — fallback p/ placeholder se 404
  maradona        : { id: 237073, ver: 24 }, // EA id 237073 (fifplay) — fallback p/ placeholder se 404
  etoo            : { id: 9676,   ver: 24 }, // ✅ FIXED — correto Samuel Eto'o
  cantona         : { id: 167198, ver: 22 }, // ✅ FIXED — correto Eric Cantona
  kewell          : { id: 266801, ver: 23 }, // ✅ FIXED — correto Harry Kewell
  // rummenigge: id 246826 renderizava o jogador ERRADO e não há ID oficial confiável
  // no CDN do SoFIFA (não é ícone EA padrão) → sem mapeamento = placeholder limpo.
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
  paulinho        : { id: 187961, ver: 19 },
  // ── NEW PLAYERS (all CDN-verified: curl 200 image/png, correct person) ──────
  zidane          : { id: 1397,   ver: 26 }, // ✅ visual-verified (real Zidane face)
  ronaldinho      : { id: 28130,  ver: 26 }, // ✅ visual-verified
  figo            : { id: 5589,   ver: 26 }, // ✅ visual-verified
  totti           : { id: 1238,   ver: 26 }, // ✅ visual-verified
  delpiero        : { id: 1075,   ver: 24 }, // ✅ visual-verified
  shevchenko      : { id: 13128,  ver: 26 }, // ✅ visual-verified
  musiala         : { id: 256790, ver: 26 },
  mane            : { id: 208722, ver: 26 },
  coutinho        : { id: 189242, ver: 24 },
  firmino         : { id: 201942, ver: 25 },
  james           : { id: 198710, ver: 26 },
  mahrez          : { id: 204485, ver: 26 },
  mount           : { id: 233064, ver: 26 },
  sterling        : { id: 202652, ver: 26 },
  sancho          : { id: 233049, ver: 26 },
  verratti        : { id: 199556, ver: 24 },
  brozovic        : { id: 216352, ver: 26 },
  eriksen         : { id: 190460, ver: 26 },
  grealish        : { id: 206517, ver: 26 },
  caballero       : { id: 139062, ver: 23 },
  fabianski       : { id: 164835, ver: 26 },
  foster          : { id: 163155, ver: 24 },
  heurelho        : { id: 135451, ver: 20 },
  mertesacker     : { id: 53612,  ver: 18 },
  monreal         : { id: 177604, ver: 22 },
  zabaleta        : { id: 142784, ver: 20 },
  smalling        : { id: 189881, ver: 26 },
  evans           : { id: 169588, ver: 25 },
  young           : { id: 152908, ver: 26 },
  clyne           : { id: 190456, ver: 26 },
  mustafi         : { id: 192227, ver: 23 },
  rojo            : { id: 201862, ver: 26 },
  bailly          : { id: 225508, ver: 26 },
  jones           : { id: 194957, ver: 23 },
  chambers        : { id: 205989, ver: 26 },
  holding         : { id: 228295, ver: 26 },
  milner          : { id: 138412, ver: 26 },
  henderson       : { id: 183711, ver: 26 },
  matic           : { id: 191202, ver: 26 },
  fellaini        : { id: 176944, ver: 24 },
  gueye           : { id: 193474, ver: 26 },
  ramsey          : { id: 186561, ver: 25 },
  elneny          : { id: 211454, ver: 24 },
  walcott         : { id: 164859, ver: 23 },
  benteke         : { id: 184111, ver: 26 },
  defoe           : { id: 50542,  ver: 22 },
  sturridge       : { id: 171833, ver: 20 },
  origi           : { id: 213135, ver: 25 },
  long            : { id: 169216, ver: 23 },
  carroll         : { id: 182836, ver: 25 },
  giroud          : { id: 178509, ver: 26 }
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
  'Ucrânia':          'ua',
  'Senegal':          'sn',
  'Colômbia':         'co',
  'Argélia':          'dz',
  'Dinamarca':        'dk',
  'Polônia':          'pl',
  'Irlanda do Norte': 'gb-nir',
  'Egito':            'eg',
  'Irlanda':          'ie',
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
  'Manchester City': 'https://upload.wikimedia.org/wikipedia/en/e/eb/Manchester_City_FC_badge.svg',
  // ── Added crests (all CDN-verified: 200 image/svg+xml) ──────────────────────
  'Tottenham': 'https://upload.wikimedia.org/wikipedia/en/b/b4/Tottenham_Hotspur.svg',
  'Paris Saint-Germain': 'https://upload.wikimedia.org/wikipedia/en/a/a7/Paris_Saint-Germain_F.C..svg',
  'PSG': 'https://upload.wikimedia.org/wikipedia/en/a/a7/Paris_Saint-Germain_F.C..svg',
  'Borussia Dortmund': 'https://upload.wikimedia.org/wikipedia/commons/6/67/Borussia_Dortmund_logo.svg',
  'Bayer Leverkusen': 'https://upload.wikimedia.org/wikipedia/en/5/59/Bayer_04_Leverkusen_logo.svg',
  'Roma': 'https://upload.wikimedia.org/wikipedia/en/f/f7/AS_Roma_logo_%282017%29.svg',
  'Lazio': 'https://upload.wikimedia.org/wikipedia/en/c/ce/S.S._Lazio_badge.svg',
  'Fiorentina': 'https://upload.wikimedia.org/wikipedia/commons/7/79/ACF_Fiorentina.svg',
  'Atlético Madrid': 'https://upload.wikimedia.org/wikipedia/en/c/c1/Atletico_Madrid_logo.svg',
  'Sevilla': 'https://upload.wikimedia.org/wikipedia/en/3/3b/Sevilla_FC_logo.svg',
  'Valencia': 'https://upload.wikimedia.org/wikipedia/en/c/ce/Valenciacf.svg',
  'Porto': 'https://upload.wikimedia.org/wikipedia/en/f/f1/FC_Porto.svg',
  'Ajax': 'https://upload.wikimedia.org/wikipedia/en/7/79/Ajax_Amsterdam.svg',
  'Marseille': 'https://upload.wikimedia.org/wikipedia/commons/d/d8/Olympique_Marseille_logo.svg',
  'Galatasaray': 'https://upload.wikimedia.org/wikipedia/commons/2/20/Galatasaray_Sports_Club_Logo.svg',
  'Everton': 'https://upload.wikimedia.org/wikipedia/en/7/7c/Everton_FC_logo.svg',
  'Leicester City': 'https://upload.wikimedia.org/wikipedia/en/2/2d/Leicester_City_crest.svg',
  'West Ham': 'https://upload.wikimedia.org/wikipedia/en/c/c2/West_Ham_United_FC_logo.svg',
  'Crystal Palace': 'https://upload.wikimedia.org/wikipedia/en/a/a2/Crystal_Palace_FC_logo_%282022%29.svg',
  'Southampton': 'https://upload.wikimedia.org/wikipedia/en/c/c9/FC_Southampton.svg',
  'Watford': 'https://upload.wikimedia.org/wikipedia/en/e/e2/Watford.svg',
  'Sunderland': 'https://upload.wikimedia.org/wikipedia/en/7/77/Logo_Sunderland.svg',
  'Grêmio': 'https://upload.wikimedia.org/wikipedia/commons/0/08/Gremio_logo.svg',
  'Internacional': 'https://upload.wikimedia.org/wikipedia/commons/c/c5/Sport_Club_Internacional_logo.svg',
  'Atlético Mineiro': 'https://upload.wikimedia.org/wikipedia/commons/2/27/Clube_Atl%C3%A9tico_Mineiro_logo.svg',
  'Brasil': 'https://upload.wikimedia.org/wikipedia/commons/9/99/Brazilian_Football_Confederation_logo.svg'
};

export function getBasePlayerId(playerId: string): string {
  return Object.keys(SOFIFA_MAPPING).find(key => playerId === key || playerId.startsWith(key + '_')) || playerId.split('_')[0];
}

export function buildSofifaUrl(playerId: string, size: 360 | 120 = 360): string | null {
  const baseId = getBasePlayerId(playerId);
  const m = SOFIFA_MAPPING[baseId];
  if (!m) return null;
  const padded = String(m.id).padStart(6, '0');
  return `https://cdn.sofifa.net/players/${padded.slice(0,3)}/${padded.slice(3,6)}/${m.ver}_${size}.png`;
}

// Per-rarity visual identity. Each tier has a DISTINCT silhouette so they never read
// the same at a glance:
//  · Immortal  — radiant white-gold, hot halo at the crown, prismatic sunburst, brightest double glow.
//  · Legendary — molten amber, vertical light beams (not a sunburst), warmer/redder.
//  · Gold      — refined brushed gold, clean diagonal grain, no animated shine.
//  · Silver    — cool brushed platinum, fine vertical steel lines.
//  · Bronze    — warm copper, woven cross-hatch grain.
function getCardTheme(rarity: string): {
  bg: string; border: string; glow: string; accent: string; badgeBg: string;
  statColor: string; nameGlow: string; isPremium: boolean; label: string; icon: string;
  ribbon: string; pattern: string; patternOpacity: number; patternSize?: string;
} {
  switch (rarity) {
    case 'immortal':  return {
      bg: 'radial-gradient(135% 90% at 50% -6%,#FFF0B0 0%,#C99A18 8%,#6e520a 22%,#2c1f04 48%,#140d04 76%,#070401 100%)',
      border: '#FFE680', glow: '0 0 44px rgba(255,215,0,.62),0 0 14px rgba(255,250,220,.30),inset 0 0 28px rgba(255,215,0,.22)',
      accent: '#FFE07A', badgeBg: 'rgba(255,225,120,.16)', statColor: '#FFEFAE', nameGlow: 'rgba(255,231,150,.7)',
      isPremium: true, label: 'IMORTAL', icon: '👑',
      ribbon: 'linear-gradient(90deg,#7a5803,#FFD700 40%,#fffbe0 50%,#FFD700 60%,#7a5803)',
      pattern: 'repeating-conic-gradient(from 0deg at 50% 24%,rgba(255,235,150,.12) 0deg 1.4deg,rgba(255,235,150,0) 1.4deg 11deg)',
      patternOpacity: 1,
    };
    case 'legendary': return {
      bg: 'radial-gradient(130% 88% at 50% 0%,#FFB152 0%,#9c4708 12%,#4a1f06 34%,#220f06 62%,#100804 82%,#050302 100%)',
      border: '#FF9E3C', glow: '0 0 30px rgba(255,120,20,.48),inset 0 0 18px rgba(255,120,20,.16)',
      accent: '#FFAE54', badgeBg: 'rgba(255,150,60,.14)', statColor: '#FFCE92', nameGlow: 'rgba(255,150,40,.5)',
      isPremium: true, label: 'LENDÁRIO', icon: '★',
      ribbon: 'linear-gradient(90deg,#7a3d02,#FF8C00 42%,#ffe1ba 50%,#FF8C00 58%,#7a3d02)',
      pattern: 'repeating-linear-gradient(90deg,rgba(255,160,70,.07) 0 1px,transparent 1px 7px),linear-gradient(180deg,rgba(255,150,50,.05),transparent 55%)',
      patternOpacity: 1,
    };
    case 'gold':      return {
      bg: 'linear-gradient(158deg,#08070c 0%,#1a1408 44%,#2c2212 82%,#0a0710 100%)',
      border: '#D4B25A', glow: '0 0 18px rgba(201,168,76,.26),inset 0 0 11px rgba(201,168,76,.08)',
      accent: '#E0C268', badgeBg: 'rgba(201,168,76,.12)', statColor: '#F0DC98', nameGlow: 'rgba(201,168,76,.38)',
      isPremium: false, label: 'OURO', icon: '◆',
      ribbon: 'linear-gradient(90deg,#5e4d1c,#D4B25A 50%,#5e4d1c)',
      pattern: 'repeating-linear-gradient(122deg,rgba(212,178,90,.06) 0 1px,transparent 1px 8px),repeating-linear-gradient(122deg,rgba(212,178,90,.03) 0 1px,transparent 1px 3px)',
      patternOpacity: 1,
    };
    case 'silver':    return {
      bg: 'linear-gradient(158deg,#06060c 0%,#11131f 50%,#232734 86%,#070710 100%)',
      border: '#B7BCCC', glow: '0 0 12px rgba(183,188,204,.16),inset 0 0 10px rgba(183,188,204,.07)',
      accent: '#CCD2E2', badgeBg: 'rgba(183,188,204,.12)', statColor: '#E2E6F2', nameGlow: 'rgba(183,188,204,.34)',
      isPremium: false, label: 'PRATA', icon: '◇',
      ribbon: 'linear-gradient(90deg,#42454f,#B7BCCC 50%,#42454f)',
      pattern: 'repeating-linear-gradient(90deg,rgba(190,196,212,.06) 0 1px,transparent 1px 5px)',
      patternOpacity: 1,
    };
    default:          return {
      bg: 'linear-gradient(158deg,#0a0402 0%,#1c0f06 52%,#2c190d 88%,#0a0402 100%)',
      border: '#C77B3A', glow: '0 0 11px rgba(205,127,50,.18),inset 0 0 10px rgba(205,127,50,.07)',
      accent: '#DD9659', badgeBg: 'rgba(205,127,50,.12)', statColor: '#EAB084', nameGlow: 'rgba(205,127,50,.32)',
      isPremium: false, label: 'BRONZE', icon: '⬢',
      ribbon: 'linear-gradient(90deg,#5a3318,#C77B3A 50%,#5a3318)',
      pattern: 'repeating-linear-gradient(45deg,rgba(205,127,50,.06) 0 1px,transparent 1px 6px),repeating-linear-gradient(-45deg,rgba(205,127,50,.05) 0 1px,transparent 1px 6px)',
      patternOpacity: 1,
    };
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

// "EM ALTA" (in-form) overlay — turns ANY rarity into a jet-black special card with the
// tier's accent ablaze, so a boosted card reads instantly as special (à la Team-of-the-Week)
// while the accent colour still tells you the underlying tier.
function inFormOverlay(a: string) {
  return {
    bg: `radial-gradient(130% 92% at 50% -5%,${a}40 0%,${a}12 14%,#0b0b11 46%,#050507 100%)`,
    border: a,
    glow: `0 0 40px ${a}66,0 0 12px ${a}3a,inset 0 0 24px ${a}1f`,
    isPremium: true,
    nameGlow: `${a}99`,
    pattern: `repeating-conic-gradient(from 0deg at 50% 22%,${a}24 0deg 1.3deg,transparent 1.3deg 12deg)`,
    patternOpacity: 1,
  };
}

function PlayerCard({ player, selected = false, onClick, compact = false, lite = false, showChemistry = false, chemScore = 0 }: PlayerCardProps) {
  const baseColor = getRarityColor(player.rarity);
  const baseTheme = getCardTheme(player.rarity);
  const theme = player.inForm ? { ...baseTheme, ...inFormOverlay(baseTheme.accent) } : baseTheme;
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
        {!lite && <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: theme.pattern, backgroundSize: theme.patternSize ?? 'auto', opacity: (theme.patternOpacity ?? 1) * 0.7 }} />}
        {theme.isPremium && !lite && <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(120deg,transparent 30%,rgba(255,255,255,.07) 50%,transparent 70%)', animation: 'shimmer 2.8s infinite ease-in-out' }} />}

        {/* Top: OVR + POS + flag */}
        <div className="flex items-center justify-between px-1.5 pt-1.5 flex-shrink-0 z-10">
          <div className="flex flex-col leading-none">
            <span style={{ fontFamily: 'Bebas Neue,sans-serif', color: '#fff', fontSize: 17, lineHeight: 1 }}>{player.overall}</span>
            <span style={{ fontFamily: 'Rajdhani,sans-serif', color: theme.accent, fontSize: 8, fontWeight: 800, letterSpacing: '0.05em' }}>{posLabel(player.position)}</span>
            {player.inForm && <span style={{ color: theme.accent, fontSize: 9, lineHeight: 1, marginTop: 1, textShadow: `0 0 5px ${theme.accent}` }}>⚡</span>}
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
      {/* Per-rarity texture pattern */}
      <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: theme.pattern, backgroundSize: theme.patternSize ?? 'auto', opacity: theme.patternOpacity ?? 1 }} />

      {/* Rarity glow blob */}
      <div className="absolute pointer-events-none" style={{ top: -40, left: -40, width: 150, height: 150, borderRadius: '50%', background: baseColor, filter: 'blur(55px)', opacity: theme.isPremium ? .26 : .16 }} />

      {/* Top sheen edge */}
      <div className="absolute inset-x-0 top-0 h-px pointer-events-none" style={{ background: `linear-gradient(90deg,transparent,${theme.accent}88,transparent)` }} />

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
        {hasPhoto ? (
          <div style={{ width: '100%', height: '115%', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', overflow: 'hidden' }}>
            <PlayerPhoto playerId={player.id} fullName={player.fullName} size={180} lowRes={lite} />
          </div>
        ) : (
          <div className="flex items-center justify-center w-full h-full" style={{ fontSize: 56, opacity: .15 }}>⚽</div>
        )}
      </div>

      {/* ── RARITY RIBBON ── */}
      <div className="flex-shrink-0 mx-2 flex justify-center" style={{ zIndex: 6, marginBottom: -6 }}>
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full" style={{ background: theme.ribbon, boxShadow: `0 2px 8px rgba(0,0,0,.5),inset 0 1px 0 rgba(255,255,255,.25)`, border: '1px solid rgba(0,0,0,.35)' }}>
          <span style={{ fontSize: 8, lineHeight: 1, color: theme.isPremium ? '#3a2600' : '#000', filter: theme.isPremium ? 'none' : 'opacity(.7)' }}>{theme.icon}</span>
          <span style={{ fontFamily: 'Rajdhani,sans-serif', fontSize: 8, fontWeight: 900, letterSpacing: '0.16em', color: theme.isPremium ? '#1f1500' : '#0a0a0a' }}>{theme.label}</span>
        </span>
      </div>

      {/* ── IN-FORM BADGE (special draft card) ── */}
      {player.inForm && (
        <div className="flex-shrink-0 mx-2 flex justify-center" style={{ zIndex: 6, marginTop: 4 }}>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full" style={{ background: `linear-gradient(90deg,${theme.border},${theme.accent},${theme.border})`, boxShadow: `0 0 12px ${theme.accent}99`, border: '1px solid rgba(0,0,0,.4)' }}
            title={`Carta EM ALTA: +${player.baseOverall !== undefined ? player.overall - player.baseOverall : 3} geral e atributos reforçados`}>
            <span style={{ fontFamily: 'Rajdhani,sans-serif', fontSize: 8, fontWeight: 900, letterSpacing: '0.14em', color: '#1a1205' }}>⚡ EM ALTA</span>
          </span>
        </div>
      )}

      {/* ── NAME BANNER ── */}
      <div className="flex-shrink-0 mx-2 mb-1.5 pt-2.5 pb-1.5 rounded-xl text-center" style={{ background: 'linear-gradient(90deg,rgba(0,0,0,.85) 0%,rgba(0,0,0,.95) 50%,rgba(0,0,0,.85) 100%)', border: `1px solid ${theme.border}22`, boxShadow: `0 0 14px rgba(0,0,0,.5),inset 0 1px 0 rgba(255,255,255,.04)`, zIndex: 5 }}>
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
          ? (player.rolledTrait
              ? [player.rolledTrait, ...player.traits.filter(t => t !== player.rolledTrait)]
              : player.traits
            ).slice(0,2).map((t,i) => {
              const eff = traitEffectLabel(t);
              const isRolled = t === player.rolledTrait;
              return (
              <span key={i} className="font-bold px-1.5 py-0.5 rounded-full truncate" style={{ fontFamily: 'Rajdhani,sans-serif', color: isRolled ? '#E8C84A' : 'rgba(255,255,255,.5)', background: isRolled ? 'rgba(201,168,76,.12)' : 'rgba(255,255,255,.04)', border: `1px solid ${isRolled ? 'rgba(201,168,76,.5)' : 'rgba(255,255,255,.08)'}`, maxWidth: 85 }} title={`${isRolled ? 'Trait extra! ' : ''}${t}${eff ? ` — ${eff}` : ''}`}>{isRolled ? '✨' : '⭐'} {t}</span>
            ); })
          : <span style={{ fontFamily: 'Rajdhani,sans-serif', fontSize: 8, fontWeight: 800, letterSpacing: '0.12em', color: theme.accent, opacity: .7 }}>{player.rarity.toUpperCase()}</span>
        }
      </div>

      {!lite && <style>{`@keyframes shimmer{0%,100%{opacity:.4}50%{opacity:1}}`}</style>}
    </CardWrapper>
  );
}

// Memoized: cards re-render only when their own props change, not whenever a parent
// (e.g. the league hub) re-renders for unrelated reasons. Keeps grids of cards smooth.
export default memo(PlayerCard);
