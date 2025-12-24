export interface Track {
  file: File;
  id: string;
  name: string;
}

export interface AudioVisualizerState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
}
