import { useState } from 'react'
import { useCanvasStore } from './store/useCanvasStore'
import GridCanvas from './components/GridCanvas'
import ToolbarButton from './components/ToolbarButton'

function App() {
  const tool = useCanvasStore((s) => s.tool)
  const setTool = useCanvasStore((s) => s.setTool)
  const clearPaths = useCanvasStore((s) => s.clearPaths)
  const rulerVisible = useCanvasStore((s) => s.rulerVisible)
  const toggleRuler = useCanvasStore((s) => s.toggleRuler)
  const compassVisible = useCanvasStore((s) => s.compassVisible)
  const toggleCompass = useCanvasStore((s) => s.toggleCompass)
  const protractorVisible = useCanvasStore((s) => s.protractorVisible)
  const toggleProtractor = useCanvasStore((s) => s.toggleProtractor)
  const undo = useCanvasStore((s) => s.undo)
  const redo = useCanvasStore((s) => s.redo)
  const paths = useCanvasStore((s) => s.paths)
  const undonePaths = useCanvasStore((s) => s.undonePaths)
  const canvasWidth = useCanvasStore((s) => s.canvasWidth)
  const canvasHeight = useCanvasStore((s) => s.canvasHeight)
  const setCanvasSize = useCanvasStore((s) => s.setCanvasSize)
  const gridSnapEnabled = useCanvasStore((s) => s.gridSnapEnabled)
  const toggleGridSnap = useCanvasStore((s) => s.toggleGridSnap)

  const [wCm, setWCm] = useState(String(canvasWidth / 100))
  const [hCm, setHCm] = useState(String(canvasHeight / 100))

  const handleResize = (e: React.FormEvent) => {
    e.preventDefault()
    const w = parseFloat(wCm)
    const h = parseFloat(hCm)
    if (!isNaN(w) && !isNaN(h) && w >= 4 && w <= 30 && h >= 3 && h <= 20) {
      setCanvasSize(Math.round(w * 100), Math.round(h * 100))
    } else {
      alert("Por favor ingresa valores válidos (Ancho: 4-30 cm, Alto: 3-20 cm)")
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center gap-4 p-4">
      <h1 className="text-lg font-mono text-gray-600">dibujotecnico</h1>

      <div className="flex items-center gap-3">
        <ToolbarButton
          onClick={() => setTool(tool === 'freehand' ? 'none' : 'freehand')}
          isActive={tool === 'freehand'}
        >
          Mano alzada
        </ToolbarButton>
        <ToolbarButton
          onClick={() => setTool(tool === 'polyline' ? 'none' : 'polyline')}
          isActive={tool === 'polyline'}
        >
          Polilínea
        </ToolbarButton>
        <ToolbarButton
          onClick={() => setTool(tool === 'point' ? 'none' : 'point')}
          isActive={tool === 'point'}
        >
          Punto
        </ToolbarButton>

        <span className="text-gray-300 text-sm">|</span>

        <ToolbarButton
          onClick={toggleRuler}
          isActive={rulerVisible}
        >
          Regla
        </ToolbarButton>
        <ToolbarButton
          onClick={toggleCompass}
          isActive={compassVisible}
        >
          Compás
        </ToolbarButton>
        <ToolbarButton
          onClick={toggleProtractor}
          isActive={protractorVisible}
        >
          Transportador
        </ToolbarButton>

        <span className="text-gray-300 text-sm">|</span>

        <ToolbarButton
          onClick={undo}
          disabled={paths.length === 0}
        >
          Deshacer
        </ToolbarButton>
        <ToolbarButton
          onClick={redo}
          disabled={undonePaths.length === 0}
        >
          Rehacer
        </ToolbarButton>

        <span className="text-gray-300 text-sm">|</span>

        <ToolbarButton
          onClick={clearPaths}
          variant="danger"
        >
          Limpiar
        </ToolbarButton>

        <span className="text-gray-300 text-sm">|</span>

        <ToolbarButton
          onClick={toggleGridSnap}
          isActive={gridSnapEnabled}
          title="Alternar ajuste inteligente a rejilla"
        >
          Rejilla: {gridSnapEnabled ? 'Imán' : 'Libre'}
        </ToolbarButton>
      </div>

      <div className="border border-gray-300 shadow-lg">
        <GridCanvas />
      </div>

      <form onSubmit={handleResize} className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm flex items-center gap-3 mt-1">
        <span className="text-xs font-mono text-gray-500 font-semibold uppercase">Medidas:</span>
        <div className="flex items-center gap-1">
          <input
            type="number"
            step="0.1"
            value={wCm}
            onChange={(e) => setWCm(e.target.value)}
            className="w-16 px-2 py-1 text-sm border border-gray-300 rounded font-mono text-center focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="Ancho"
          />
          <span className="text-xs font-mono text-gray-400">cm (Ancho)</span>
        </div>
        <div className="flex items-center gap-1">
          <input
            type="number"
            step="0.1"
            value={hCm}
            onChange={(e) => setHCm(e.target.value)}
            className="w-16 px-2 py-1 text-sm border border-gray-300 rounded font-mono text-center focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="Alto"
          />
          <span className="text-xs font-mono text-gray-400">cm (Alto)</span>
        </div>
        <button
          type="submit"
          className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm font-mono transition-colors cursor-pointer"
        >
          Redimensionar lienzo
        </button>
      </form>

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
      {tool === 'point' && (
        <p className="text-xs font-mono text-gray-400">
          Click: crear un punto de marca (cruz)
        </p>
      )}
      {tool === 'none' && (
        <p className="text-xs font-mono text-gray-400">
          Ninguna herramienta de dibujo activa · Manipula la regla, compás o transportador con total libertad
        </p>
      )}
    </div>
  )
}

export default App
