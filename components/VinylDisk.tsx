import React from 'react';

interface VinylDiskProps {
  isPlaying: boolean;
  coverArt?: string;
}

export const VinylDisk: React.FC<VinylDiskProps> = ({ isPlaying, coverArt }) => {
  return (
    <div className="relative w-64 h-64 sm:w-80 sm:h-80 md:w-96 md:h-96 flex-shrink-0">
      {/* Vinyl Record */}
      <div 
        className={`absolute inset-0 rounded-full shadow-2xl border-4 border-gray-900 bg-black vinyl-grooves flex items-center justify-center transition-transform duration-[2000ms] ${isPlaying ? 'animate-[spin_4s_linear_infinite]' : ''}`}
        style={{ animationPlayState: isPlaying ? 'running' : 'paused' }}
      >
        {/* Label/Cover Art in Center */}
        <div className="w-1/3 h-1/3 rounded-full overflow-hidden border-2 border-gray-700 relative z-10 bg-gradient-to-br from-indigo-500 to-purple-600">
           {coverArt ? (
             <img src={coverArt} alt="Cover" className="w-full h-full object-cover" />
           ) : (
             <div className="w-full h-full flex items-center justify-center text-xs text-white opacity-80">
                Hi-Fi
             </div>
           )}
        </div>
      </div>

      {/* Tone Arm (Stylized) */}
      <div 
        className={`absolute -top-10 -right-10 w-32 h-40 origin-top-right transition-transform duration-700 ease-in-out z-20 pointer-events-none drop-shadow-xl`}
        style={{ transform: isPlaying ? 'rotate(25deg)' : 'rotate(0deg)' }}
      >
         {/* Pivot */}
         <div className="absolute top-2 right-2 w-12 h-12 bg-gray-400 rounded-full border-4 border-gray-600 shadow-inner"></div>
         {/* Arm */}
         <div className="absolute top-8 right-6 w-2 h-32 bg-gray-300 transform -rotate-12 origin-top"></div>
         {/* Head */}
         <div className="absolute bottom-4 left-6 w-8 h-12 bg-gray-800 rounded shadow-lg transform rotate-12"></div>
      </div>
    </div>
  );
};
