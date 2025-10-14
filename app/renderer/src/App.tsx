export default function App() {
  return (
    <div className="min-h-screen flex">
      <aside className="w-56 border-r p-3 space-y-2">
        <button className="w-full text-left">Home</button>
        <button className="w-full text-left">Modify</button>
        <button className="w-full text-left">Deploy</button>
        <div className="mt-auto opacity-70">Connect account (optional)</div>
      </aside>
      <main className="flex-1 p-6">
        <h1 className="text-2xl font-semibold">Portfoli-you</h1>
        <p>Renderer booted.</p>
        <div className="p-6">
          <h1 className="text-3xl font-bold text-blue-600">Tailwind OK</h1>
          <button className="mt-4 px-3 py-1 rounded bg-black text-white hover:bg-gray-800">
            Test for hover (tailwind)
          </button>
        </div>
      </main>
    </div>
  );
}
