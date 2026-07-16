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
  undonePaths: PathData[]
  addPath: (path: PathData) => void
  clearPaths: () => void
  undo: () => void
  redo: () => void
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
  compassVisible: boolean
  compassPos: { x: number; y: number }
  compassOpening: number
  compassRotation: number
  compassLegLength: number
  toggleCompass: () => void
  setCompassPos: (pos: { x: number; y: number }) => void
  setCompassOpening: (angle: number) => void
  setCompassRotation: (rot: number) => void
}

export const useCanvasStore = create<CanvasState>((set) => ({
  tool: 'freehand',
  setTool: (tool) => set({ tool, currentPoints: [] }),
  paths: [],
  undonePaths: [],
  addPath: (path) => set((s) => ({ paths: [...s.paths, path], undonePaths: [] })),
  clearPaths: () => set({ paths: [], undonePaths: [] }),
  undo: () =>
    set((s) => {
      if (s.paths.length === 0) return {}
      const last = s.paths[s.paths.length - 1]
      return {
        paths: s.paths.slice(0, -1),
        undonePaths: [...s.undonePaths, last],
      }
    }),
  redo: () =>
    set((s) => {
      if (s.undonePaths.length === 0) return {}
      const last = s.undonePaths[s.undonePaths.length - 1]
      return {
        paths: [...s.paths, last],
        undonePaths: s.undonePaths.slice(0, -1),
      }
    }),
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
  compassVisible: false,
  compassPos: { x: 200, y: 200 },
  compassOpening: 45,
  compassRotation: 0,
  compassLegLength: 120,
  toggleCompass: () => set((s) => ({ compassVisible: !s.compassVisible })),
  setCompassPos: (compassPos) => set({ compassPos }),
  setCompassOpening: (compassOpening) => set({ compassOpening }),
  setCompassRotation: (compassRotation) => set({ compassRotation }),
}))
