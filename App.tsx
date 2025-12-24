import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Play, Pause, SkipForward, SkipBack, Upload, Music, Shuffle, Repeat, Sparkles, Trash2, Volume2, VolumeX } from 'lucide-react';
import { GoogleGenAI } from '@google/genai';
import { VinylDisk } from './components/VinylDisk';
import { Visualizer } from './components/Visualizer';
import { formatTime } from './utils/formatTime';
import { Track } from './types';

// NOTE: In a real production app, move API keys to backend proxy.
// Here we rely on the injected process.env.API_KEY as per instructions.

export default function App() {
  // State
  const [playlist, setPlaylist] = useState<Track[]>([]);
  const [currentTrackIndex, setCurrentTrackIndex] = useState<number>(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [isShuffle, setIsShuffle] = useState(false);
  
  // Audio & AI
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  
  // AI Analysis State
  const [aiAnalysis, setAiAnalysis] = useState<string>("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Initialize Audio Context lazily on user interaction
  const initAudioContext = () => {
    if (!audioContextRef.current) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioContextClass();
      audioContextRef.current = ctx;
      
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;

      if (audioRef.current) {
        // Fix for CORS issues if we were fetching remote, but for local blobs this is fine
        const source = ctx.createMediaElementSource(audioRef.current);
        source.connect(analyser);
        analyser.connect(ctx.destination);
        sourceRef.current = source;
      }
    } else if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }
  };

  // Drag and Drop Handlers
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files) as File[];
      const newFiles = files.filter(file => file.type.startsWith('audio/'));
      const newTracks: Track[] = newFiles.map(file => ({
        file,
        id: crypto.randomUUID(),
        name: file.name.replace(/\.[^/.]+$/, "")
      }));
      
      setPlaylist(prev => {
        const updated = [...prev, ...newTracks];
        // If it's the first track added, select it but don't play yet
        if (prev.length === 0 && updated.length > 0) {
           // We won't auto-set index to avoid auto-play blocking policies until user clicks
        }
        return updated;
      });
    }
  }, []);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
       const files = Array.from(e.target.files) as File[];
       const newFiles = files.filter(file => file.type.startsWith('audio/'));
       const newTracks: Track[] = newFiles.map(file => ({
        file,
        id: crypto.randomUUID(),
        name: file.name.replace(/\.[^/.]+$/, "")
      }));
      setPlaylist(prev => [...prev, ...newTracks]);
    }
  };

  // Playback Control
  const playTrack = async (index: number) => {
    initAudioContext();
    if (index < 0 || index >= playlist.length) return;

    const track = playlist[index];
    if (!audioRef.current) return;

    // Revoke old URL to avoid memory leaks
    if (audioRef.current.src) {
      URL.revokeObjectURL(audioRef.current.src);
    }

    const objectUrl = URL.createObjectURL(track.file);
    audioRef.current.src = objectUrl;
    setCurrentTrackIndex(index);
    
    try {
      await audioRef.current.play();
      setIsPlaying(true);
    } catch (err) {
      console.error("Playback error:", err);
      setIsPlaying(false);
    }
  };

  const togglePlay = () => {
    if (!audioRef.current) return;
    
    // If no track selected, play first
    if (currentTrackIndex === -1 && playlist.length > 0) {
      playTrack(0);
      return;
    }

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      initAudioContext();
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const nextTrack = () => {
    if (playlist.length === 0) return;
    let nextIndex;
    if (isShuffle) {
      nextIndex = Math.floor(Math.random() * playlist.length);
    } else {
      nextIndex = (currentTrackIndex + 1) % playlist.length;
    }
    playTrack(nextIndex);
  };

  const prevTrack = () => {
    if (playlist.length === 0) return;
    let prevIndex = (currentTrackIndex - 1 + playlist.length) % playlist.length;
    playTrack(prevIndex);
  };

  const removeTrack = (e: React.MouseEvent, index: number) => {
    e.stopPropagation();
    const newPlaylist = [...playlist];
    newPlaylist.splice(index, 1);
    setPlaylist(newPlaylist);
    if (index === currentTrackIndex) {
      setIsPlaying(false);
      if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
      }
      setCurrentTrackIndex(-1);
    } else if (index < currentTrackIndex) {
      setCurrentTrackIndex(currentTrackIndex - 1);
    }
  };

  // Audio Event Listeners
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => setCurrentTime(audio.currentTime);
    const updateDuration = () => setDuration(audio.duration);
    const onEnded = () => nextTrack();

    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('loadedmetadata', updateDuration);
    audio.addEventListener('ended', onEnded);

    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('loadedmetadata', updateDuration);
      audio.removeEventListener('ended', onEnded);
    };
  }, [playlist, currentTrackIndex, isShuffle]); // Re-bind onEnded because it depends on nextTrack state

  // Volume
  useEffect(() => {
    if(audioRef.current) {
        audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);


  // Gemini Analysis
  const analyzePlaylist = async () => {
    if (playlist.length === 0) return;
    setIsAnalyzing(true);
    setAiAnalysis("");

    try {
      // Check for API Key validity before call
      if (!process.env.API_KEY) {
        setAiAnalysis("API Key Missing. Cannot analyze.");
        setIsAnalyzing(false);
        return;
      }

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const trackNames = playlist.map(t => t.name).join(", ");
      
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Analysing the following song list: ${trackNames}. 
        Provide a short, poetic, and cool description in Chinese (Simple Chinese) about the "vibe" or atmosphere of this playlist. 
        Are we in a jazz club, a cyberpunk city, or a quiet rainy day? Keep it under 60 words.`,
      });
      
      setAiAnalysis(response.text as string);
    } catch (error) {
      console.error("Gemini Error:", error);
      setAiAnalysis("无法连接到 AI 大脑进行分析 (Connection Error).");
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div 
      className="min-h-screen bg-slate-900 text-white overflow-hidden flex flex-col md:flex-row pb-safe" // pb-safe ensures content isn't hidden by iPhone home bar
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
      <audio ref={audioRef} crossOrigin="anonymous" />
      
      {/* LEFT PANEL: Player & Visuals */}
      <div className="flex-1 relative flex flex-col items-center justify-center p-4 md:p-8 bg-gradient-to-b from-slate-900 via-slate-800 to-black overflow-hidden shrink-0 min-h-[50vh]">
        
        {/* Background Visualizer Layer */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            {analyserRef.current && (
                <Visualizer analyser={analyserRef.current} isPlaying={isPlaying} />
            )}
        </div>

        {/* Vinyl Player - Smaller on mobile */}
        <div className="z-10 transform scale-75 sm:scale-90 md:scale-100 transition-all">
          <VinylDisk isPlaying={isPlaying} />
        </div>

        {/* Track Info (Overlay) */}
        <div className="z-20 mt-4 md:mt-12 text-center max-w-xs md:max-w-md w-full">
            <h1 className="text-xl md:text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-purple-400 truncate px-4">
                {currentTrackIndex !== -1 ? playlist[currentTrackIndex].name : "选择音乐 (Select Music)"}
            </h1>
            <p className="text-gray-400 mt-2 font-mono text-xs md:text-sm">
                {currentTrackIndex !== -1 ? `${formatTime(currentTime)} / ${formatTime(duration)}` : "--:-- / --:--"}
            </p>
        </div>

        {/* Main Controls */}
        <div className="z-20 mt-6 md:mt-8 flex flex-col items-center w-full max-w-xs md:max-w-md gap-4 md:gap-6">
            
            {/* Progress Bar */}
            <input 
                type="range" 
                min="0" 
                max={duration || 100} 
                value={currentTime} 
                onChange={(e) => {
                    if(audioRef.current) {
                        audioRef.current.currentTime = Number(e.target.value);
                    }
                }}
                className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-cyan-500 hover:accent-cyan-400 transition-all touch-none"
            />

            {/* Buttons */}
            <div className="flex items-center gap-4 md:gap-8">
                <button 
                    onClick={() => setIsShuffle(!isShuffle)}
                    className={`p-2 rounded-full transition-colors ${isShuffle ? 'text-cyan-400 bg-white/10' : 'text-gray-500 hover:text-white'}`}
                >
                    <Shuffle size={20} />
                </button>

                <button onClick={prevTrack} className="p-3 text-gray-300 hover:text-white active:scale-95 transition-transform">
                    <SkipBack size={28} fill="currentColor" />
                </button>

                <button 
                    onClick={togglePlay} 
                    className="p-4 bg-cyan-500 rounded-full text-black hover:bg-cyan-400 active:scale-95 transition-all shadow-[0_0_20px_rgba(34,211,238,0.5)]"
                >
                    {isPlaying ? <Pause size={32} fill="currentColor" /> : <Play size={32} fill="currentColor" className="ml-1" />}
                </button>

                <button onClick={nextTrack} className="p-3 text-gray-300 hover:text-white active:scale-95 transition-transform">
                    <SkipForward size={28} fill="currentColor" />
                </button>

                 <div className="flex items-center gap-2 group relative">
                    <button 
                        onClick={() => setIsMuted(!isMuted)}
                        className="text-gray-400 hover:text-white"
                    >
                        {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
                    </button>
                    {/* Volume Slider visible on hover (desktop) or tap (mobile needs care but good enough for now) */}
                    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 hidden group-hover:block bg-gray-800 p-2 rounded shadow-lg z-50">
                        <input 
                            type="range" 
                            min="0" 
                            max="1" 
                            step="0.01" 
                            value={volume}
                            onChange={(e) => setVolume(parseFloat(e.target.value))}
                            className="h-24 w-1 appearance-none bg-gray-600 rounded accent-cyan-500"
                            style={{ writingMode: 'vertical-lr', direction: 'rtl' }} 
                        />
                    </div>
                 </div>
            </div>
        </div>
      </div>

      {/* RIGHT PANEL: Playlist (Bottom on mobile) */}
      <div className="w-full md:w-96 bg-slate-900/90 border-t md:border-t-0 md:border-l border-slate-800 flex flex-col h-[40vh] md:h-full z-30 shadow-2xl backdrop-blur-md pb-safe">
        
        {/* Header */}
        <div className="p-4 md:p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900 sticky top-0 z-40">
            <h2 className="text-lg md:text-xl font-bold flex items-center gap-2 text-white">
                <Music size={20} className="text-cyan-400" />
                播放列表
            </h2>
            <div className="flex gap-2">
                 <label className="cursor-pointer px-3 py-2 bg-cyan-600 hover:bg-cyan-500 rounded-md transition-colors text-xs font-bold text-white flex items-center gap-1 shadow-md active:scale-95">
                    <Upload size={14} />
                    导入歌曲
                    <input 
                        type="file" 
                        accept="audio/*" 
                        multiple 
                        onChange={handleFileSelect} 
                        className="hidden" 
                    />
                 </label>
            </div>
        </div>

        {/* Gemini AI Zone */}
        <div className="p-3 md:p-4 bg-gradient-to-r from-indigo-900/50 to-purple-900/50 border-b border-white/5 shrink-0">
            <div className="flex justify-between items-center mb-1 md:mb-2">
                <span className="text-xs font-bold text-indigo-300 uppercase tracking-widest flex items-center gap-1">
                    <Sparkles size={12} /> AI 氛围
                </span>
                <button 
                    onClick={analyzePlaylist}
                    disabled={isAnalyzing || playlist.length === 0}
                    className="text-[10px] md:text-xs bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 px-2 py-1 rounded text-white transition-colors"
                >
                    {isAnalyzing ? "分析中..." : "AI 分析"}
                </button>
            </div>
            <p className="text-xs md:text-sm text-gray-300 italic min-h-[30px] md:min-h-[40px] leading-relaxed line-clamp-2 md:line-clamp-none">
                {aiAnalysis || (playlist.length === 0 ? "添加音乐以启用 AI 分析..." : "点击 AI 按钮解读歌单。")}
            </p>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto no-scrollbar p-2">
            {playlist.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-500 border-2 border-dashed border-gray-700 rounded-xl m-4 p-4 text-center">
                    <Upload size={32} className="mb-2 opacity-50" />
                    <p className="text-sm">点击右上角“导入”</p>
                    <p className="text-xs mt-1 text-gray-600">或在电脑上拖入文件</p>
                </div>
            ) : (
                <ul className="space-y-1 pb-4">
                    {playlist.map((track, index) => (
                        <li 
                            key={track.id}
                            onClick={() => playTrack(index)}
                            className={`
                                group flex items-center justify-between p-3 rounded-lg cursor-pointer transition-all border border-transparent
                                ${currentTrackIndex === index 
                                    ? 'bg-white/10 border-cyan-500/30 shadow-[0_0_15px_rgba(0,0,0,0.3)]' 
                                    : 'hover:bg-white/5 hover:border-white/10'}
                            `}
                        >
                            <div className="flex items-center gap-3 overflow-hidden">
                                <span className={`text-xs font-mono w-4 text-center ${currentTrackIndex === index ? 'text-cyan-400' : 'text-gray-600'}`}>
                                    {currentTrackIndex === index ? <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse mx-auto"/> : index + 1}
                                </span>
                                <span className={`truncate text-sm font-medium ${currentTrackIndex === index ? 'text-white' : 'text-gray-300'}`}>
                                    {track.name}
                                </span>
                            </div>
                            <button 
                                onClick={(e) => removeTrack(e, index)}
                                className="md:opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 transition-opacity p-2 md:p-1"
                            >
                                <Trash2 size={16} />
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
        
        {/* Footer info */}
        <div className="p-2 text-center text-[10px] text-gray-600 border-t border-slate-800 bg-slate-900 shrink-0">
             {playlist.length} 首歌曲
        </div>

      </div>
    </div>
  );
}