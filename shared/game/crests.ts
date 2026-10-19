// UCL Immortals — Club crest catalogue. Every crest is served from /crests (webp, 192px): they came from Wikimedia,
// but a crest loaded from another site appeared piece by piece in front of the player.
// Keyed by a stable slug `id`. Do NOT hand-edit ids — bots and saved games reference them.

export interface CrestDef {
  id: string;
  name: string;
  url: string;
  /** National federation crests stay in the catalogue for legacy display, but are not playable club picks. */
  teamType?: 'club' | 'national-team';
  /** Some legacy crest files include an opaque square around the circular badge. */
  clipToCircle?: boolean;
}
interface CrestGroup { league: string; crests: CrestDef[]; }

export const CREST_CATALOG: CrestGroup[] = [
  {
    league: "Premier League 🇬🇧", crests: [
      { id: "arsenal", name: "Arsenal", url: "/crests/arsenal.webp" },
      { id: "chelsea", name: "Chelsea", url: "/crests/chelsea.webp" },
      { id: "liverpool", name: "Liverpool", url: "/crests/liverpool.webp" },
      { id: "manchester-united", name: "Manchester United", url: "/crests/manchester-united.webp" },
      { id: "manchester-city", name: "Manchester City", url: "/crests/manchester-city.webp" },
      { id: "tottenham", name: "Tottenham", url: "/crests/tottenham.webp" },
      { id: "newcastle", name: "Newcastle", url: "/crests/newcastle.webp" },
      { id: "aston-villa", name: "Aston Villa", url: "/crests/aston-villa.webp" },
      { id: "west-ham", name: "West Ham", url: "/crests/west-ham.webp" },
      { id: "everton", name: "Everton", url: "/crests/everton.webp" },
      { id: "leicester-city", name: "Leicester City", url: "/crests/leicester-city.webp" },
      { id: "wolves", name: "Wolves", url: "/crests/wolves.webp" },
      { id: "leeds", name: "Leeds", url: "/crests/leeds.webp" },
      { id: "brentford", name: "Brentford", url: "/crests/brentford.webp" },
      { id: "crystal-palace", name: "Crystal Palace", url: "/crests/crystal-palace.webp" },
      { id: "fulham", name: "Fulham", url: "/crests/fulham.webp" },
      { id: "bournemouth", name: "Bournemouth", url: "/crests/bournemouth.webp" },
      { id: "nottingham-forest", name: "Nottingham Forest", url: "/crests/nottingham-forest.webp" },
      { id: "southampton", name: "Southampton", url: "/crests/southampton.webp" },
      { id: "brighton", name: "Brighton", url: "/crests/brighton.webp" },
    ]
  },
  {
    league: "La Liga 🇪🇸", crests: [
      { id: "barcelona", name: "Barcelona", url: "/crests/barcelona.webp" },
      { id: "real-madrid", name: "Real Madrid", url: "/crests/real-madrid.webp" },
      { id: "sevilla", name: "Sevilla", url: "/crests/sevilla.webp" },
      { id: "valencia", name: "Valencia", url: "/crests/valencia.webp" },
      { id: "villarreal", name: "Villarreal", url: "/crests/villarreal.webp" },
      { id: "real-betis", name: "Real Betis", url: "/crests/real-betis.svg" },
      { id: "athletic-bilbao", name: "Athletic Bilbao", url: "/crests/athletic-bilbao.webp" },
      { id: "real-sociedad", name: "Real Sociedad", url: "/crests/real-sociedad.webp" },
      { id: "celta-vigo", name: "Celta Vigo", url: "/crests/celta-vigo.webp" },
      { id: "atletico-madrid", name: "Atlético Madrid", url: "/crests/atletico-madrid.webp" },
      { id: "getafe", name: "Getafe", url: "/crests/getafe.webp" },
    ]
  },
  {
    league: "Serie A 🇮🇹", crests: [
      { id: "juventus", name: "Juventus", url: "/crests/juventus.webp" },
      { id: "inter-milan", name: "Inter Milan", url: "/crests/inter-milan.webp" },
      { id: "milan", name: "Milan", url: "/crests/milan.webp" },
      { id: "roma", name: "Roma", url: "/crests/roma.webp" },
      { id: "lazio", name: "Lazio", url: "/crests/lazio.webp" },
      { id: "atalanta", name: "Atalanta", url: "/crests/atalanta.webp" },
      { id: "fiorentina", name: "Fiorentina", url: "/crests/fiorentina.webp" },
      { id: "torino", name: "Torino", url: "/crests/torino.webp" },
      { id: "napoli", name: "Napoli", url: "/crests/napoli.webp" },
      { id: "bologna", name: "Bologna", url: "/crests/bologna.webp" },
      { id: "lecce", name: "Lecce", url: "/crests/lecce.webp" },
      { id: "pisa", name: "Pisa", url: "/crests/pisa.webp" },
      { id: "como", name: "Como", url: "/crests/como.webp" },
    ]
  },
  {
    league: "Bundesliga 🇩🇪", crests: [
      { id: "bayern-munich", name: "Bayern Munich", url: "/crests/bayern-munich.webp" },
      { id: "borussia-dortmund", name: "Borussia Dortmund", url: "/crests/borussia-dortmund.webp" },
      { id: "rb-leipzig", name: "RB Leipzig", url: "/crests/rb-leipzig.webp" },
      { id: "bayer-leverkusen", name: "Bayer Leverkusen", url: "/crests/bayer-leverkusen.webp" },
      { id: "wolfsburg", name: "Wolfsburg", url: "/crests/wolfsburg.webp" },
      { id: "borussia-m-gladbach", name: "Borussia M'gladbach", url: "/crests/borussia-m-gladbach.webp" },
      { id: "stuttgart", name: "Stuttgart", url: "/crests/stuttgart.webp" },
      { id: "schalke", name: "Schalke", url: "/crests/schalke.webp" },
      { id: "werder-bremen", name: "Werder Bremen", url: "/crests/werder-bremen.webp" },
      { id: "eintracht-frankfurt", name: "Eintracht Frankfurt", url: "/crests/eintracht-frankfurt.webp" },
      { id: "koln", name: "Köln", url: "/crests/koln.webp" },
    ]
  },
  {
    league: "Ligue 1 🇫🇷", crests: [
      { id: "paris-saint-germain", name: "Paris Saint-Germain", url: "/crests/paris-saint-germain.webp" },
      { id: "marseille", name: "Marseille", url: "/crests/marseille.webp" },
      { id: "saint-etienne", name: "Saint-Étienne", url: "/crests/saint-etienne.webp" },
      { id: "lille", name: "Lille", url: "/crests/lille.webp" },
      { id: "nice", name: "Nice", url: "/crests/nice.webp" },
      { id: "rennes", name: "Rennes", url: "/crests/rennes.webp" },
      { id: "lens", name: "Lens", url: "/crests/lens.webp" },
      { id: "lyon", name: "Lyon", url: "/crests/lyon.webp" },
      { id: "monaco", name: "Monaco", url: "/crests/monaco.webp" },
      { id: "strasbourg", name: "Strasbourg", url: "/crests/strasbourg.webp", clipToCircle: true },
    ]
  },
  {
    league: "Portugal 🇵🇹", crests: [
      { id: "porto", name: "Porto", url: "/crests/porto.webp" },
      { id: "benfica", name: "Benfica", url: "/crests/benfica.webp" },
      { id: "braga", name: "Braga", url: "/crests/braga.webp" },
      { id: "sporting-cp", name: "Sporting CP", url: "/crests/sporting-cp.webp" },
    ]
  },
  {
    league: "Eredivisie 🇳🇱", crests: [
      { id: "ajax", name: "Ajax", url: "/crests/ajax.webp" },
      { id: "psv", name: "PSV", url: "/crests/psv.webp" },
      { id: "feyenoord", name: "Feyenoord", url: "/crests/feyenoord.webp" },
    ]
  },
  {
    league: "Escócia", crests: [
      { id: "celtic", name: "Celtic", url: "/crests/celtic.webp", clipToCircle: true },
      { id: "rangers", name: "Rangers", url: "/crests/rangers.webp" },
    ]
  },
  {
    league: "Turquia 🇹🇷", crests: [
      { id: "galatasaray", name: "Galatasaray", url: "/crests/galatasaray.webp" },
      { id: "besiktas", name: "Beşiktaş", url: "/crests/besiktas.webp" },
      { id: "trabzonspor", name: "Trabzonspor", url: "/crests/trabzonspor.webp" },
      { id: "fenerbahce", name: "Fenerbahçe", url: "/crests/fenerbahce.webp" },
    ]
  },
  {
    league: "Grécia 🇬🇷", crests: [
      { id: "olympiacos", name: "Olympiacos", url: "/crests/olympiacos.webp" },
    ]
  },
  {
    league: "Bélgica 🇧🇪", crests: [
      { id: "club-brugge", name: "Club Brugge", url: "/crests/club-brugge.png" },
      { id: "anderlecht", name: "Anderlecht", url: "/crests/anderlecht.webp" },
    ]
  },
  {
    league: "Áustria 🇦🇹", crests: [
      { id: "red-bull-salzburg", name: "Red Bull Salzburg", url: "/crests/red-bull-salzburg.webp" },
    ]
  },
  {
    league: "Ucrânia 🇺🇦", crests: [
      { id: "shakhtar-donetsk", name: "Shakhtar Donetsk", url: "/crests/shakhtar-donetsk.webp" },
      { id: "dynamo-kyiv", name: "Dynamo Kyiv", url: "/crests/dynamo-kyiv.svg" },
    ]
  },
  {
    league: "Rússia 🇷🇺", crests: [
      { id: "zenit", name: "Zenit", url: "/crests/zenit.webp" },
      { id: "cska-moscow", name: "CSKA Moscow", url: "/crests/cska-moscow.webp" },
      { id: "spartak-moscow", name: "Spartak Moscow", url: "/crests/spartak-moscow.webp" },
    ]
  },
  {
    league: "Brasil 🇧🇷", crests: [
      { id: "brazil", name: "Brasil", url: "/crests/brazil.webp", teamType: 'national-team' },
      { id: "flamengo", name: "Flamengo", url: "/crests/flamengo.webp" },
      { id: "palmeiras", name: "Palmeiras", url: "/crests/palmeiras.webp" },
      { id: "sao-paulo", name: "São Paulo", url: "/crests/sao-paulo.webp" },
      { id: "santos", name: "Santos", url: "/crests/santos.webp" },
      { id: "botafogo", name: "Botafogo", url: "/crests/botafogo.webp" },
      { id: "gremio", name: "Grêmio", url: "/crests/gremio.webp" },
      { id: "internacional", name: "Internacional", url: "/crests/internacional.webp" },
      { id: "atletico-mineiro", name: "Atlético Mineiro", url: "/crests/atletico-mineiro.webp" },
      { id: "vasco", name: "Vasco", url: "/crests/vasco.webp" },
      { id: "corinthians", name: "Corinthians", url: "/crests/corinthians.webp" },
      { id: "fluminense", name: "Fluminense", url: "/crests/fluminense.webp" },
      { id: "coritiba", name: "Coritiba", url: "/crests/coritiba.webp" },
      { id: "ceara", name: "Ceará", url: "/crests/ceara.webp" },
      { id: "fortaleza", name: "Fortaleza", url: "/crests/fortaleza.webp" },
      { id: "cruzeiro", name: "Cruzeiro", url: "/crests/cruzeiro.svg" },
      { id: "bahia", name: "Bahia", url: "/crests/bahia.svg" },
      { id: "juventude", name: "Juventude", url: "/crests/juventude.svg" },
      { id: "vitoria", name: "Vitória", url: "/crests/vitoria.svg" },
      { id: "mirassol", name: "Mirassol", url: "/crests/mirassol.svg" },
      { id: "bragantino", name: "Bragantino", url: "/crests/bragantino.png" },
      { id: "sport", name: "Sport", url: "/crests/sport.svg" },
    ]
  },
  {
    league: "Argentina 🇦🇷", crests: [
      { id: "independiente", name: "Independiente", url: "/crests/independiente.webp" },
      { id: "racing-club", name: "Racing Club", url: "/crests/racing-club.webp" },
      { id: "boca-juniors", name: "Boca Juniors", url: "/crests/boca-juniors.webp" },
      { id: "river-plate", name: "River Plate", url: "/crests/river-plate.webp" },
    ]
  },
  {
    league: "México 🇲🇽", crests: [
      { id: "club-america", name: "Club América", url: "/crests/club-america.webp" },
    ]
  },
  {
    league: "MLS 🇺🇸", crests: [
      { id: "inter-miami", name: "Inter Miami", url: "/crests/inter-miami.webp" },
      { id: "la-galaxy", name: "LA Galaxy", url: "/crests/la-galaxy.webp" },
    ]
  },
  {
    league: "Outros 🌍", crests: [
      { id: "watford", name: "Watford", url: "/crests/watford.webp" },
      { id: "sunderland", name: "Sunderland", url: "/crests/sunderland.webp" },
      { id: "red-star", name: "Estrela Vermelha", url: "/crests/red-star.webp" },
      { id: "young-boys", name: "Young Boys", url: "/crests/young-boys.webp" },
      { id: "sparta-prague", name: "Sparta Praga", url: "/crests/sparta-prague.webp" },
      { id: "dinamo-zagreb", name: "Dinamo Zagreb", url: "/crests/dinamo-zagreb.webp" },
      { id: "girona", name: "Girona FC", url: "/crests/girona.webp" },
      { id: "al-nassr", name: "Al Nassr", url: "/crests/al-nassr.webp" },
      { id: "al-hilal", name: "Al Hilal", url: "/crests/al-hilal.webp" },
      { id: "al-ittihad", name: "Al Ittihad", url: "/crests/al-ittihad.webp" },
      { id: "al-ahli", name: "Al Ahli", url: "/crests/al-ahli.webp" },
      { id: "guangzhou-evergrande", name: "Guangzhou Evergrande", url: "/crests/guangzhou-evergrande.webp" },
      { id: "atlanta-united", name: "Atlanta United", url: "/crests/atlanta-united.webp" },
      { id: "dalian-yifang", name: "Dalian YiFang FC", url: "/crests/dalian-yifang.webp" },
      { id: "dynamo-moscow", name: "Dynamo Moscow", url: "/crests/dynamo-moscow.webp" },
      { id: "hertha-bsc", name: "Hertha BSC", url: "/crests/hertha-bsc.webp" },
      { id: "hoffenheim", name: "Hoffenheim", url: "/crests/hoffenheim.webp" },
      { id: "lokomotiv-moscow", name: "Lokomotiv Moscow", url: "/crests/lokomotiv-moscow.webp" },
      { id: "los-angeles-fc", name: "Los Angeles FC", url: "/crests/los-angeles-fc.webp" },
      { id: "basaksehir", name: "Medipol Başakşehir FK", url: "/crests/basaksehir.webp" },
      { id: "parma", name: "Parma", url: "/crests/parma.webp" },
      { id: "sassuolo", name: "Sassuolo", url: "/crests/sassuolo.webp" },
      { id: "reggiana", name: "Reggiana", url: "/crests/reggiana.webp" },
      { id: "toronto-fc", name: "Toronto FC", url: "/crests/toronto-fc.webp" },
      { id: "udinese", name: "Udinese", url: "/crests/udinese.webp" },
      { id: "stoke-city", name: "Stoke City", url: "/crests/stoke-city.webp" },
      { id: "swansea-city", name: "Swansea City", url: "/crests/swansea-city.webp" },
      { id: "genoa", name: "Genoa", url: "/crests/genoa.webp" },
      { id: "shanghai-sipg", name: "Shanghai SIPG", url: "/crests/shanghai-sipg.webp" },
      { id: "anzhi-makhachkala", name: "Anzhi Makhachkala", url: "/crests/anzhi-makhachkala.webp" },
      { id: "malaga", name: "Málaga", url: "/crests/malaga.webp" },
      { id: "hamburger-sv", name: "Hamburger SV", url: "/crests/hamburger-sv.webp" },
      { id: "nacional-uruguai", name: "Nacional", url: "/crests/nacional-uruguai.webp" },
      { id: "palermo", name: "Palermo", url: "/crests/palermo.webp" },
    ]
  },
];

