/**
 * Dev-only: hear every match sound option side by side (#sons), to pick which one the match
 * uses. The match plays the files in /sounds; the options are in /sounds/options.
 */
import { matchAudio, type MatchSound } from '../../audio/matchAudio';
import { playSound, UI_SOUND_NAMES, type UiSound } from '../../audio/uiSound';

/** The interface sounds, by family (all synthesised: nothing to download). */
const UI_GROUPS: { title: string; sounds: UiSound[] }[] = [
  { title: 'Interface', sounds: ['tap', 'select', 'tab', 'confirm', 'back', 'toggleOn', 'toggleOff'] },
  { title: 'Avisos', sounds: ['error', 'success', 'notify', 'message'] },
  { title: 'Moedas e recompensas', sounds: ['coin', 'spend', 'claim', 'achievement'] },
  { title: 'Pacotes de cartas', sounds: ['packTear', 'revealBronze', 'revealSilver', 'revealGold', 'revealLegendary', 'revealImmortal'] },
  { title: 'Título', sounds: ['champion'] },
];
// Anything added to the catalogue but not grouped above still shows up.
const UNGROUPED = UI_SOUND_NAMES.filter(name => !UI_GROUPS.some(group => group.sounds.includes(name)));

const SOUNDS: { name: string; file: string; label: string; options: string[] }[] = [
  { name: 'Torcida de fundo (loop)', file: 'torcida', label: 'Constante durante a partida', options: ['a', 'b'] },
  { name: 'Gol', file: 'gol', label: 'Quando a bola entra (C e D: explosão)', options: ['a', 'b', 'c', 'd'] },
  { name: 'Defesa', file: 'defesa', label: 'Quando o goleiro defende', options: ['a'] },
  { name: 'Para fora', file: 'fora', label: 'Chute para fora, bloqueado ou tirado', options: [] },
  { name: 'Trave', file: 'trave', label: 'Trave ou travessão', options: ['a', 'b'] },
];

/** Through the match's own sound engine: synthesised whistles, levelled as in a match. */
const ENGINE: { sound: MatchSound; label: string }[] = [
  { sound: 'whistleStart', label: 'Apito inicial (sintetizado)' },
  { sound: 'whistleEnd', label: 'Apito final (sintetizado)' },
  { sound: 'goal', label: 'Gol (como na partida)' },
  { sound: 'save', label: 'Defesa (como na partida)' },
  { sound: 'miss', label: 'Para fora (como na partida)' },
  { sound: 'post', label: 'Trave (como na partida)' },
];

export default function SoundsPage() {
  const button = 'rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm font-bold text-white hover:bg-white/10';
  return (
    <div className="min-h-screen bg-[#0b0b14] p-4 text-white">
      <h1 className="mb-1 text-xl font-black">Sons da partida</h1>
      <p className="mb-4 text-sm text-white/60">Ouça as opções de cada som. "Em uso" é o arquivo que a partida toca hoje.</p>
      <div className="mb-4 flex max-w-3xl flex-wrap gap-2">
        {ENGINE.map(e => (
          <button key={e.sound} type="button" className={button} onClick={() => { void matchAudio.load().then(() => matchAudio.play(e.sound)); }}>▶ {e.label}</button>
        ))}
      </div>
      {[...UI_GROUPS, ...(UNGROUPED.length ? [{ title: 'Outros', sounds: UNGROUPED }] : [])].map(group => (
        <div key={group.title} className="mb-4 max-w-3xl">
          <div className="mb-2 text-xs font-black tracking-widest text-yellow-400">{group.title.toUpperCase()}</div>
          <div className="flex flex-wrap gap-2">
            {group.sounds.map(name => <button key={name} type="button" data-sound="none" className={button} onClick={() => playSound(name)}>{name}</button>)}
          </div>
        </div>
      ))}
      <div className="grid max-w-3xl gap-3">
        {SOUNDS.map(s => (
          <div key={s.file} className="rounded-xl border border-white/10 bg-white/5 p-3">
            <div className="mb-2 flex items-baseline justify-between gap-2">
              <span className="font-black">{s.name}</span>
              <span className="text-xs text-white/50">{s.label}</span>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="flex items-center gap-2 text-xs text-yellow-400">Em uso <audio controls preload="none" src={`/sounds/${s.file}.mp3`} loop={s.file === 'torcida'} /></span>
              {s.options.map(o => (
                <span key={o} className="flex items-center gap-2 text-xs text-white/70">Opção {o.toUpperCase()} <audio controls preload="none" src={`/sounds/options/${s.file}-${o}.mp3`} loop={s.file === 'torcida'} /></span>
              ))}
            </div>
          </div>
        ))}
        <button type="button" className={button} onClick={() => history.back()}>Voltar</button>
      </div>
    </div>
  );
}
