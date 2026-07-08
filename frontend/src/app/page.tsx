import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 text-center">
      <div className="organic-card leaf-glow max-w-md rounded-[2rem] border border-[#e3dcc8] px-7 py-10">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.28em] text-[#7c6b43]">
          fresh custom bowls
        </p>
        <h1 className="text-4xl font-bold tracking-tight text-[#263820] mb-3">
          PureOrganic
        </h1>
        <p className="text-[#68775a] mb-8 leading-relaxed">
          Build a balanced bowl with wholesome grains, clean proteins, fresh vegetables, and sauces made for your taste.
        </p>
        <Link
          href="/build"
          className="inline-block rounded-2xl bg-[#5f8d4e] px-8 py-3 text-lg font-semibold text-white shadow-[0_16px_35px_rgba(95,141,78,0.24)] transition-all hover:bg-[#4f7d41] active:scale-95"
        >
          Start Building →
        </Link>
        <p className="mt-6 text-xs font-medium text-[#b0a87e]">
          Already placed an order?{" "}
          <Link
            href="/orders"
            className="font-bold text-[#5f8d4e] underline underline-offset-2 hover:text-[#4f7d41]"
          >
            Check your order
          </Link>
        </p>
      </div>
    </main>
  );
}