export const CRESTS_BY_ID: Record<string, CrestDef> = Object.fromEntries(
  CREST_CATALOG.flatMap(g => g.crests).map(c => [c.id, c])
);

export const ALL_CRESTS: CrestDef[] = CREST_CATALOG.flatMap(g => g.crests);
/** National teams are offered in their own picker section and may be event-locked. */
export const NATIONAL_TEAM_CRESTS: CrestDef[] = ALL_CRESTS.filter(crest => crest.teamType === 'national-team');

/** Club crests offered as team identities in a new game. National crests remain displayable for legacy data. */
export const PLAYABLE_CRESTS: CrestDef[] = ALL_CRESTS.filter(crest => crest.teamType !== 'national-team');
export const PLAYABLE_CREST_CATALOG: CrestGroup[] = CREST_CATALOG
  .map(group => ({ ...group, crests: group.crests.filter(crest => crest.teamType !== 'national-team') }))
  .filter(group => group.crests.length > 0);

const normalizeClubName = (value: string): string => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '');

// Player cards use concise club labels, while bots sometimes use broadcast-style
// names. Keeping this translation here makes every screen use the same badge.
const CLUB_CREST_ALIASES: Record<string, string> = {
  psg: 'paris-saint-germain',
  'bayern-munchen': 'bayern-munich',
  'inter-de-milao': 'inter-milan',
  'liverpool-fc': 'liverpool',
  'arsenal-fc': 'arsenal',
  'fc-barcelona': 'barcelona',
  'juventus-fc': 'juventus',
  'atletico-de-madrid': 'atletico-madrid',
  'ac-milan': 'milan',
  'benfica-glorioso': 'benfica',
  'fc-porto': 'porto',
  'ajax-legends': 'ajax',
  'psv-eindhoven': 'psv',
  'feyenoord-roterda': 'feyenoord',
  'atalanta-bergamo': 'atalanta',
  'as-monaco': 'monaco',
  'lille-osc': 'lille',
  'vfb-stuttgart': 'stuttgart',
  'bologna-fc': 'bologna',
  'celtic-fc': 'celtic',
  'rb-salzburg': 'red-bull-salzburg',
  'lazio-roma': 'lazio',
  'estrela-vermelha': 'red-star',
  'young-boys-bern': 'young-boys',
  'sparta-praga': 'sparta-prague',
};

