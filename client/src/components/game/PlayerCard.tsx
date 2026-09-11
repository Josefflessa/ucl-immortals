import { useState, memo } from 'react';
import { motion } from 'framer-motion';
import { Player, POS_PT } from '../../lib/gameData';
import { isEvolved } from '../../lib/gameEngine';
import { FRAME_URL, frameMask, ringGradient } from './CardShield';

interface PlayerCardProps {
  player: Player;
  selected?: boolean;
  onClick?: () => void;
  compact?: boolean;
  lite?: boolean;
  showChemistry?: boolean;
  chemScore?: number;
  scale?: number; // encolhe o card FULL e sua área ocupada (ex.: caber 2 por linha no mobile)
}

// SoFIFA mapping — updated to latest available FIFA version per player for best photo quality
// ver = FIFA edition year (e.g. 25 = FIFA 25, 24 = FIFA 24). Higher = better face scan quality.
export const SOFIFA_MAPPING: Record<string, { id: number; ver: number }> = {
  // ── IMMORTALS ──────────────────────────────────────────────────────────────
  messi: { id: 158023, ver: 16 }, // FIFA 16 — Messi no auge (Barça), combina com a carta
  cristiano: { id: 20801, ver: 15 }, // FIFA 15 — CR7 no auge (Real Madrid)
  // ── LEGENDARY ──────────────────────────────────────────────────────────────
  xavi: { id: 10535, ver: 23 }, // FIFA 23 — recent FUT Heroes version
  iniesta: { id: 41, ver: 22 }, // ✅ CDN-verified (185427=Ørjan Nyland!) FIXED
  modric: { id: 177003, ver: 25 }, // FIFA 25 — still active
  ramos: { id: 155862, ver: 24 }, // FIFA 24
  pirlo: { id: 7763, ver: 25 }, // ✅ CDN-verified
  kaka: { id: 138449, ver: 23 }, // FIFA 23 — FUT Icon
  maldini: { id: 238439, ver: 25 }, // ✅ CDN-verified (was Nainggolan 178518!) FIXED
  nesta: { id: 1088, ver: 24 }, // ✅ CDN-verified
  buffon: { id: 1179, ver: 23 }, // ✅ CDN-verified (ver24 missing, ver23 works)
  neuer: { id: 167495, ver: 25 }, // FIFA 25 — still active
  drogba: { id: 31432, ver: 24 }, // ✅ CDN-verified — was 41236 (=Ibrahimovic!) FIXED
  henry: { id: 1625, ver: 24 }, // FIFA 24 — FUT Icon
  benzema: { id: 165153, ver: 24 }, // FIFA 24
  casillas: { id: 5479, ver: 25 }, // ✅ CDN-verified (was van der Sar 51539!) FIXED
  // ── GOLD ───────────────────────────────────────────────────────────────────
  alonso: { id: 45197, ver: 25 }, // ✅ CDN-verified (was Peter Crouch 51257!) FIXED
  busquets: { id: 189511, ver: 24 }, // FIFA 24
  alves: { id: 146530, ver: 23 }, // ✅ CDN-verified (was Jesús Navas!) FIXED
  marcelo: { id: 176676, ver: 22 }, // ✅ CDN-verified (ver23 missing, ver22 works)
  lahm: { id: 121939, ver: 24 }, // FIFA 24 — FUT Icon
  ribery: { id: 156616, ver: 23 }, // FIFA 23 — FUT Heroes
  robben: { id: 9014, ver: 21 }, // ✅ CDN-verified (ver21 only) FIXED
  lampard: { id: 242930, ver: 22 }, // ✅ FIXED — correto Icon Lampard
  gerrard: { id: 13743, ver: 25 }, // ✅ CDN-verified (was Matt Ritchie!) FIXED
  terry: { id: 13732, ver: 18 }, // ✅ CDN-verified (ver18 only) FIXED
  cech: { id: 48940, ver: 24 }, // FIFA 24 — FUT Icon
  sneijder: { id: 139869, ver: 18 }, // ✅ CDN-verified (was Fernandinho 135507!) FIXED
  milito: { id: 262271, ver: 25 }, // ✅ FIXED — correto Diego Milito
  zanetti: { id: 1041, ver: 24 }, // ✅ CDN-verified — was 1168 FIXED
  schweinsteiger: { id: 121944, ver: 24 }, // FIFA 24 — FUT Icon
  neymar: { id: 190871, ver: 16 }, // FIFA 16 — Neymar no auge (Barça, MSN)
  suarez: { id: 176580, ver: 24 }, // FIFA 24
  puyol: { id: 13038, ver: 24 }, // ✅ CDN-verified — was 41 FIXED
  chiellini: { id: 138956, ver: 24 }, // ✅ CDN-verified (was Tony McMahon!) FIXED
  rooney: { id: 54050, ver: 24 }, // FIFA 24 — FUT Icon
  giggs: { id: 241, ver: 22 }, // ✅ CDN-verified (ver22 only)
  scholes: { id: 246, ver: 24 }, // ✅ CDN-verified — was 244 FIXED
  vidic: { id: 140601, ver: 25 }, // ✅ FIXED — correto Nemanja Vidić
  kompany: { id: 139720, ver: 20 }, // ✅ CDN-verified (ver20 only)
  silva_david: { id: 168542, ver: 23 }, // ✅ CDN-verified (ver24 missing, ver23 works)
  // ── SILVER ─────────────────────────────────────────────────────────────────
  valdes: { id: 106573, ver: 17 }, // FIFA Index — correto Víctor Valdés
  fabregas: { id: 162895, ver: 23 }, // ✅ CDN-verified
  pedro: { id: 189509, ver: 23 }, // ✅ CDN-verified
  evra: { id: 52091, ver: 18 }, // ✅ FIXED — correto Patrice Evra
  maicon: { id: 135455, ver: 25 }, // ✅ CDN-verified FIXED
  villa: { id: 113422, ver: 20 }, // ✅ CDN-verified (ver20 only)
  torres: { id: 49369, ver: 22 }, // ✅ CDN-verified (ver22 only) — was ver24 FIXED
  aguero: { id: 153079, ver: 22 }, // ✅ CDN-verified (ver22 only)
  bale: { id: 173731, ver: 23 }, // ✅ CDN-verified
  seedorf: { id: 1256, ver: 24 }, // ✅ CDN-verified — was 139056 FIXED
  pires: { id: 1605, ver: 25 }, // ✅ CDN-verified (was 184035) FIXED
  bergkamp: { id: 238388, ver: 24 }, // ✅ CDN-verified FIXED
  cannavaro: { id: 1183, ver: 24 }, // ✅ CDN-verified — was 186398 FIXED
  tevez: { id: 143001, ver: 21 }, // ✅ CDN-verified (ver21 only),
  vandersar: { id: 51539, ver: 25 },
  courtois: { id: 192119, ver: 25 },
  terstegen: { id: 192448, ver: 25 },
  alisson: { id: 212831, ver: 25 },
  ederson: { id: 210257, ver: 25 },
  donnarumma: { id: 230621, ver: 25 },
  oblak: { id: 200389, ver: 25 },
  szczesny: { id: 186153, ver: 25 },
  sommer: { id: 177683, ver: 25 }, // ✅ FIXED — correto Yann Sommer
  edouard_mendy: { id: 234642, ver: 25 }, // ✅ FIXED2 — correto Édouard Mendy
  roberto_carlos: { id: 238430, ver: 25 }, // ✅ FIXED — correto Roberto Carlos
  vandijk: { id: 203376, ver: 25 },
  rubendias: { id: 239818, ver: 25 }, // ✅ FIXED — correto Rúben Dias
  marquinhos: { id: 207865, ver: 25 },
  araujo: { id: 253163, ver: 25 }, // ✅ FIXED — correto Ronald Araújo
  militao: { id: 240130, ver: 25 }, // ✅ FIXED — correto Éder Militão
  rudiger: { id: 205452, ver: 25 },
  thiago_silva: { id: 164240, ver: 24 },
  david_luiz: { id: 179944, ver: 21 },
  christensen: { id: 213661, ver: 25 },
  blanc: { id: 238443, ver: 25 }, // ✅ FIXED — correto Laurent Blanc
  carvalho: { id: 3622, ver: 25 }, // ✅ FIXED — correto Ricardo Carvalho
  marquez: { id: 26709, ver: 25 }, // ✅ FIXED — correto Rafael Márquez
  koeman: { id: 167680, ver: 25 }, // ✅ FIXED — correto Ronald Koeman
  cole_ashley: { id: 34079, ver: 25 }, // ✅ FIXED — correto Ashley Cole
  theo_hernandez: { id: 232656, ver: 25 },
  grimaldo: { id: 210035, ver: 25 }, // ✅ FIXED2 — correto Alejandro Grimaldo
  riise: { id: 274967, ver: 25 }, // ✅ FIXED — correto John Arne Riise
  robertson: { id: 216267, ver: 25 },
  hakimi: { id: 235212, ver: 25 },
  walker: { id: 188377, ver: 25 },
  carvajal: { id: 204963, ver: 25 },
  frimpong: { id: 253149, ver: 25 }, // ✅ FIXED — correto Jeremie Frimpong
  reece_james: { id: 211522, ver: 25 }, // ✅ FIXED — correto Reece James
  azpilicueta: { id: 184432, ver: 25 },
  gullit: { id: 214100, ver: 24 },
  beckham: { id: 250, ver: 25 }, // ✅ FIXED — correto David Beckham
  rijkaard: { id: 214098, ver: 25 }, // ✅ FIXED — correto Frank Rijkaard
  matthaus: { id: 238435, ver: 21 }, // ✅ FIXED — correto Lothar Matthäus
  dalglish: { id: 247699, ver: 22 }, // ✅ FIXED — correto Kenny Dalglish
  hagi: { id: 166124, ver: 22 }, // ✅ FIXED2 — correto Gheorghe Hagi
  socrates: { id: 190046, ver: 25 }, // ✅ FIXED — correto Sócrates
  veron: { id: 7518, ver: 20 }, // ✅ FIXED — correto Verón
  zola: { id: 239110, ver: 24 }, // ✅ FIXED — correto Gianfranco Zola
  ruicosta: { id: 1025, ver: 25 }, // ✅ FIXED — correto Rui Costa
  abedipele: { id: 167425, ver: 24 }, // ✅ FIXED — correto Abedi Pelé
  rodri: { id: 231866, ver: 25 },
  gundogan: { id: 186942, ver: 25 },
  kroos: { id: 182521, ver: 24 },
  kimmich: { id: 212622, ver: 25 }, // ✅ FIXED — correto Joshua Kimmich
  goretzka: { id: 209658, ver: 25 },
  bruno_fernandes: { id: 212198, ver: 25 },
  odegaard: { id: 222665, ver: 25 },
  barella: { id: 224232, ver: 25 }, // ✅ FIXED — correto Nicolò Barella
  calhanoglu: { id: 208128, ver: 25 }, // ✅ FIXED — correto Hakan Çalhanoğlu
  dejong: { id: 228702, ver: 25 },
  pedri: { id: 251854, ver: 25 }, // ✅ FIXED — correto Pedri
  casemiro: { id: 200145, ver: 25 },
  wirtz: { id: 256630, ver: 25 },
  xhaka: { id: 199503, ver: 25 }, // ✅ FIXED — correto Granit Xhaka
  kante: { id: 215914, ver: 25 },
  jorginho: { id: 205498, ver: 25 }, // ✅ FIXED — correto Jorginho
  kovacic: { id: 207410, ver: 25 },
  ronaldo_nazario: { id: 37576, ver: 25 },
  ibrahimovic: { id: 41236, ver: 23 },
  rivaldo: { id: 242950, ver: 24 }, // ✅ FIXED — correto Rivaldo (ver24)
  cruyff: { id: 190045, ver: 25 }, // ✅ FIXED2 — correto Johan Cruyff
  nistelrooy: { id: 10264, ver: 25 }, // ✅ FIXED — correto Ruud van Nistelrooy
  owen: { id: 5419, ver: 22 }, // ✅ FIXED2 — correto Michael Owen
  stoichkov: { id: 239541, ver: 23 }, // ✅ FIXED3 — ver25 era 404; ver23 carrega (rosto conferido)
  butragueno: { id: 238419, ver: 24 },
  garrincha: { id: 247553, ver: 22 }, // ✅ FIXED — correto Garrincha
  pele: { id: 237067, ver: 24 }, // EA id 237067 (fut.gg) — fallback p/ placeholder se 404
  maradona: { id: 190042, ver: 22 }, // ✅ FIXED — was 237073 (404); 190042 = Maradona (CDN-verified, FIFA 22)
  etoo: { id: 9676, ver: 24 }, // ✅ FIXED — correto Samuel Eto'o
  cantona: { id: 167198, ver: 22 }, // ✅ FIXED — correto Eric Cantona
  kewell: { id: 266801, ver: 23 }, // ✅ FIXED — correto Harry Kewell
  voller: { id: 166676, ver: 25 }, // ✅ FIXED — correto Rudi Völler
  papin: { id: 167134, ver: 25 }, // ✅ FIXED — correto Jean-Pierre Papin
  haaland: { id: 239085, ver: 25 },
  mbappe: { id: 231747, ver: 25 },
  vinicius: { id: 238794, ver: 25 },
  bellingham: { id: 252371, ver: 25 },
  salah: { id: 209331, ver: 25 },
  kane: { id: 202126, ver: 25 },
  lewandowski: { id: 188545, ver: 25 },
  griezmann: { id: 194765, ver: 25 },
  bernardo_silva: { id: 218667, ver: 25 },
  saka: { id: 246669, ver: 24 }, // ✅ FIXED — correto Bukayo Saka
  rice: { id: 234378, ver: 25 },
  martinelli: { id: 251566, ver: 25 },
  gabriel: { id: 232580, ver: 25 },
  gabriel_jesus: { id: 230666, ver: 25 },
  lautaro: { id: 231478, ver: 25 },
  leao: { id: 241721, ver: 25 },
  dimaria: { id: 183898, ver: 25 },
  son: { id: 200104, ver: 25 },
  foden: { id: 237692, ver: 21 }, // ✅ FIXED — correto Phil Foden
  dembele: { id: 231443, ver: 25 },
  alexis_sanchez: { id: 184941, ver: 25 },
  lukaku: { id: 192505, ver: 25 },
  hazard: { id: 183277, ver: 25 },
  trent: { id: 231281, ver: 25 },
  cavani: { id: 179813, ver: 25 },
  willian: { id: 180403, ver: 25 },
  diego_costa: { id: 179844, ver: 23 },
  // ── BRASILEIRÃO / HISTÓRICOS ───────────────────────────────────────────────
  filipe_luis: { id: 164169, ver: 21 }, // ✅ FIXED — Filipe Luís
  guerrero: { id: 183666, ver: 22 },
  felipe_melo: { id: 135475, ver: 18 }, // ✅ FIXED — Felipe Melo
  pedro_g: { id: 244589, ver: 20 },
  ganso: { id: 187688, ver: 17 },
  lucas_moura: { id: 200949, ver: 23 },
  fernandinho: { id: 135507, ver: 22 },
  tardelli: { id: 138456, ver: 20 }, // ✅ FIXED — Diego Tardelli
  alexandre_pato: { id: 180175, ver: 23 }, // ✅ FIXED — Alexandre Pato
  luiz_adriano: { id: 180826, ver: 16 }, // ✅ FIXED — was 176600 (pessoa errada); 180826 = Luiz Adriano (Milan, FIFA 16)
  bernard: { id: 205525, ver: 20 },
  diego_alves: { id: 165580, ver: 22 }, // ✅ FIXED — Diego Alves
  miranda: { id: 168609, ver: 19 }, // ✅ FIXED — Miranda
  julio_cesar: { id: 48717, ver: 18 }, // ✅ FIXED — Júlio César
  ramires: { id: 186146, ver: 20 },
  oscar: { id: 188152, ver: 17 },
  giuliano: { id: 198033, ver: 18 },
  taison: { id: 188803, ver: 21 }, // ✅ FIXED — Taison
  luiz_gustavo: { id: 185103, ver: 20 },
  rafinha: { id: 168607, ver: 19 },
  felipe_anderson: { id: 210008, ver: 20 },
  lucas_leiva: { id: 176266, ver: 20 },
  paulinho: { id: 187961, ver: 19 },
  // ── NEW PLAYERS (all CDN-verified: curl 200 image/png, correct person) ──────
  zidane: { id: 1397, ver: 26 }, // ✅ visual-verified (real Zidane face)
  ronaldinho: { id: 28130, ver: 26 }, // ✅ visual-verified
  figo: { id: 5589, ver: 26 }, // ✅ visual-verified
  totti: { id: 1238, ver: 26 }, // ✅ visual-verified
  delpiero: { id: 1075, ver: 24 }, // ✅ visual-verified
  shevchenko: { id: 13128, ver: 26 }, // ✅ visual-verified
  musiala: { id: 256790, ver: 26 },
  mane: { id: 208722, ver: 26 },
  coutinho: { id: 189242, ver: 24 },
  firmino: { id: 201942, ver: 25 },
  james: { id: 198710, ver: 26 },
  mahrez: { id: 204485, ver: 26 },
  mount: { id: 233064, ver: 26 },
  sterling: { id: 202652, ver: 26 },
  sancho: { id: 233049, ver: 26 },
  verratti: { id: 199556, ver: 24 },
  brozovic: { id: 216352, ver: 26 },
  eriksen: { id: 190460, ver: 26 },
  grealish: { id: 206517, ver: 26 },
  caballero: { id: 139062, ver: 23 },
  fabianski: { id: 164835, ver: 26 },
  foster: { id: 163155, ver: 24 },
  heurelho: { id: 135451, ver: 20 },
  mertesacker: { id: 53612, ver: 18 },
  monreal: { id: 177604, ver: 22 },
  zabaleta: { id: 142784, ver: 20 },
  smalling: { id: 189881, ver: 26 },
  evans: { id: 169588, ver: 25 },
  young: { id: 152908, ver: 26 },
  clyne: { id: 190456, ver: 26 },
  mustafi: { id: 192227, ver: 23 },
  rojo: { id: 201862, ver: 26 },
  bailly: { id: 225508, ver: 26 },
  jones: { id: 194957, ver: 23 },
  chambers: { id: 205989, ver: 26 },
  holding: { id: 228295, ver: 26 },
  milner: { id: 138412, ver: 26 },
  henderson: { id: 183711, ver: 26 },
  matic: { id: 191202, ver: 26 },
  fellaini: { id: 176944, ver: 24 },
  gueye: { id: 193474, ver: 26 },
  ramsey: { id: 186561, ver: 25 },
  elneny: { id: 211454, ver: 24 },
  walcott: { id: 164859, ver: 23 },
  benteke: { id: 184111, ver: 26 },
  defoe: { id: 50542, ver: 22 },
  sturridge: { id: 171833, ver: 20 },
  origi: { id: 213135, ver: 25 },
  long: { id: 169216, ver: 23 },
  carroll: { id: 182836, ver: 25 },
  giroud: { id: 178509, ver: 26 },
  // ── EXPANSÃO LOTE 1 — todas as fotos verificadas via CDN (HTTP 200 no id oficial do jogador).
  kahn: { id: 488, ver: 8 },  // FIFA 08 (EA nunca o lançou como Icon)
  cafu: { id: 5003, ver: 25 },
  stam: { id: 5740, ver: 25 },
  thuram: { id: 1615, ver: 25 },
  lucio: { id: 107715, ver: 14 },
  keylor_navas: { id: 193041, ver: 24 },
  lloris: { id: 167948, ver: 25 },
  jordi_alba: { id: 189332, ver: 23 },
  de_gea: { id: 193080, ver: 25 },
  e_martinez: { id: 202811, ver: 25 },
  pique: { id: 152729, ver: 23 },
  hummels: { id: 178603, ver: 25 },
  // ── +134 new players (sofifa-verified) ──
  l_insigne: { id: 198219, ver: 25 },
  p_aubameyang: { id: 188567, ver: 25 },
  c_immobile: { id: 192387, ver: 25 },
  d_mertens: { id: 175943, ver: 25 },
  alex_sandro: { id: 191043, ver: 24 },
  douglas_costa: { id: 190483, ver: 21 },
  m_reus: { id: 188350, ver: 25 },
  m_benatia: { id: 177509, ver: 22 },
  s_milinkovic_savic: { id: 223848, ver: 25 },
  d_alaba: { id: 197445, ver: 25 },
  koke: { id: 193747, ver: 25 },
  y_brahimi: { id: 184267, ver: 19 },
  a_vidal: { id: 181872, ver: 25 },
  i_perisic: { id: 181458, ver: 25 },
  e_dzeko: { id: 180930, ver: 25 },
  b_matuidi: { id: 170890, ver: 25 },
  alex_telles: { id: 212462, ver: 25 },
  william_carvalho: { id: 207566, ver: 25 },
  f_thauvin: { id: 204970, ver: 25 },
  jose_callejon: { id: 185020, ver: 24 },
  m_mandzukic: { id: 181783, ver: 21 },
  sergio_asenjo: { id: 178750, ver: 24 },
  e_banega: { id: 178562, ver: 25 },
  jonas: { id: 176769, ver: 19 },
  k_schmeichel: { id: 163587, ver: 25 },
  quaresma: { id: 20775, ver: 22 },
  t_lemar: { id: 213565, ver: 25 },
  k_coman: { id: 213345, ver: 25 },
  q_promes: { id: 208808, ver: 22 },
  y_carrasco: { id: 208418, ver: 25 },
  j_pickford: { id: 204935, ver: 25 },
  danilo_pereira: { id: 200888, ver: 25 },
  f_acerbi: { id: 199845, ver: 25 },
  rodrigo: { id: 198329, ver: 25 },
  neto: { id: 194404, ver: 25 },
  h_mkhitaryan: { id: 192883, ver: 25 },
  marcos_alonso: { id: 192638, ver: 25 },
  d_subasic: { id: 192593, ver: 23 },
  b_dost: { id: 189068, ver: 24 },
  juan_mata: { id: 178088, ver: 25 },
  rui_patricio: { id: 178005, ver: 25 },
  r_jarstein: { id: 104389, ver: 23 },
  gelson_martins: { id: 227055, ver: 25 },
  goncalo_guedes: { id: 224411, ver: 25 },
  pau_lopez: { id: 221087, ver: 25 },
  l_hernandez: { id: 220814, ver: 25 },
  f_bernardeschi: { id: 212404, ver: 25 },
  j_brandt: { id: 212194, ver: 25 },
  samu_castillejo: { id: 210617, ver: 25 },
  t_partey: { id: 209989, ver: 25 },
  j_vardy: { id: 208830, ver: 25 },
  e_forsberg: { id: 208448, ver: 25 },
  e_visca: { id: 205678, ver: 25 },
  a_florenzi: { id: 203551, ver: 25 },
  t_meunier: { id: 202371, ver: 25 },
  s_sane: { id: 201956, ver: 22 },
  luis_alberto: { id: 198706, ver: 24 },
  willian_jose: { id: 195093, ver: 24 },
  j_pastore: { id: 191180, ver: 23 },
  r_burki: { id: 189117, ver: 25 },
  s_nzonzi: { id: 187936, ver: 24 },
  marlos: { id: 187754, ver: 22 },
  g_sigur_sson: { id: 184484, ver: 25 },
  s_giovinco: { id: 184431, ver: 22 },
  l_fejsa: { id: 183376, ver: 22 },
  a_guardado: { id: 171897, ver: 24 },
  s_sirigu: { id: 168435, ver: 25 },
  e_viviano: { id: 168354, ver: 24 },
  m_politano: { id: 216409, ver: 25 },
  a_correa: { id: 214997, ver: 25 },
  t_strakosha: { id: 212151, ver: 25 },
  e_hysaj: { id: 210864, ver: 25 },
  ricardo_pereira: { id: 210243, ver: 25 },
  r_guerreiro: { id: 209889, ver: 25 },
  b_davies: { id: 205923, ver: 25 },
  a_milik: { id: 205175, ver: 25 },
  m_sabitzer: { id: 204923, ver: 25 },
  b_mendy: { id: 204884, ver: 25 },
  s_vrsaljko: { id: 203890, ver: 23 },
  k_bellarabi: { id: 202857, ver: 23 },
  f_ghoulam: { id: 201454, ver: 25 },
  j_ilicic: { id: 200647, ver: 23 },
  x_shaqiri: { id: 193348, ver: 25 },
  j_corona: { id: 193165, ver: 24 },
  e_salvio: { id: 190972, ver: 25 },
  s_kagawa: { id: 189358, ver: 23 },
  m_lanzini: { id: 188988, ver: 25 },
  l_stindl: { id: 187072, ver: 24 },
  o_toprak: { id: 185239, ver: 24 },
  d_perotti: { id: 183900, ver: 22 },
  f_muslera: { id: 182494, ver: 25 },
  m_valbuena: { id: 177326, ver: 22 },
  k_boateng: { id: 173909, ver: 23 },
  l_piszczek: { id: 173771, ver: 21 },
  d_wass: { id: 172522, ver: 25 },
  e_lamela: { id: 170368, ver: 25 },
  d_rose: { id: 169595, ver: 23 },
  c_vela: { id: 169416, ver: 25 },
  a_valencia: { id: 167905, ver: 21 },
  manuel_fernandes: { id: 157960, ver: 22 },
  h_herrera: { id: 156519, ver: 25 },
  raffael: { id: 144622, ver: 20 },
  m_gomez: { id: 239207, ver: 25 },
  h_aouar: { id: 234906, ver: 25 },
  m_almiron: { id: 230977, ver: 25 },
  a_onana: { id: 226753, ver: 25 },
  m_acuna: { id: 224334, ver: 25 },
  m_vecino: { id: 219985, ver: 25 },
  k_balde: { id: 215785, ver: 25 },
  g_rulli: { id: 215316, ver: 25 },
  m_ginter: { id: 207862, ver: 25 },
  l_shaw: { id: 205988, ver: 25 },
  z_feddal: { id: 205705, ver: 23 },
  t_inui: { id: 205114, ver: 22 },
  m_batshuayi: { id: 204529, ver: 25 },
  t_vaclik: { id: 204120, ver: 24 },
  p_kaderabek: { id: 203605, ver: 25 },
  j_vestergaard: { id: 202849, ver: 25 },
  m_badelj: { id: 201144, ver: 25 },
  ismaily: { id: 201119, ver: 25 },
  n_schulz: { id: 200536, ver: 23 },
  l_muriel: { id: 199110, ver: 25 },
  v_aboubakar: { id: 199069, ver: 25 },
  s_aurier: { id: 197853, ver: 24 },
  j_matip: { id: 197061, ver: 24 },
  a_yarmolenko: { id: 194794, ver: 25 },
  r_rodriguez: { id: 193352, ver: 25 },
  d_blind: { id: 190815, ver: 25 },
  j_zoet: { id: 190778, ver: 25 },
  a_ljajic: { id: 190544, ver: 24 },
  l_de_jong: { id: 189805, ver: 25 },
  n_nkoulou: { id: 188829, ver: 24 },
  r_boudebouz: { id: 188388, ver: 24 },
  c_stuani: { id: 186537, ver: 25 },
  rogerio_ceni: { id: 21570, ver: 15 }, // ✅ CDN-verified — Ceni era São Paulo (EA nunca fez ícone dele)
  zico: { id: 166691, ver: 24 }, // ✅ CDN-verified — Zico ícone EA (retrato sépia de lenda)
  // ── NOVAS ADIÇÕES — IDs-base conferidos em bases FIFA/FC ──────────────────
  best: { id: 226764, ver: 26 }, // George Best Icon
  charlton: { id: 230025, ver: 26 }, // Bobby Charlton Icon
  debruyne: { id: 192985, ver: 23 }, // FIFA 23 — auge recente (91 OVR)
  dybala: { id: 211110, ver: 23 }, // FIFA 23 — referência de carreira (86 OVR)
  yashin: { id: 238380, ver: 26 }, // Lev Yashin Icon
};

