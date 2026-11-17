import { useState } from 'react';

export function WebGLFallback() {
  const [imgError, setImgError] = useState(false);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#060709] p-6">
      {!imgError && (
        <img
          src="/src/assets/images/forest_cabin_night_1794954987139.jpg"
          alt="Isolated wooden cabin in a misty pine forest at night"
          referrerPolicy="no-referrer"
          onError={() => setImgError(true)}
          className="absolute inset-0 w-full h-full object-cover opacity-35"
        />
      )}
      <div className="relative max-w-md w-full bg-[#0d0f13]/95 border border-white/15 rounded-md p-8 text-center">
        <h1 className="font-display text-4xl font-semibold text-[#EAE6DF] mb-3">
          The Hollow Ward
        </h1>
        <p className="text-sm text-[#c4beb4] leading-relaxed mb-5">
          3D WebGL rendering is unavailable in this browser session. Enable hardware acceleration or
          open in a WebGL-capable browser to enter Pine Creek Cabin.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="px-5 py-2.5 text-xs font-semibold text-[#07080A] bg-[#EAE6DF] rounded-md hover:bg-white transition-colors cursor-pointer"
        >
          Retry Initialization
        </button>
      </div>
    </div>
  );
}
