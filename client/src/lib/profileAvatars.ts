/** Official character portrait assets from the Inazugle character catalog. */
export const PROFILE_AVATARS = [
  { key: 'mark-evans', name: 'Mark Evans', src: '/avatars/inazuma/mark-evans.webp' },
  { key: 'axel-blaze', name: 'Axel Blaze', src: '/avatars/inazuma/axel-blaze.webp' },
  { key: 'jude-sharp', name: 'Jude Sharp', src: '/avatars/inazuma/jude-sharp.webp' },
  { key: 'nathan-swift', name: 'Nathan Swift', src: '/avatars/inazuma/nathan-swift.webp' },
  { key: 'jack-wallside', name: 'Jack Wallside', src: '/avatars/inazuma/jack-wallside.webp' },
  { key: 'kevin-dragonfly', name: 'Kevin Dragonfly', src: '/avatars/inazuma/kevin-dragonfly.webp' },
  { key: 'tod-ironside', name: 'Tod Ironside', src: '/avatars/inazuma/tod-ironside.webp' },
  { key: 'steve-grim', name: 'Steve Grim', src: '/avatars/inazuma/steve-grim.webp' },
  { key: 'maxwell-carson', name: 'Maxwell Carson', src: '/avatars/inazuma/maxwell-carson.webp' },
  { key: 'tim-saunders', name: 'Tim Saunders', src: '/avatars/inazuma/tim-saunders.webp' },
  { key: 'sam-kincaid', name: 'Sam Kincaid', src: '/avatars/inazuma/sam-kincaid.webp' },
  { key: 'shawn-froste', name: 'Shawn Froste', src: '/avatars/inazuma/shawn-froste.webp' },
  { key: 'erik-eagle', name: 'Erik Eagle', src: '/avatars/inazuma/erik-eagle.webp' },
  { key: 'bobby-shearer', name: 'Bobby Shearer', src: '/avatars/inazuma/bobby-shearer.webp' },
  { key: 'celia-hills', name: 'Celia Hills', src: '/avatars/inazuma/celia-hills.webp' },
  { key: 'joseph-king', name: 'Joseph King', src: '/avatars/inazuma/joseph-king.webp' },
  { key: 'xavier-foster', name: 'Xavier Foster', src: '/avatars/inazuma/xavier-foster.webp' },
  { key: 'arion-sherwind', name: 'Arion Sherwind', src: '/avatars/inazuma/arion-sherwind.webp' },
  { key: 'victor-blade', name: 'Victor Blade', src: '/avatars/inazuma/victor-blade.webp' },
  { key: 'riccardo-di-rigo', name: 'Riccardo Di Rigo', src: '/avatars/inazuma/riccardo-di-rigo.webp' },
  { key: 'bailong', name: 'Bailong', src: '/avatars/inazuma/bailong.webp' },
  { key: 'nelly-raimon', name: 'Nelly Raimon', src: '/avatars/inazuma/nelly-raimon.webp' },
  { key: 'david-samford', name: 'David Samford', src: '/avatars/inazuma/david-samford.webp' },
  { key: 'jim-wraith', name: 'Jim Wraith', src: '/avatars/inazuma/jim-wraith.webp' },
  { key: 'silvia-woods', name: 'Silvia Woods', src: '/avatars/inazuma/silvia-woods.webp' },
  { key: 'darren-lachance', name: 'Darren LaChance', src: '/avatars/inazuma/darren-lachance.webp' },
  { key: 'byron-love', name: 'Byron Love', src: '/avatars/inazuma/byron-love.webp' },
  { key: 'caleb-stonewall', name: 'Caleb Stonewall', src: '/avatars/inazuma/caleb-stonewall.webp' },
  { key: 'hector-helio', name: 'Hector Helio', src: '/avatars/inazuma/hector-helio.webp' },
  { key: 'goldie-lemmon', name: 'Goldie Lemmon', src: '/avatars/inazuma/goldie-lemmon.webp' },
  { key: 'sol-daystar', name: 'Sol Daystar', src: '/avatars/inazuma/sol-daystar.webp' },
  { key: 'fei-rune', name: 'Fei Rune', src: '/avatars/inazuma/fei-rune.webp' },
  { key: 'zanark-avalonic', name: 'Zanark Avalonic', src: '/avatars/inazuma/zanark-avalonic.webp' },
  { key: 'tori-vanguard', name: 'Victoria Vanguard', src: '/avatars/inazuma/tori-vanguard.webp' },
  { key: 'paolo-bianchi', name: 'Paolo Bianchi', src: '/avatars/inazuma/paolo-bianchi.webp' },
  { key: 'jp-lapin', name: 'Jean-Pierre Lapin', src: '/avatars/inazuma/jp-lapin.webp' },
] as const;

export type ProfileAvatarKey = (typeof PROFILE_AVATARS)[number]['key'];

export function getProfileAvatar(key: string) {
  return PROFILE_AVATARS.find(avatar => avatar.key === key);
}

export function normalizeProfileAvatarKey(key: string): ProfileAvatarKey {
  return getProfileAvatar(key)?.key ?? 'mark-evans';
}

export function resolveProfileAvatarImage(key: string): string | null {
  // Existing accounts may still have one of the old text-only default avatars.
  return getProfileAvatar(key)?.src ?? (key.startsWith('default-') ? PROFILE_AVATARS[0].src : null);
}