const NATION_CODES: Record<string, string> = {
  'Argentina': 'ar',
  'Portugal': 'pt',
  'Espanha': 'es',
  'Croácia': 'hr',
  'Itália': 'it',
  'Brasil': 'br',
  'Alemanha': 'de',
  'Costa do Marfim': 'ci',
  'França': 'fr',
  'Holanda': 'nl',
  'Inglaterra': 'gb-eng',
  'República Tcheca': 'cz',
  'País de Gales': 'gb-wls',
  'Sérvia': 'rs',
  'Bélgica': 'be',
  'Uruguai': 'uy',
  'Ucrânia': 'ua',
  'Senegal': 'sn',
  'Colômbia': 'co',
  'Argélia': 'dz',
  'Dinamarca': 'dk',
  'Polônia': 'pl',
  'Irlanda do Norte': 'gb-nir',
  'Egito': 'eg',
  'Irlanda': 'ie',
  // A seleção soviética deixou de existir; a bandeira russa é a referência
  // visual disponível para representar seus jogadores históricos.
  'União Soviética': 'ru',
};

// PT-BR position abbreviations (single source of truth lives in gameData/POS_PT)
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
  'Juventus': 'https://upload.wikimedia.org/wikipedia/commons/e/ed/Juventus_FC_-_logo_black_%28Italy%2C_2020%29.svg',
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
  // Exact match always wins — otherwise 'gabriel_jesus' would match the 'gabriel' prefix first
  // (key order) and steal Gabriel Magalhães' photo. Only fall back to a prefix for true variants
  // (e.g. 'messi_2' → 'messi'), preferring the LONGEST matching prefix.
  if (SOFIFA_MAPPING[playerId]) return playerId;
  const prefixMatches = Object.keys(SOFIFA_MAPPING).filter(key => playerId.startsWith(key + '_'));
  if (prefixMatches.length) return prefixMatches.sort((a, b) => b.length - a.length)[0];
  return playerId.split('_')[0];
}