const CREST_ID_BY_NORMALIZED_NAME = new Map(
  ALL_CRESTS.flatMap(crest => [
    [normalizeClubName(crest.name), crest.id] as const,
    [normalizeClubName(crest.id), crest.id] as const,
  ]),
);

/**
 * Stable identity for a club, independent of the display label used by a card
 * or by an online/bot team. Chemistry and filters must use this value instead
 * of comparing the human-readable `club` string directly.
 */
export function clubIdForName(club: string | undefined | null): string {
  if (!club) return '';
  const normalized = normalizeClubName(club);
  return CLUB_CREST_ALIASES[normalized] ?? CREST_ID_BY_NORMALIZED_NAME.get(normalized) ?? normalized;
}

/** Returns the catalogue's preferred display label for a club when available. */
export function canonicalClubName(club: string | undefined | null): string {
  if (!club) return '';
  const id = clubIdForName(club);
  return CRESTS_BY_ID[id]?.name ?? club;
}

export function sameClub(a: string | undefined | null, b: string | undefined | null): boolean {
  return !!a && !!b && clubIdForName(a) === clubIdForName(b);
}

/** Resolves a player/team display name to the canonical crest id. */
export function crestIdForClub(club: string | undefined | null): string | null {
  if (!club) return null;
  const id = clubIdForName(club);
  return CRESTS_BY_ID[id] ? id : null;
}

