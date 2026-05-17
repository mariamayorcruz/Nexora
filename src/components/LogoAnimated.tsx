import type { CSSProperties } from 'react';

const LOGO_PATHS = [
  { transform: 'translate(482,302)', d: 'm0 0h60l29 1-2 4-10 10-12 8-10 4-9 2-10 1-30 1-25 3-18 5-16 7-16 9-11 9-8 7-10 14-7 16-4 16v14l2 7 8 1 8-4 10-9 9-10 15-14 10-8 17-12 17-9 16-6 11-2h17l13 5 11 9 4 5v2h2l39 52 4 5-2-18v-40l3-15 5-12 7-11 8-8 13-9 12-7 3-1 5-5 5 1-2 3-1 7 4 5 4 2h6l6-3 2-6 3 1 2-2v12l-4 6-8 5h-13l-13 8-4 4h-2l-2 4-6 10-4 16-1 11v40l1 31-3 5-11 7-3 1h-16l-11-6-14-14-13-18-22-34-8-10-8-6-7-2v8l-4 22-5 18-8 19-8 15-9 12-9 11-5 8-7 5-14 1-10 4-8 2h-21l-13-4-13-7-7-6-11-14-6-13-4-14-1-11 2 1 4 12 6 11 11 12 12 7 10 3h17l10-3 13-7 6-7 9-6 9-12 6-11 5-12 4-14 2-12v-5l-10 7-11 9-15 14-8 7-10 8-14 7-9 2-13-1-10-5-8-9-4-10-2-13 1-16 4-17 6-15 9-16 10-13 4-10 5-4 2 4v7l5 5 9-1 4-4v-9l1-3-3-2h-9l-4 2-2-2 5-2 7-1 14-8 10-5 24-8 24-5z', fill: '#03BCFC' },
  { transform: 'translate(667,367)', d: 'm0 0h3v39l-2 29-5 23-7 19-6 11-8 11-7 8-10 8-16 8-11 3-6 1h-11l-14-3-12-5-12-8-15-15-11-16-5-10 1-9 8-27 3 3 10 17 10 14 8 10 9 9 10 7 12 4h13l10-4 8-6h2l2-4 6-8 8-16 4-15 3-17 1-11 1-35 14-8z', fill: '#4F3AF9' },
  { transform: 'translate(482,302)', d: 'm0 0h60l29 1-2 4-10 10-12 8-10 4-9 2-10 1-30 1-25 3-18 5-16 7-16 9-11 9-8 7-10 14-6 13h-2l-1 2-2-1-1-5-9-2-2-8h-2v5l-3-1-1-8 9-17 10-13 3-5 3-8 5-4 2 4v7l5 5 9-1 4-4v-9l1-3-3-2h-9l-4 2-2-2 5-2 7-1 14-8 10-5 24-8 24-5z', fill: '#03BDFC' },
  { transform: 'translate(487,396)', d: 'm0 0h10v9l-4 22-5 18-8 19-8 15-9 12-9 11-5 8-7 5-14 1-10 4-8 2h-21l-13-4-13-7-7-6-11-14-6-13-4-14-1-11 2 1 4 12 6 11 11 12 12 7 10 3h17l10-3 13-7 6-7 9-6 9-12 6-11 5-12 4-14 3-19 10-6 11-5z', fill: '#03BEFD' },
  { transform: 'translate(639,319)', d: 'm0 0 6 1-2 3-1 7 4 5 4 2h6l6-3 2-6 3 1 2-2v12l-4 6-8 5h-13l-13 8-4 4h-2l-2 4-6 10-4 16-1 11v40l1 31-3 5-11 7-3 1h-16l-11-6-14-14-1-7 2 1v2h6l7-3 15-6v-6l-3-2 3-3 2 2-2-18v-40l3-15 5-12 7-11 8-8 13-9 12-7 3-1z', fill: '#5B51F9' },
  { transform: 'translate(355,383)', d: 'm0 0 2 2v5l1-4 1-2 3 2 1 8 9 1 2 5h3l-2 9-2 10v14l2 7 8 1 8-4 10-9 9-10 5-5h2v2h-2l2 7 4 2 3 3v3l2 1-1 2 6-3 2 1-9 9-8 7-10 8-14 7-9 2-13-1-10-5-8-9-4-10-2-13 1-16 4-17z', fill: '#414AB1' },
  { transform: 'translate(667,367)', d: 'm0 0h3v39l-2 29-5 23-7 19-6 11-2 1 2-6 2-3-1-4-4-6-3-6-5-2v-4l-3 1-1 2h-2l-3 9-6 10-2 1 2-5 8-16 4-15 3-17 1-11 1-35 14-8z', fill: '#5A50F5' },
  { transform: 'translate(487,396)', d: 'm0 0h10v9l-4 22-5 18-8 19-8 15-4 4v-6-1l-4-3v-7l-5-5-3-1-2-5-1 2-4 2-3 2 8-20 4-14 3-19 10-6 11-5z', fill: '#4249AF' },
  { transform: 'translate(357,590)', d: 'm0 0h10l9 3 8 6 4 9v13l-4 9h-2v2l-10 6-5 1h-10l-9-3-7-6-4-8-1-9 2-8 4-7 5-4 6-3z', fill: '#0490FC' },
  { transform: 'translate(300,570)', d: 'm0 0h14l11 3 4 3v8l-2 3-10-4-5-1h-10l-10 3-7 6-4 11 1 10 4 8 6 5 6 2h14l6-2 1-13h-14v-9l9-1h15v31l-9 4-10 2h-11l-12-3-10-7-5-6-4-12v-11l4-13 8-9 11-6z', fill: '#0590FB' },
  { transform: 'translate(618,590)', d: 'm0 0h7l10 3 8 7 4 11v8l-4 10-8 7-8 3h-11l-9-3-7-6-4-9v-13l4-8 8-7z', fill: '#5450EF' },
  { transform: 'translate(434,572)', d: 'm0 0h11l11 14 10 12 10 13 6 8 1-47h10v66h-10l-13-16-22-28-3-4-1 48h-10z', fill: '#5152F0' },
  { transform: 'translate(584,390)', d: 'm0 0h1l1 34 2 15 1 5 4-5h13l2 1 2-40h1l2 74-3 5-11 7-3 1h-16l-11-6-14-14-1-7 2 1v2h6l7-3 15-6v-6l-3-2 3-3 2 2-2-18z', fill: '#5A50FA' },
  { transform: 'translate(518,410)', d: 'm0 0 8 8 1-2 3-1 7 2 15-1 4-2 5 5 4-1 12 15 6 8-1 5h3l-1 8-11 6-10 3-4 1-3-1v2l-4-2-12-17-9-14-11-17z', fill: '#058EFB' },
  { transform: 'translate(334,453)', d: 'm0 0 2 1 4 12 6 11 11 12 12 7 10 3h17l10-3 11-6h2v11l3 6 5 5 2 1h14l-1 2-14 1-10 4-8 2h-21l-13-4-13-7-7-6-11-14-6-13-4-14z', fill: '#048EFC' },
  { transform: 'translate(521,434)', d: 'm0 0 3 3 10 17 10 14 8 10 9 9 6 4-3 2v-2h-3v-2h-2v-2l-4 1-5 11-1 10 1 4 5 2 3 3 17 6v1l-8-1-12-5-12-8-15-15-11-16-5-10 1-9z', fill: '#4249B0' },
  { transform: 'translate(709,590)', d: 'm0 0 12 2 7 6 3 9v31h-10l-2-4-6 4-3 1h-11l-8-3-5-6v-10l3-5 8-5 5-1h17l-3-7-2-1h-13l-11 3-1-9 9-4z', fill: '#5251EE' },
  { transform: 'translate(461,379)', d: 'm0 0 10 3 2 2 3 5 5 4 2 3-10 4-4 3-5 4-10 7-14 11-7 6-6 1-1 2h-3l2-3-4-6-5-5-1-5h2l1-4 7-7 10-8 17-12z', fill: '#038FFC' },
  { transform: 'translate(520,590)', d: 'm0 0 11 1 6 3 6 6 2 6v12l-34 1 3 6 4 3 4 1h7l10-3 4-1v9l-8 4-5 1h-10l-10-3-6-5-4-7-1-5v-8l4-11 8-7z', fill: '#5451EF' },
  { transform: 'translate(592,591)', d: 'm0 0h3l-2 5-12 14-2 4 7 9 11 14v1h-13l-13-16-8 10-5 6h-12l4-7 7-8 7-9-6-8-10-13v-1h13l10 13 5-5 6-8z', fill: '#534FEF' },
  { transform: 'translate(376,350)', d: 'm0 0 1 2h2l6 9 7 3 9 1-6 7-9 12-8 16h-2l-1 2-2-1-1-5-9-2-2-8h-2v5l-3-1-1-8 9-17 10-13z', fill: '#086FFA' },
  { transform: 'translate(403,577)', d: 'm0 0h5v14h14v10h-14l1 23 1 4h8l5-1v10l-8 2-10-1-6-5-2-7v-25h-5l-1-1v-8h6v-14z', fill: '#0391FD' },
  { transform: 'translate(434,572)', d: 'm0 0h11l11 14 10 12 3 4-1 4-7-9-2-4-7-3-4 1-2-4-2-1 1 3-1 49h-10z', fill: '#4F54F8' },
  { transform: 'translate(334,453)', d: 'm0 0 2 1 4 12 6 11 11 12 12 7 10 3 10 2v1l-7 1-2 2 4 2v2l2 1v2l-2 1 6 2 1 4h-3l2 1-1 2-13-4-13-7-7-6-11-14-6-13-4-14z', fill: '#0E6CF5' },
  { transform: 'translate(610,400)', d: 'm0 0h1l2 74-3 5-11 7-3 1h-16l-11-6-1-2 9 3v2l7 1 11-2-1-3 5-6 3-3 2-4-9-10-8-8 3-7 3-3h13l2 1z', fill: '#4249B0' },
  { transform: 'translate(308,602)', d: 'm0 0h21v31l-9 4-10 2h-11l-12-3-1-3 1-4 4 1 2 1-1-4 3-1 3 1h14l6-2 1-13h-14v-9z', fill: '#048CFB' },
  { transform: 'translate(435,396)', d: 'm0 0 2 1v1l4 1 5 5 4 5 4-1 2 2h3l-5 4-14 11-7 6-6 1-1 2h-3l2-3-4-6-5-5-1-5h2l1-4 7-7z', fill: '#076FFB' },
  { transform: 'translate(454,454)', d: 'm0 0 2 3v3l5 1 4 5v7l5 1-2 11-11 13h-4l-2-9-4-6-6-3-7-1v-3l9-12 5-6z', fill: '#0670FB' },
  { transform: 'translate(617,600)', d: 'm0 0h9l6 4 3 4 1 10-3 6-4 4-5 2-9-1-6-5-2-4v-11l4-6z', fill: 'transparent' },
  { transform: 'translate(358,600)', d: 'm0 0h8l6 3 4 5 1 9-3 7-5 4-3 1h-9l-6-4-3-6v-9l3-5 5-4z', fill: 'transparent' },
  { transform: 'translate(676,590)', d: 'm0 0h7v11l-9 1-5 2-3 5-1 4-1 25h-10v-46l2-1h6l2 1 1 5 5-5z', fill: '#5550ED' },
  { transform: 'translate(577,440)', d: 'm0 0 6 2-1 4h3l-1 8-11 6-10 3-4 1-3-1v2l-4-2-10-14 2-5 11 1 4 1 10-4z', fill: '#076FFC' },
  { transform: 'translate(593,458)', d: 'm0 0 3 1 2 3 5 2 2 4-4 6-5 5-1 2 3 2-6 2-9 1-6-2v-2l-4-1-7-3-2-3 8-1 4-4 7-3 6-4h3l1-2v2h2z', fill: '#5039FC' },
  { transform: 'translate(587,399)', d: 'm0 0h1l1 9 1-6 2 4 2 3 1 6 3 3v2h2v3l6 2 2 1 1 17-1-3h-15l-5 5v-5l-1-1-1-33z', fill: '#5038FD' },
  { transform: 'translate(639,319)', d: 'm0 0 6 1-2 3-1 7 4 5 4 2h6l6-3 2-6 3 1 2-2v12l-4 6-8 5h-12l-7-8-3-6-1-9h-3l1-2 3-1z', fill: '#088EFD' },
  { transform: 'translate(376,350)', d: 'm0 0 1 2h2l6 9 7 3 9 1-6 7-8 11-3-3-1-3-16-7v-2h-2l2-5 3-6z', fill: '#0390FD' },
  { transform: 'translate(394,331)', d: 'm0 0h9l4 3-1 4v8l-5 5-10 1-5-6v-9-4h5z', fill: 'transparent' },
  { transform: 'translate(434,572)', d: 'm0 0h11l11 14 10 12 3 4-1 4-7-9-2-4-7-4-4-5-1-5h-2v3h-2v-2h-2l1 3-6 1v38h-1l-1-6z', fill: '#0C70FA' },
  { transform: 'translate(704,617)', d: 'm0 0h16l-1 7-5 5-2 1h-11l-4-4v-5l4-3z', fill: 'transparent' },
  { transform: 'translate(454,449)', d: 'm0 0h2l2 5 6 2 4 8v2h2l3 3 4-3-1 6-7 11-1-3 1-5-1 1-4-3v-7l-5-5-3-1-2-5-1 2-4 2-3 2 2-5 3-6h2l1 1z', fill: '#4B54EE' },
  { transform: 'translate(522,599)', d: 'm0 0 7 1 5 6 1 5h-24l1-6 6-5z', fill: 'transparent' },
  { transform: 'translate(431,485)', d: 'm0 0h7l4 2 1 2v7l-4 4h-10l-3-4 1-8h4z', fill: 'transparent' },
  { transform: 'translate(445,468)', d: 'm0 0 2 2 2 4 5 5 1 9-2 4-6-9-6-3-7-1v-3l5-5 5-1z', fill: '#0391FD' },
  { transform: 'translate(355,383)', d: 'm0 0 2 2v5l1-4 1-2 3 2 1 8 9 1 2 5 1 4-4 1-1-2h-2v-2l-7-1-2-3-6 1-2-5z', fill: '#5B51FC' },
  { transform: 'translate(421,627)', d: 'm0 0h2v10l-8 2-10-1-4-4 6-1 1-5h10z', fill: '#4558F1' },
  { transform: 'translate(414,337)', d: 'm0 0 1 3 1 5 4-1 2-2h7l3-1 2 4-19 11-3-1v-15z', fill: '#0395FD' },
  { transform: 'translate(294,626)', d: 'm0 0 14 3v1l-7-1 3 3v2l-4 1 3 2-4 2-12-3-1-3 1-4 4 1 2 1-1-4z', fill: '#0481FD' },
  { transform: 'translate(334,453)', d: 'm0 0 2 1 4 12 6 11 2 4-3 1 1 6-3-1-5-12-4-17z', fill: '#3C55DD' },
  { transform: 'translate(714,628)', d: 'm0 0h4v3h2l-2 4-8 4h-11l-6-2v-1l14 1 4-2-4-2-7-1v-3h12z', fill: '#4A4DDE' },
  { transform: 'translate(407,603)', d: 'm0 0h1l1 21 1 4h-2l-1 5-7 1-2-3v-5h2v-2h7z', fill: '#0C6EFA' },
  { transform: 'translate(413,418)', d: 'm0 0h3l1 4 4 2 3 3v3l2 1-2 2v4h-5v-2l2-1-2-5-6-2-2-8z', fill: '#5752F9' },
  { transform: 'translate(309,630)', d: 'm0 0 9 2 1 2-1 2h-2v2l-11 1 2-7z', fill: '#0371FE' },
  { transform: 'translate(699,631)', d: 'm0 0 10 1 3 3-5 3-9-1-3-2z', fill: '#5744FD' },
  { transform: 'translate(609,626)', d: 'm0 0 4 1 11 3v1h-5v4l-3 1 1 2-8-1-4-4 6 1 1-5z', fill: '#494CDF' },
  { transform: 'translate(451,581)', d: 'm0 0 5 5 10 12 3 4-1 4-7-9-2-4-7-4-1-6z', fill: '#1F63E2' },
  { transform: 'translate(584,390)', d: 'm0 0h1l1 34 2 15 1 2-2 4-2-9-1-9z', fill: '#4349AE' },
  { transform: 'translate(379,513)', d: 'm0 0 1 2 8-1 3 3v2h-3l2 1-1 2-8-2v-2l-4-2h2z', fill: '#0777F8' },
  { transform: 'translate(334,453)', d: 'm0 0 2 1 4 12 3 6-1 4-1-3-2 1v-2h-2l-3-14z', fill: '#2B5CCC' },
  { transform: 'translate(304,628)', d: 'm0 0 7 1-4 5 2 1h-3l-1 4-4-1 1-1-4-2 6-1v-2l-3-1v-2z', fill: '#0390FD' },
  { transform: 'translate(607,626)', d: 'm0 0 5 2 1 5-2 2-4-1-4-4z', fill: '#5846FD' },
  { transform: 'translate(415,413)', d: 'm0 0h2v2h-2v5l-4-1 1 4-6 3-3 1 2-4z', fill: '#2E5CD8' },
  { transform: 'translate(300,570)', d: 'm0 0h14l2 1v2h-20z', fill: '#03ABFD' },
  { transform: 'translate(397,579)', d: 'm0 0h10v13h-1l-1-11-5-1-2 11h-1z', fill: '#03BEFD' },
  { transform: 'translate(431,341)', d: 'm0 0 3 4-7 1h-3l-4-1 2-3h7z', fill: '#038FFE' },
  { transform: 'translate(552,629)', d: 'm0 0v3 3l7 1-1 2h-12l4-7z', fill: '#3A54D6' },
  { transform: 'translate(680,590)', d: 'm0 0h3v11l-12 1 1-2 9-2v-5z', fill: '#3953BD' },
  { transform: 'translate(430,344)', d: 'm0 0 3 1-4 3-4 2h-5l1-4 3-1h3z', fill: '#03ABFD' },
  { transform: 'translate(584,424)', d: 'm0 0h2l2 15 1 2-2 4-2-9z', fill: '#3855C2' },
  { transform: 'translate(311,635)', d: 'm0 0h7l-2 1v2l-11 1 1-3z', fill: '#107BEE' },
  { transform: 'translate(636,499)', d: 'm0 0 4 2-5 6-4 2 2-5z', fill: '#4751E0' },
  { transform: 'translate(355,383)', d: 'm0 0 2 2-1 5-4 5-1-2z', fill: '#315CE5' },
  { transform: 'translate(296,634)', d: 'm0 0h2v2h5l-2 3-10-2 3-2z', fill: '#146BED' },
  { transform: 'translate(407,326)', d: 'm0 0m-1 1m-2 1 2 1-3 3h-9l-4 2-2-2 5-2 10-1z', fill: '#0BB7FD' },
  { transform: 'translate(568,479)', d: 'm0 0 9 3v2l5 1v2l-6-2-8-5z', fill: '#3855BF' },
  { transform: 'translate(451,581)', d: 'm0 0 4 4 2 5-2 1-4-4z', fill: '#1B66F1' },
  { transform: 'translate(337,467)', d: 'm0 0 4 1 2 4-1 4-1-3-2 1v-2h-2z', fill: '#2161E5' },
  { transform: 'translate(479,396)', d: 'm0 0h3v2l-11 5-3-1z', fill: '#03B3FD' },
] as const;

