export default function HomePage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-4xl mx-auto px-4">
        <h1 className="text-4xl font-bold text-center mb-8">ChessMate</h1>
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-2xl font-semibold mb-4">API Endpoints Available:</h2>
          <ul className="space-y-2">
            <li><a href="/api/districts" className="text-blue-600 hover:underline">/api/districts</a> - Get all districts</li>
            <li><a href="/api/schools" className="text-blue-600 hover:underline">/api/schools</a> - Get all schools</li>
            <li><a href="/api/search-players" className="text-blue-600 hover:underline">/api/search-players</a> - Search players</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
