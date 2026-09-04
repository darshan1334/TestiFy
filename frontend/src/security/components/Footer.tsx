export default function Footer() {
  return (
    <footer className="mt-12 border-t border-[var(--color-border)] bg-[#07040d]/90 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-6 py-8">

        <div>
          <h2 className="text-xl font-bold text-[var(--color-gold-bright)]">
            TestiFy Security
          </h2>

          <p className="mt-2 max-w-xl text-sm text-gray-400">
            AI-powered Static Application Security Testing (SAST) platform
            for detecting vulnerabilities, exposed secrets, dependency risks,
            and secure coding issues across modern applications.
          </p>
        </div>

        <div className="mt-8 border-t border-[var(--color-border)] pt-5 flex flex-col md:flex-row items-center justify-between gap-3">

          <p className="text-xs text-gray-500">
            © {new Date().getFullYear()} TestiFy. All Rights Reserved.
          </p>

          <p className="text-xs text-gray-500">
            Built with React • FastAPI • Tailwind CSS • AI-Powered Security Intelligence
          </p>

        </div>

      </div>
    </footer>
  );
}