export const LOCAL_PLAYER_PHOTO_ROOT = '/players/regular';

// Portraits added from FIFA Index use the player's readable key as filename.
// Keep this explicit because a few game keys intentionally differ from the
// filename (e.g. `abedipele` -> `abedi_pele`). The older regular package is
// still supported through its numeric ID fallback below.
const LOCAL_NAMED_PLAYER_PHOTOS: Record<string, string> = {
  abedipele: 'abedi_pele',
  baresi: 'baresi',
  bergkamp: 'bergkamp',
  blanc: 'blanc',
  buffon: 'buffon_juventus',
  buffon_juventus: 'buffon_juventus',
  buffon_parma: 'buffon_parma',
  buffon_psg: 'buffon_psg',
  butragueno: 'butragueno',
  cantona: 'cantona',
  cancelo: 'cancelo',
  cristiano: 'cristiano_realmadrid',
  cristiano_alnassr: 'cristiano_alnassr',
  cristiano_juventus: 'cristiano_juventus',
  cristiano_manchester: 'cristiano_manchester',
  cristiano_realmadrid: 'cristiano_realmadrid',
  cruyff: 'cruyff',
  dalglish: 'dalglish',
  garrincha: 'garrincha',
  gullit: 'gullit',
  hagi: 'hagi',
  haaland: 'haaland_city',
  haaland_borussia: 'haaland_borussia',
  kewell: 'kewell',
  koeman: 'koeman',
  lampard: 'lampard',
  maldini: 'maldini',
  maradona: 'maradona',
  matthaus: 'matthaus',
  mbappe: 'mbappe_psg',
  mbappe_monaco: 'mbappe_monaco',
  mbappe_psg: 'mbappe_psg',
  mbappe_realmadrid: 'mbappe_realmadrid',
  messi: 'messi_barcelona',
  messi_barcelona: 'messi_barcelona',
  messi_miami: 'messi_miami',
  messi_psg: 'messi_psg',
  milito: 'milito',
  neymar: 'neymar_barcelona',
  neymar_barcelona: 'neymar_barcelona',
  neymar_psg: 'neymar_psg',
  neymar_santos: 'neymar_santos',
  papin: 'papin',
  pele: 'pele',
  pires: 'pires',
  raphinha: 'raphinha',
  rijkaard: 'rijkaard',
  riise: 'riise',
  rivaldo: 'rivaldo',
  roberto_carlos: 'roberto_carlos',
  rodrygo: 'rodrygo',
  socrates: 'socrates',
  suarez: 'suarez_barcelona',
  suarez_atletico_madrid: 'suarez_atletico_madrid',
  suarez_barcelona: 'suarez_barcelona',
  suarez_miami: 'suarez_miami',
  stoichkov: 'stoichkov',
  veron: 'veron',
  voller: 'voller',
  varane: 'varane',
  zico: 'zico',
  zidane: 'zidane',
  zola: 'zola',
};

