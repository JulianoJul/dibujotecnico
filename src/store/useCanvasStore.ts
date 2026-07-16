import { create } from 'zustand'

export interface PathData {
  points: number[]
  color: string
  strokeWidth: number
}

type Tool = 'polyline' | 'freehand'

interface CanvasState {
  tool: Tool
  setTool: (tool: Tool) => void
  paths: PathData[]
  addPath: (path: PathData) => void
  clearPaths: () => void
  currentPoints: number[]
  addPointToCurrent: (point: [number, number]) => void
  clearCurrent: () => void
  removeLastPoint: () => void
  rulerVisible: boolean
  rulerPos: { x: number; y: number }
  rulerLength: number
  rulerRotation: number
  toggleRuler: () => void
  setRulerPos: (pos: { x: number; y: number }) => void
  setRulerLength: (len: number) => void
  setRulerRotation: (rot: number) => void
}

export const useCanvasStore = create<CanvasState>((set) => ({
  tool: 'freehand',
  setTool: (tool) => set({ tool, currentPoints: [] }),
  paths: [],
  addPath: (path) => set((s) => ({ paths: [...s.paths, path] })),
  clearPaths: () => set({ paths: [] }),
  currentPoints: [],
  addPointToCurrent: (point) =>
    set((s) => ({ currentPoints: [...s.currentPoints, ...point] })),
  clearCurrent: () => set({ currentPoints: [] }),
  removeLastPoint: () =>
    set((s) => ({ currentPoints: s.currentPoints.slice(0, -2) })),
  rulerVisible: true,
  rulerPos: { x: 0, y: 100 },
  rulerLength: 300,
  rulerRotation: 0,
  toggleRuler: () => set((s) => ({ rulerVisible: !s.rulerVisible })),
  setRulerPos: (rulerPos) => set({ rulerPos }),
  setRulerLength: (rulerLength) => set({ rulerLength }),
  setRulerRotation: (rulerRotation) => set({ rulerRotation }),
}))
