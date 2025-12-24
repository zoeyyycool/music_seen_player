import React, { useRef, useEffect } from 'react';

interface VisualizerProps {
  analyser: AnalyserNode | null;
  isPlaying: boolean;
}

export const Visualizer: React.FC<VisualizerProps> = ({ analyser, isPlaying }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    if (!canvasRef.current || !analyser) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      if (!isPlaying) {
        // Clear canvas with a fade effect or just clear
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        return;
      }
      
      animationRef.current = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(dataArray);

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      // Radius matches the vinyl size roughly + padding
      const radius = Math.min(centerX, centerY) * 0.55; 

      // Draw bars
      const bars = 120; // Number of bars
      const step = Math.floor(bufferLength / bars); 
      
      for (let i = 0; i < bars; i++) {
        // Average out a chunk of frequencies for smoother visual
        let value = 0;
        for(let j = 0; j < step; j++) {
            value += dataArray[i * step + j];
        }
        value = value / step;

        const barHeight = (value / 255) * 100; // Scale height
        const rads = (Math.PI * 2) * (i / bars);
        
        // Calculate start and end points
        const xStart = centerX + Math.cos(rads) * radius;
        const yStart = centerY + Math.sin(rads) * radius;
        const xEnd = centerX + Math.cos(rads) * (radius + barHeight);
        const yEnd = centerY + Math.sin(rads) * (radius + barHeight);

        // Draw bar
        ctx.beginPath();
        ctx.moveTo(xStart, yStart);
        ctx.lineTo(xEnd, yEnd);
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        
        // Dynamic Color based on frequency intensity
        const hue = (i / bars) * 360;
        const saturation = 80 + (value / 255) * 20;
        const lightness = 50 + (value / 255) * 10;
        
        ctx.strokeStyle = `hsla(${hue}, ${saturation}%, ${lightness}%, 0.8)`;
        ctx.stroke();
      }
    };

    draw();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [analyser, isPlaying]);

  return (
    <canvas 
      ref={canvasRef} 
      width={800} 
      height={800} 
      className="absolute inset-0 w-full h-full pointer-events-none z-0 opacity-80"
    />
  );
};