function buildLocalPlayerUrls(playerId: string): string[] {
  const baseId = getBasePlayerId(playerId);
  const m = SOFIFA_MAPPING[baseId];
  const localNames = Array.from(new Set(
    [
      // Prefer the exact version first (e.g. `messi_psg`), then the base ID.
      // Most portraits in public/players/regular use these readable filenames.
      playerId,
      baseId,
      LOCAL_NAMED_PLAYER_PHOTOS[playerId],
      LOCAL_NAMED_PLAYER_PHOTOS[baseId],
    ]
      .filter((name): name is string => !!name),
  ));
  if (!m && localNames.length === 0) return [];

  // Try readable local filenames before numeric legacy assets and SoFIFA.
  const localUrls = localNames.flatMap(localName => [
    `${LOCAL_PLAYER_PHOTO_ROOT}/${localName}.webp`,
    `${LOCAL_PLAYER_PHOTO_ROOT}/${localName}.png`,
  ]);

  // Numeric assets remain a transition fallback for any asset that has not yet
  // been renamed or for IDs shared by more than one game record.
  return [
    ...localUrls,
    ...(m ? [
      `${LOCAL_PLAYER_PHOTO_ROOT}/${m.id}.webp`,
      `${LOCAL_PLAYER_PHOTO_ROOT}/${m.id}.png`,
    ] : []),
  ];
}

