import GridCanvas from './components/GridCanvas'
import { useCanvasStore } from './store/useCanvasStore'

function App() {
  const tool = useCanvasStore((s) => s.tool)
  const setTool = useCanvasStore((s) => s.setTool)
  const clearPaths = useCanvasStore((s) => s.clearPaths)
  const rulerVisible = useCanvasStore((s) => s.rulerVisible)
  const toggleRuler = useCanvasStore((s) => s.toggleRuler)

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center gap-4 p-4">
      <h1 className="text-lg font-mono text-gray-600">dibujotecnico</h1>

      <div className="flex items-center gap-3">
        <button
          onClick={() => setTool('polyline')}
          className={`px-3 py-1 rounded text-sm font-mono cursor-pointer transition-colors ${
            tool === 'polyline'
              ? 'bg-blue-600 text-white'
              : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
          }`}
        >
          Polilínea
        </button>
        <button
          onClick={() => setTool('freehand')}
          className={`px-3 py-1 rounded text-sm font-mono cursor-pointer transition-colors ${
            tool === 'freehand'
              ? 'bg-blue-600 text-white'
              : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
          }`}
        >
          Mano alzada
        </button>

        <span className="text-gray-300 text-sm">|</span>

        <button
          onClick={toggleRuler}
          className={`px-3 py-1 rounded text-sm font-mono cursor-pointer transition-colors ${
            rulerVisible
              ? 'bg-blue-600 text-white'
              : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
          }`}
        >
          Regla
        </button>

        <span className="text-gray-300 text-sm">|</span>

        <button
          onClick={clearPaths}
          className="px-3 py-1 rounded text-sm font-mono bg-white text-red-600 border border-red-300 hover:bg-red-50 cursor-pointer transition-colors"
        >
          Limpiar
        </button>
      </div>

      <div className="border border-gray-300 shadow-lg">
        <GridCanvas />
      </div>

      {tool === 'polyline' && (
        <p className="text-xs font-mono text-gray-400">
          Click: añadir vértice · Doble click / Enter: cerrar trazado · Click derecho: deshacer vértice · Esc: cancelar
        </p>
      )}
      {tool === 'freehand' && (
        <p className="text-xs font-mono text-gray-400">
          Click y arrastra: dibujar · Suelta: cerrar trazado
        </p>
      )}
    </div>
  )
}

export default App
