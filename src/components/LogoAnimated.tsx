import Image from 'next/image';

export default function LogoAnimated() {
  return (
    <div className="flex items-center justify-center w-screen h-screen bg-black">
      <style>{`
        .gotnexora-logo-reveal {
          opacity: 0;
          transform: scale(0.92);
          animation: gotnexora-logo-reveal 1.2s cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }

        @keyframes gotnexora-logo-reveal {
          from {
            opacity: 0;
            transform: scale(0.92);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
      `}</style>

      <Image
        src="/LogoHorizontal.png"
        alt="GotNexora"
        width={900}
        height={300}
        className="gotnexora-logo-reveal h-auto w-full max-w-[900px]"
        priority
      />
    </div>
  );
}