export function buildLocalPlayerUrl(playerId: string): string | null {
  return buildLocalPlayerUrls(playerId)[0] ?? null;
}

function buildSofifaUrls(m: { id: number; ver: number }, lowRes: boolean): string[] {
  const padded = String(m.id).padStart(6, '0');
  const v = String(m.ver).padStart(2, '0'); // single-digit editions (e.g. FIFA 08) need "08", not "8"
  const prefix = `https://cdn.sofifa.net/players/${padded.slice(0, 3)}/${padded.slice(3, 6)}`;
  if (lowRes) return [`${prefix}/${v}_120.png`];

  const urls = [`${prefix}/${v}_360.png`];
  if (m.ver > 23) urls.push(`${prefix}/23_360.png`);
  if (m.ver > 22) urls.push(`${prefix}/22_360.png`);
  urls.push(`${prefix}/${v}_120.png`);
  return urls;
}

export function buildPlayerPhotoSources(playerId: string, lowRes = false): string[] {
  // ⭐ Cartas Únicas têm render PRÓPRIO — nunca cair na foto da carta-base (ex.: kaka_unico ≠ kaka).
  const u = UNIQUE_STYLE[playerId];
  if (u) return [u.render];

  const baseId = getBasePlayerId(playerId);
  const m = SOFIFA_MAPPING[baseId];

  // Prefer the readable local filename used by the downloaded Icon portraits,
  // then the converted/legacy numeric package, and only then use SoFIFA online.
  // The exact player ID is always tried, so adding `players/regular/<id>.webp`
  // is enough even when the ID has not been added to a mapping yet.
  return [
    ...buildLocalPlayerUrls(playerId),
    ...(m ? buildSofifaUrls(m, lowRes) : []),
  ];
}

