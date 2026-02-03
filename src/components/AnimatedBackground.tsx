"use client";

export default function AnimatedBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {/* base gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-sky-100 via-blue-50 to-white" />

      {/* soft blobs */}
      <div className="absolute -top-32 -left-24 h-[520px] w-[520px] rounded-full bg-sky-300/30 blur-[90px]" />
      <div className="absolute top-1/3 -right-32 h-[620px] w-[620px] rounded-full bg-indigo-300/20 blur-[110px]" />
      <div className="absolute -bottom-40 left-1/3 h-[640px] w-[640px] rounded-full bg-cyan-200/25 blur-[120px]" />

      {/* subtle light */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.9),transparent_60%)]" />

      {/* noise */}
      <div className="absolute inset-0 opacity-[0.05] bg-noise" />
    </div>
  );
}