export function getCrest(id: string | undefined | null): CrestDef | null {
  return id ? (CRESTS_BY_ID[id] ?? null) : null;
}

// Maps the built-in bot team display names to a matching crest id, so bots show a real
// badge too. Names without an entry fall back to an initials badge (see <Crest>).
export const BOT_CREST_MAP: Record<string, string> = {
  'Real Madrid': 'real-madrid',
  'Manchester City': 'manchester-city',
  'Bayern München': 'bayern-munich',
  'Paris Saint-Germain': 'paris-saint-germain',
  'Liverpool FC': 'liverpool',
  'Inter de Milão': 'inter-milan',
  'Arsenal FC': 'arsenal',
  'FC Barcelona': 'barcelona',
  'Borussia Dortmund': 'borussia-dortmund',
  'Juventus FC': 'juventus',
  'Atlético de Madrid': 'atletico-madrid',
  'Bayer Leverkusen': 'bayer-leverkusen',
  'AC Milan': 'milan',
  'Benfica Glorioso': 'benfica',
  'Sporting CP': 'sporting-cp',
  'FC Porto': 'porto',
  'Ajax Legends': 'ajax',
  'PSV Eindhoven': 'psv',
  'Feyenoord Roterdã': 'feyenoord',
  'Aston Villa': 'aston-villa',
  'Atalanta Bergamo': 'atalanta',
  'AS Monaco': 'monaco',
  'Lille OSC': 'lille',
  'VfB Stuttgart': 'stuttgart',
  'Bologna FC': 'bologna',
  'Celtic FC': 'celtic',
  'Club Brugge': 'club-brugge',
  'Shakhtar Donetsk': 'shakhtar-donetsk',
  'Real Betis': 'real-betis',
  'Dynamo Kyiv': 'dynamo-kyiv',
  'RB Salzburg': 'red-bull-salzburg',
  'Lazio Roma': 'lazio',
  'Estrela Vermelha': 'red-star',
  'Young Boys Bern': 'young-boys',
  'Sparta Praga': 'sparta-prague',
  'Dinamo Zagreb': 'dinamo-zagreb',
  'Girona FC': 'girona',
};