export function buildSofifaUrl(playerId: string, size: 360 | 120 = 360): string | null {
  const sources = buildPlayerPhotoSources(playerId, size === 120);
  return sources[0] ?? null;
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
    case 'unique': return {
      bg: 'radial-gradient(135% 90% at 50% -6%,#FFFDF2 0%,#E9DBA6 10%,#8a7636 30%,#2a230f 60%,#0c0a04 100%)',
      border: '#F3E9C4', glow: '0 0 40px rgba(240,230,192,.6),0 0 14px rgba(255,255,240,.35),inset 0 0 26px rgba(240,230,192,.2)',
      accent: '#F3E9C4', badgeBg: 'rgba(243,233,196,.16)', statColor: '#FBF3D8', nameGlow: 'rgba(243,233,196,.7)',
      isPremium: true, label: 'ÚNICA', icon: '⭐',
      ribbon: 'linear-gradient(90deg,#6f5f26,#F0E6C0 42%,#fffef5 50%,#F0E6C0 58%,#6f5f26)',
      pattern: 'repeating-conic-gradient(from 0deg at 50% 24%,rgba(255,250,220,.12) 0deg 1.2deg,rgba(255,250,220,0) 1.2deg 10deg)',
      patternOpacity: 1,
    };
    case 'immortal': return {
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
    case 'gold': return {
      bg: 'linear-gradient(158deg,#08070c 0%,#1a1408 44%,#2c2212 82%,#0a0710 100%)',
      border: '#D4B25A', glow: '0 0 18px rgba(201,168,76,.26),inset 0 0 11px rgba(201,168,76,.08)',
      accent: '#E0C268', badgeBg: 'rgba(201,168,76,.12)', statColor: '#F0DC98', nameGlow: 'rgba(201,168,76,.38)',
      isPremium: false, label: 'OURO', icon: '◆',
      ribbon: 'linear-gradient(90deg,#5e4d1c,#D4B25A 50%,#5e4d1c)',
      pattern: 'repeating-linear-gradient(122deg,rgba(212,178,90,.06) 0 1px,transparent 1px 8px),repeating-linear-gradient(122deg,rgba(212,178,90,.03) 0 1px,transparent 1px 3px)',
      patternOpacity: 1,
    };
    case 'silver': return {
      bg: 'linear-gradient(158deg,#06060c 0%,#11131f 50%,#232734 86%,#070710 100%)',
      border: '#B7BCCC', glow: '0 0 12px rgba(183,188,204,.16),inset 0 0 10px rgba(183,188,204,.07)',
      accent: '#CCD2E2', badgeBg: 'rgba(183,188,204,.12)', statColor: '#E2E6F2', nameGlow: 'rgba(183,188,204,.34)',
      isPremium: false, label: 'PRATA', icon: '◇',
      ribbon: 'linear-gradient(90deg,#42454f,#B7BCCC 50%,#42454f)',
      pattern: 'repeating-linear-gradient(90deg,rgba(190,196,212,.06) 0 1px,transparent 1px 5px)',
      patternOpacity: 1,
    };
    default: return {
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

// Texturas de fundo por raridade (public/cards). WebP otimizado (~9–84 KB cada).
const RARITY_FILE: Record<string, string> = {
  immortal: 'bg-imortal', legendary: 'bg-lendario', gold: 'bg-ouro', silver: 'bg-prata', bronze: 'bg-bronze',
};
export function cardTexture(rarity: string, evolved = false): string {
  const base = RARITY_FILE[rarity] ?? RARITY_FILE.bronze;
  return evolved ? `/cards/${base}-emforma.webp` : `/cards/${base}.webp`;
}

// Por raridade: cor do anel metálico, glow, e o FILTRO que tinge a moldura dourada do frame
// (a moldura base é dourada; tingimos p/ bronze/prata; ouro/lendário/imortal ficam douradas).
const RARITY_VIS: Record<string, { ring: string; glow: string; frameFilter: string }> = {
  unique: { ring: '#F0E6C0', glow: 'rgba(240,230,192,.6)', frameFilter: 'brightness(1.12) saturate(1.04)' },
  bronze: { ring: '#C77B3A', glow: 'rgba(205,127,50,.5)', frameFilter: 'sepia(1) saturate(1.9) hue-rotate(-12deg) brightness(.92)' },
  silver: { ring: '#B7BCCC', glow: 'rgba(183,188,204,.42)', frameFilter: 'grayscale(1) brightness(1.45) contrast(.95)' },
  gold: { ring: '#D4B25A', glow: 'rgba(201,168,76,.5)', frameFilter: 'none' },
  legendary: { ring: '#FF9E3C', glow: 'rgba(255,150,40,.55)', frameFilter: 'brightness(1.06) saturate(1.1)' },
  immortal: { ring: '#FFE680', glow: 'rgba(255,215,0,.65)', frameFilter: 'brightness(1.16) saturate(1.15)' },
};
const rarityVis = (r: string) => RARITY_VIS[r] ?? RARITY_VIS.bronze;

// ⭐ CARTAS ÚNICAS — tratamento premium por carta: MESMA moldura de escudo das outras, mas com
// textura de fundo, foto (render próprio) e COR DE FONTE (letra/número) exclusivas de cada uma.
// Chave = id da carta (ver UNIQUE_CARDS em gameData). `font` combina com o fundo (o Cruyff é claro
// → fonte mais escura). `ring` é a cor do anel metálico. Fáceis de ajustar.
// photoX/photoY = canto sup-esq do render em % da carta; photoW = largura do render em % da carta
// (altura é automática, mantém a proporção). Valores ajustados no editor local (scratchpad).
export const UNIQUE_STYLE: Record<string, { texture: string; render: string; font: string; ring: string; photoX: number; photoY: number; photoW: number }> = {
  kaka_unico: { texture: '/cards/kaka_unico.webp', render: '/players/unico/kaka.webp', font: '#F6DE93', ring: '#E8C84A', photoX: 5, photoY: -2, photoW: 100 },
  henry_unico: { texture: '/cards/henry_unico.webp', render: '/players/unico/henry.webp', font: '#EAF4FF', ring: '#57C7EF', photoX: 8, photoY: 0, photoW: 130 },
  neymar_unico: { texture: '/cards/neymar_unico.webp', render: '/players/unico/neymar.webp', font: '#F7E08C', ring: '#E8C84A', photoX: 2, photoY: 15, photoW: 90 },
  cruyff_unico: { texture: '/cards/cruyff_unico.webp', render: '/players/unico/cruyff.webp', font: '#2A2310', ring: '#CBA94E', photoX: 7, photoY: -4, photoW: 100 },
  buffon_unico: { texture: '/cards/buffon_unico.webp', render: '/players/unico/buffon.webp', font: '#ECD7A6', ring: '#B58B48', photoX: 7, photoY: -5, photoW: 100 },
  beckenbauer_unico: { texture: '/cards/beckenbauer_unico.webp', render: '/players/unico/beckenbauer.webp', font: '#EAF0F6', ring: '#C9A24C', photoX: 10, photoY: -2, photoW: 110 },
  maldini_unico: { texture: '/cards/maldini_unico.webp', render: '/players/unico/maldini.webp', font: '#EAF2FF', ring: '#4A78C8', photoX: 7, photoY: -2, photoW: 100 },
  messi_unico: { texture: '/cards/messi_unico.webp', render: '/players/unico/messi.webp', font: '#F7E08C', ring: '#C9A24C', photoX: 7, photoY: -2, photoW: 100 },
  cafu_unico: { texture: '/cards/cafu_unico.webp', render: '/players/unico/cafu.webp', font: '#F0E6C0', ring: '#D9B54A', photoX: 8, photoY: 14, photoW: 82 },
};

// Dedicated Player Photo using local transparent portraits, with SoFIFA as a last resort.
// Fallback chain: local → latest_ver_360 → ver23_360 → ver22_360 → latest_ver_120 → placeholder
function PlayerPhoto({ playerId, fullName, size, lowRes = false }: { playerId: string; fullName: string; size: number; lowRes?: boolean }) {
  const urls = buildPlayerPhotoSources(playerId, lowRes);

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

// Special draft-variant visuals — each rides on its OWN reserved colour (never a rarity colour),
// layered ON TOP of the untouched rarity card (an animated border highlight + outer aura), so a
// special card is unmistakable: ⚡ Em alta (verde) · 🐺 Lobo (roxo) · 🃏 Coringa (vermelho)
// · 🌍 Nômade (azul) · 🧱 Pilar (branco).
// `treatment` drives a DISTINCT visual family: the 5 original variants share the rotating conic
// ring; the 3 team-effect ones (Mártir/Ídolo/12º Homem) get their own looks (pulse / halo / calm).
type VariantTreatment = 'ring' | 'pulse' | 'halo' | 'calm';
const VARIANT_STYLE: Record<string, { color: string; icon: string; label: string; treatment: VariantTreatment }> = {
  inForm: { color: '#39FF14', icon: '⚡', label: 'EM ALTA', treatment: 'ring' },
  lobo: { color: '#A855F7', icon: '🐺', label: 'LOBO SOLITÁRIO', treatment: 'ring' },
  coringa: { color: '#EF4444', icon: '🃏', label: 'CORINGA', treatment: 'ring' },
  nomade: { color: '#3B82F6', icon: '🌍', label: 'NÔMADE', treatment: 'ring' },
  pilar: { color: '#FFFFFF', icon: '🧱', label: 'PILAR', treatment: 'ring' },
  martir: { color: '#B91C1C', icon: '🩸', label: 'MÁRTIR', treatment: 'pulse' },
  idolo: { color: '#F59E0B', icon: '❤️', label: 'ÍDOLO', treatment: 'halo' },
  decimoHomem: { color: '#14B8A6', icon: '🪑', label: '12º HOMEM', treatment: 'calm' },
  pipoqueiro: { color: '#EC4899', icon: '🍿', label: 'PIPOQUEIRO', treatment: 'ring' },
  noe: { color: '#22D3EE', icon: '🛟', label: 'NOÉ', treatment: 'ring' },
  forasteiro: { color: '#A3E635', icon: '🧳', label: 'FORASTEIRO', treatment: 'ring' },
  capitaoNato: { color: '#F97316', icon: '🗣️', label: 'CAPITÃO NATO', treatment: 'ring' },
  magnata: { color: '#16A34A', icon: '🤑', label: 'MAGNATA', treatment: 'ring' },
};
const VARIANT_ORDER = ['inForm', 'lobo', 'coringa', 'nomade', 'pilar', 'martir', 'idolo', 'decimoHomem', 'pipoqueiro', 'noe', 'forasteiro', 'capitaoNato', 'magnata'] as const;
export type CardVariant = { key: string; color: string; icon: string; label: string; treatment: VariantTreatment };
export function getCardVariant(player: Player): CardVariant | null {
  for (const key of VARIANT_ORDER) {
    if ((player as unknown as Record<string, unknown>)[key]) return { key, ...VARIANT_STYLE[key] };
  }
  return null;
}
// TODAS as características da carta (Únicas podem ter 2). A 1ª ainda define anel/glow.
export function getCardVariants(player: Player): CardVariant[] {
  return VARIANT_ORDER.filter(k => (player as unknown as Record<string, unknown>)[k]).map(k => ({ key: k, ...VARIANT_STYLE[k] }));
}

// Short effect description for the card badge tooltip.
function variantDesc(player: Player): string {
  if (player.inForm) return `Carta EM ALTA: +${player.baseOverall !== undefined ? player.overall - player.baseOverall : 3} em cada atributo (o Geral sobe junto)`;
  if (player.lobo) return `LOBO SOLITÁRIO: +${player.baseOverall !== undefined ? player.overall - player.baseOverall : 6} em cada atributo, mas −12 na QUÍMICA GERAL do time`;
  if (player.coringa) return 'CORINGA: joga em qualquer posição sem perder estatísticas nem química';
  if (player.nomade) return 'NÔMADE: conta como qualquer nação na química';
  if (player.pilar) return 'PILAR: +12 na QUÍMICA GERAL do time';
  if (player.martir) return 'MÁRTIR: −6 em cada atributo nele, mas dá +3 em tudo a 2 titulares';
  if (player.idolo) return 'ÍDOLO: +2 em cada atributo aos OUTROS titulares do mesmo clube (não a ele)';
  if (player.decimoHomem) return '12º HOMEM: no banco, dá +1 compostura e +2 visão a todo o time';
  if (player.pipoqueiro) return 'PIPOQUEIRO: +4 em cada atributo na FASE DE LIGA, mas −5 no MATA-MATA';
  if (player.noe) return 'NOÉ: +10 em cada atributo NELE e +30 na química geral — só enquanto for o ÚNICO titular com característica';
  if (player.forasteiro) return 'FORASTEIRO: +5 em cada atributo quando é o ÚNICO titular do seu país E do seu clube';
  if (player.capitaoNato) return 'CAPITÃO NATO: se for o CAPITÃO do time, o bônus de capitão vem DOBRADO';
  if (player.magnata) return 'MAGNATA: titular multiplica os pontos da partida de LIGA por 1.5 (mas −5 em cada atributo nele)';
  return '';
}

function PlayerCard({ player, selected = false, onClick, compact = false, lite = false, showChemistry = false, chemScore = 0, scale = 1 }: PlayerCardProps) {
  // A identidade visual vem da raridade (textura + anel + borda do escudo). Uma característica
  // especial pinta o anel + glow na cor dela e mostra um chip — sem trocar a raridade.
  const theme = getCardTheme(player.rarity);
  const evolved = isEvolved(player);
  const variant = getCardVariant(player);
  const variants = getCardVariants(player);           // todas (Únicas podem ter 2)
  // ⭐ DUAS características (só Únicas): a moldura fica na cor da 1ª e uma linha no centro na cor da 2ª.
  const normCol = (c?: string) => (c === '#FFFFFF' ? '#E5E7EB' : c ?? null);
  const dualCol0 = variants.length >= 2 ? normCol(variants[0].color) : null;
  const dualCol1 = variants.length >= 2 ? normCol(variants[1].color) : null;
  const uniq = UNIQUE_STYLE[player.id];               // ⭐ carta Única (textura/fonte/render próprios)
  // A foto pode existir apenas no pacote local (sem entrada SoFIFA), como no Raphinha.
  // Use a mesma cadeia de fontes do PlayerPhoto para não esconder portraits locais.
  const hasPhoto = !!uniq || buildPlayerPhotoSources(player.id).length > 0;

  // ─── COMPACT CARD (escudo leve) ──────────────────────────────────────────
  // Caminho enxuto: 1 camada de textura achatada, sem anel metálico/scrim/border-SVG/glow pesados
  // (aparece em grades com muitos cards → tem que ser leve e não travar o scroll).
  if (compact) {
    const CompactWrapper = lite ? 'div' : motion.div;
    const compactMotion = lite ? {} : {
      whileHover: onClick ? { scale: 1.06, y: -3 } : {},
      whileTap: onClick ? { scale: 0.97 } : {},
    };
    const cvis = rarityVis(player.rarity);
    const cRing = dualCol0 ?? (uniq ? uniq.ring : (variant ? variant.color : cvis.ring));
    return (
      <CompactWrapper
        {...compactMotion}
        onClick={onClick}
        className={`relative select-none flex flex-col ${onClick ? 'cursor-pointer' : ''}`}
        style={{ width: 92, height: 146, filter: selected ? 'drop-shadow(0 0 8px rgba(255,255,255,.7))' : `drop-shadow(0 0 5px ${cRing}66)` }}
      >
        {/* borda em COR SÓLIDA (característica, ou raridade se não tiver) — máscara do escudo cheia */}
        <div className="absolute inset-0" style={{ ...frameMask('100% 100%'), zIndex: 0, background: cRing }} />
        {/* ⭐ 2ª característica: linha vertical no centro da moldura (some no interior, aparece no topo/base) */}
        {dualCol1 && <div className="absolute inset-0" style={{ ...frameMask('100% 100%'), zIndex: 0, background: `linear-gradient(90deg, transparent calc(50% - 1.5px), ${dualCol1} calc(50% - 1.5px), ${dualCol1} calc(50% + 1.5px), transparent calc(50% + 1.5px))` }} />}
        {/* interior numa ÚNICA camada (scrims + textura + fallback empilhados; máscara só → mais leve) */}
        <div className="absolute inset-0" style={{
          ...frameMask('93% 94%'), zIndex: 1, background:
            `linear-gradient(180deg,rgba(0,0,0,.34),transparent 28%),` +
            `linear-gradient(0deg,rgba(0,0,0,.58),transparent 40%),` +
            `url(${uniq ? uniq.texture : cardTexture(player.rarity, evolved)}) center/cover no-repeat,` +
            `${theme.bg}`
        }} />

        {/* ⭐ Cartas Únicas: render posicionado (mesmo photoX/Y/W da carta grande — % funciona em qualquer tamanho) */}
        {uniq && (
          <div className="absolute inset-0" style={{ ...frameMask('93% 94%'), zIndex: 2, overflow: 'hidden' }}>
            <img src={uniq.render} alt={player.fullName} referrerPolicy="no-referrer"
              style={{ position: 'absolute', left: `${uniq.photoX}%`, top: `${uniq.photoY}%`, width: `${uniq.photoW}%`, height: 'auto', pointerEvents: 'none' }} />
          </div>
        )}

        {/* conteúdo (layout original): OVR+POS no topo, emoji, foto, nome embaixo */}
        <div className="absolute inset-0 flex flex-col" style={{ color: uniq ? uniq.font : '#f7eeca', zIndex: 4 }}>
          {/* Topo: OVR + POS (esq) e emoji da característica (dir) — descido um tiquinho */}
          <div className="flex items-start justify-between flex-shrink-0" style={{ paddingTop: '19%', paddingLeft: '13%', paddingRight: '10%' }}>
            <div className="flex flex-col leading-none" style={{ textShadow: '0 1px 3px #000' }}>
              <span style={{ fontFamily: 'Bebas Neue,sans-serif', color: uniq ? uniq.font : '#fff', fontSize: 18, lineHeight: 1 }}>{player.overall}</span>
              <span style={{ fontFamily: 'Rajdhani,sans-serif', fontSize: 8, fontWeight: 800, letterSpacing: '0.05em' }}>{posLabel(player.position)}</span>
            </div>
            {variants.length > 0 && (
              <div className="flex flex-col items-center" style={{ gap: 1 }}>
                {variants.map(v => (
                  <span key={v.key} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 18, height: 18, borderRadius: '50%', background: 'radial-gradient(circle, rgba(0,0,0,.6) 48%, rgba(0,0,0,0) 76%)', fontSize: 10.5, lineHeight: 1, textShadow: `0 0 5px ${v.color}` }}>{v.icon}</span>
                ))}
              </div>
            )}
          </div>

          {/* Foto (cartas normais; as Únicas usam o render posicionado acima) */}
          <div className="flex-1 flex items-end justify-center overflow-hidden" style={{ minHeight: 0, marginLeft: '10%', marginRight: '10%' }}>
            {!uniq && (hasPhoto ? (
              <PlayerPhoto playerId={player.id} fullName={player.fullName} size={50} lowRes />
            ) : (
              <span style={{ fontSize: 22, opacity: 0.2 }}>⚽</span>
            ))}
          </div>

          {/* Nome + país/clube + química (embaixo). Sem química (draft/loja/banco) sobe foto+nome com mais folga. */}
          <div className="flex flex-col items-center flex-shrink-0" style={{ paddingBottom: showChemistry ? '14%' : '19%', paddingLeft: '10%', paddingRight: '10%' }}>
            {/* bandeira (país) + escudo (clube) — ajudam a ler a química no MEU TIME */}
            <div className="flex items-center justify-center gap-1 mb-0.5">
              {getFlagUrl(player.nation) && <img src={getFlagUrl(player.nation)!} alt={player.nation} referrerPolicy="no-referrer" style={{ width: 14, height: 9, objectFit: 'cover', borderRadius: 1.5, boxShadow: '0 1px 2px rgba(0,0,0,.75)' }} />}
              {CLUB_CRESTS[player.club] && <img src={CLUB_CRESTS[player.club]} alt={player.club} referrerPolicy="no-referrer" style={{ width: 12, height: 12, objectFit: 'contain', filter: 'drop-shadow(0 1px 1px rgba(0,0,0,.7))' }} />}
            </div>
            <div className="w-full text-center truncate" style={{ fontFamily: 'Rajdhani,sans-serif', fontSize: 9.5, fontWeight: 800, color: uniq ? uniq.font : '#fff', textShadow: '0 1px 2px #000,0 0 2px #000', letterSpacing: '0.04em' }}>
              {player.shortName.toUpperCase()}
            </div>
            {showChemistry && (
              <div className="flex gap-0.5 mt-0.5">
                {[0, 1, 2].map(i => (
                  <div key={i} style={{ width: 4, height: 4, borderRadius: '50%', backgroundColor: i < chemScore ? '#22C55E' : '#1a1a2e', boxShadow: i < chemScore ? '0 0 4px #22C55E' : 'none', border: '1px solid rgba(255,255,255,.1)' }} />
                ))}
              </div>
            )}
          </div>
        </div>
      </CompactWrapper>
    );
  }

  // ─── FULL CARD (escudo FUT) ──────────────────────────────────────────────
  const CardWrapper = lite ? 'div' : motion.div;
  const cardMotionProps = lite ? {} : {
    whileHover: { scale: 1.03, y: -4 },
    whileTap: onClick ? { scale: 0.97 } : {},
  };
  const vis = rarityVis(player.rarity);
  const ringColor = dualCol0 ?? (uniq ? uniq.ring : (variant ? variant.color : vis.ring));
  const glowColor = selected ? 'rgba(255,255,255,.75)' : (dualCol0 ?? (uniq ? uniq.ring : (variant ? variant.color : vis.glow)));
  const INSET = '94.5% 95.5%';

  const fullCard = (
    <CardWrapper
      {...cardMotionProps}
      onClick={onClick}
      className={`relative select-none flex ${onClick ? 'cursor-pointer' : ''}`}
      style={{ width: 200, height: 324, filter: `drop-shadow(0 0 10px ${glowColor}) drop-shadow(0 8px 14px rgba(0,0,0,.5))` }}
    >
      {/* moldura do escudo (contorno + borda dourada reais), tingida por raridade */}
      <img src={FRAME_URL} alt="" className="absolute inset-0" style={{ width: '100%', height: '100%', objectFit: 'fill', zIndex: 0, pointerEvents: 'none', filter: vis.frameFilter }} />
      {/* anel metálico (raridade ou característica) — máscara cheia, revela na banda entre borda e textura */}
      <div className="absolute inset-0" style={{ ...frameMask('98% 98.5%'), zIndex: 1, background: ringGradient(ringColor) }} />
      {/* ⭐ 2ª característica: linha vertical no centro do anel (cor da 2ª carta) */}
      {dualCol1 && <div className="absolute inset-0" style={{ ...frameMask('98% 98.5%'), zIndex: 1, background: `linear-gradient(90deg, transparent calc(50% - 2px), ${dualCol1} calc(50% - 2px), ${dualCol1} calc(50% + 2px), transparent calc(50% + 2px))` }} />}
      {/* interior numa ÚNICA camada (scrims + textura + fallback do tema empilhados no mesmo background,
          uma máscara só → menos camadas compostas, mesmo visual, mais leve) */}
      <div className="absolute inset-0" style={{
        ...frameMask(INSET), zIndex: 2, background:
          `linear-gradient(180deg,rgba(0,0,0,.40) 0%,rgba(0,0,0,0) 24%),` +
          `linear-gradient(0deg,rgba(0,0,0,.66) 0%,rgba(0,0,0,0) 46%),` +
          `radial-gradient(58% 38% at 17% 25%,rgba(0,0,0,.38),transparent 70%),` +
          `url(${uniq ? uniq.texture : cardTexture(player.rarity, evolved)}) center/cover no-repeat,` +
          `${theme.bg}`
      }} />

      {/* ⭐ Cartas Únicas: render posicionado por carta (x/y/largura), ATRÁS do conteúdo (OVR/nome/stats por cima). */}
      {uniq && (
        <div className="absolute inset-0" style={{ ...frameMask(INSET), zIndex: 3, overflow: 'hidden' }}>
          <img src={uniq.render} alt={player.fullName} referrerPolicy="no-referrer"
            style={{ position: 'absolute', left: `${uniq.photoX}%`, top: `${uniq.photoY}%`, width: `${uniq.photoW}%`, height: 'auto', pointerEvents: 'none' }} />
        </div>
      )}

      {/* CONTEÚDO (layout FUT) */}
      <div className="absolute inset-0" style={{ color: uniq ? uniq.font : '#f7eeca', zIndex: 5 }}>
        {/* ⭐ selo de Carta Evoluída (discreto, topo-centro) */}
        {evolved && !lite && (
          <div className="absolute" style={{ top: '2.5%', left: '50%', transform: 'translateX(-50%)', padding: '2px 8px', borderRadius: 999, fontSize: 8, fontWeight: 900, letterSpacing: '.14em', whiteSpace: 'nowrap', color: '#04120a', background: 'linear-gradient(90deg,#0a7a2f,#22C55E,#0a7a2f)', border: '1px solid rgba(0,0,0,.4)', boxShadow: '0 2px 8px rgba(0,0,0,.5)', fontFamily: 'Rajdhani,sans-serif', zIndex: 6 }}>
            ⭐ EVOLUÍDA
          </div>
        )}
        {/* rail: OVR → posição → bandeira → escudo do clube */}
        <div className="absolute flex flex-col items-center" style={{ left: '6%', top: '15%', width: 46, gap: 4, textShadow: '0 2px 5px rgba(0,0,0,.85)' }}>
          <span style={{ fontFamily: 'Bebas Neue,sans-serif', fontSize: 40, lineHeight: .8 }}>{player.overall}</span>
          <span style={{ fontFamily: 'Rajdhani,sans-serif', fontWeight: 800, fontSize: 15, letterSpacing: '.04em' }}>{posLabel(player.position)}</span>
          <div style={{ width: 30, height: 1, background: 'rgba(247,238,202,.55)', margin: '3px 0' }} />
          {getFlagUrl(player.nation) && <img src={getFlagUrl(player.nation)!} alt={player.nation} referrerPolicy="no-referrer" style={{ width: 22, height: 15, objectFit: 'cover', borderRadius: 2, filter: 'drop-shadow(0 1px 2px rgba(0,0,0,.6))' }} />}
          {CLUB_CRESTS[player.club] && <img src={CLUB_CRESTS[player.club]} alt={player.club} referrerPolicy="no-referrer" style={{ width: 22, height: 22, objectFit: 'contain' }} />}
        </div>
        {/* foto (cartas normais; as Únicas usam o render grande atrás do conteúdo) */}
        {!uniq && (
          <div className="absolute flex items-end justify-center" style={{ right: '9%', top: '8%', width: '58%', height: '44%' }}>
            {hasPhoto ? <PlayerPhoto playerId={player.id} fullName={player.fullName} size={150} lowRes={lite} /> : <span style={{ fontSize: 40, opacity: .2 }}>⚽</span>}
          </div>
        )}
        {/* chip de raridade (mesmo estilo de hoje, sem emoji) */}
        <div className="absolute" style={{ top: '52%', left: '50%', transform: 'translateX(-50%)', padding: '2px 11px', borderRadius: 999, fontSize: 8, fontWeight: 900, letterSpacing: '.16em', textTransform: 'uppercase', whiteSpace: 'nowrap', color: theme.isPremium ? '#1f1500' : '#0a0a0a', background: theme.ribbon, border: '1px solid rgba(0,0,0,.35)', boxShadow: '0 2px 8px rgba(0,0,0,.5),inset 0 1px 0 rgba(255,255,255,.25)', fontFamily: 'Rajdhani,sans-serif' }}>{theme.label}</div>
        {/* nome — sem painel; linha fina embaixo + sombra forte pra legibilidade */}
        <div className="absolute text-center" style={{ top: '57.5%', left: '12%', right: '12%', paddingBottom: 4, borderBottom: '2px solid rgba(255,255,255,.22)' }}>
          <span style={{ fontFamily: 'Bebas Neue,sans-serif', fontWeight: 900, letterSpacing: '.03em', fontSize: 21, color: uniq ? uniq.font : '#fff', textShadow: '0 2px 5px rgba(0,0,0,.9),0 0 2px rgba(0,0,0,.8)' }}>{player.shortName.toUpperCase()}</span>
        </div>
        {/* 6 stats — sem painel; sombra forte */}
        <div className="absolute" style={{ top: '69%', left: '10%', right: '10%' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', fontVariantNumeric: 'tabular-nums' }}>
            {([['RIT', player.pace], ['FIN', player.shooting], ['PAS', player.passing], ['DRI', player.dribbling], ['DEF', player.defending], ['FIS', player.physical]] as [string, number][]).map(([k, v]) => (
              <div key={k} className="flex flex-col items-center" style={{ color: uniq ? uniq.font : '#fff', textShadow: '0 1px 3px rgba(0,0,0,.95),0 0 2px rgba(0,0,0,.9)' }}>
                <span style={{ fontFamily: 'Rajdhani,sans-serif', fontSize: 8, fontWeight: 800, opacity: .82 }}>{k}</span>
                <span style={{ fontFamily: 'Bebas Neue,sans-serif', fontWeight: 900, fontSize: 18 }}>{v}</span>
              </div>
            ))}
          </div>
        </div>
        {/* chip(s) de característica — Únicas podem ter 2 (empilhadas) */}
        {variants.length > 0 && (
          <div className="absolute flex flex-col items-center" style={{ top: '82.5%', left: '50%', transform: 'translateX(-50%)', gap: 3, width: 'max-content' }} title={variantDesc(player)}>
            {variants.map(v => (
              <div key={v.key} className="inline-flex items-center" style={{ gap: 4, padding: variants.length > 1 ? '1.5px 8px' : '2.5px 10px', borderRadius: 999, fontSize: variants.length > 1 ? 8.5 : 10.5, fontWeight: 900, letterSpacing: '.1em', whiteSpace: 'nowrap', color: '#fff', background: `linear-gradient(90deg,#0008,${v.color},#0008)`, border: '1px solid rgba(0,0,0,.45)', boxShadow: `0 0 9px color-mix(in srgb,${v.color} 62%,transparent)`, textShadow: '0 1px 2px rgba(0,0,0,.9)', fontFamily: 'Rajdhani,sans-serif' }}>
                <span>{v.icon}</span> {v.label}
              </div>
            ))}
          </div>
        )}
      </div>
    </CardWrapper>
  );

  if (scale === 1) return fullCard;
  // Escala opcional: encolhe o card FULL e a área que ele ocupa (o design é fixo em px, então
  // um wrapper de tamanho reduzido + transform:scale mantém tudo proporcional sem quebrar o layout).
  return (
    <div style={{ width: 200 * scale, height: 324 * scale }}>
      <div style={{ width: 200, height: 324, transformOrigin: 'top left', transform: `scale(${scale})` }}>
        {fullCard}
      </div>
    </div>
  );
}

// Memoized: cards re-render only when their own props change, not whenever a parent
// (e.g. the league hub) re-renders for unrelated reasons. Keeps grids of cards smooth.
export default memo(PlayerCard);
