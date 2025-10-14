export default function App() {
  return <div className="min-h-screen flex">
    <aside className="w-56 border-r p-3 space-y-2">
      <button className="w-full text-left">Home</button>
      <button className="w-full text-left">Modify</button>
      <button className="w-full text-left">Deploy</button>
      <div className="mt-auto opacity-70">Connect account (optional)</div>
    </aside>
    <main className="flex-1 p-6">
      <h1 className="text-2xl font-semibold">Portfoli-you</h1>
      <p>Renderer booted.</p>
    </main>
  </div>;
}