const DRAW_DURATION_SECONDS = 2.5;
const PATH_ANIMATION_SECONDS = 0.6;
const PATH_DELAY_STEP =
  LOGO_PATHS.length > 1
    ? (DRAW_DURATION_SECONDS - PATH_ANIMATION_SECONDS) / (LOGO_PATHS.length - 1)
    : 0;

function getPathStyle(index: number) {
  return {
    '--delay': `${(index * PATH_DELAY_STEP).toFixed(4)}s`,
    '--fill-delay': `${(index * PATH_DELAY_STEP + PATH_ANIMATION_SECONDS * 0.72).toFixed(4)}s`,
  } as CSSProperties & Record<'--delay' | '--fill-delay', string>;
}

export default function LogoAnimated() {
  return (
    <div className="flex flex-col items-center justify-center bg-transparent">
      <style>{`
        .gotnexora-path {
          stroke-width: 2.2;
          stroke-linecap: round;
          stroke-linejoin: round;
          vector-effect: non-scaling-stroke;
          fill-opacity: 0;
          stroke-dasharray: 1;
          stroke-dashoffset: 1;
          animation:
            gotnexora-draw ${PATH_ANIMATION_SECONDS}s ease forwards var(--delay),
            gotnexora-fill 0.24s ease forwards var(--fill-delay);
        }

        .gotnexora-wordmark {
          opacity: 0;
          transform: translateY(10px);
          animation: gotnexora-fade 0.7s ease forwards ${DRAW_DURATION_SECONDS}s;
        }

        @keyframes gotnexora-draw {
          from {
            stroke-dashoffset: 1;
          }
          to {
            stroke-dashoffset: 0;
          }
        }

        @keyframes gotnexora-fill {
          from {
            fill-opacity: 0;
          }
          to {
            fill-opacity: 1;
          }
        }

        @keyframes gotnexora-fade {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>

      <svg
        viewBox="0 0 1024 1024"
        width="1024"
        height="1024"
        xmlns="http://www.w3.org/2000/svg"
        className="h-auto w-full max-w-[420px]"
        fill="none"
        aria-hidden="true"
      >
        {LOGO_PATHS.map((path, index) => (
          <path
            key={`${path.transform}-${index}`}
            transform={path.transform}
            d={path.d}
            fill={path.fill}
            stroke={path.fill}
            pathLength={1}
            className="gotnexora-path"
            style={getPathStyle(index)}
          />
        ))}
      </svg>

      <div
        className="gotnexora-wordmark mt-6 flex items-end justify-center gap-1"
        style={{
          fontFamily: 'Inter, system-ui, sans-serif',
          fontSize: '48px',
          lineHeight: 1,
          letterSpacing: '0',
        }}
      >
        <span style={{ color: '#22D3EE', fontWeight: 300 }}>Got</span>
        <span style={{ color: '#FFFFFF', fontWeight: 600 }}>Nexora</span>
      </div>
    </div>
  );
}
