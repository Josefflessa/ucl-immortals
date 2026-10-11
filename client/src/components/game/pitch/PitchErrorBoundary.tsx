import { Component, type ReactNode } from 'react';

/** The pitch is decoration over the narration: if it ever throws, the match goes on without it. */
export default class PitchErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error('[pitch] o campo ao vivo falhou e foi desligado nesta partida:', error);
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}
