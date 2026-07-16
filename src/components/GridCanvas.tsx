import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { Stage, Layer, Line, Rect, Circle, Text, Group } from 'react-konva'
import type Konva from 'konva'
import { useCanvasStore } from '../store/useCanvasStore'

const WIDTH = 800
const HEIGHT = 600
const GRID = 10
const RULER = 30
const RULER_H = 28
const RULER_MIN = 100
const RULER_MAX = 800

const STAGE_W = WIDTH + RULER
const STAGE_H = HEIGHT + RULER

const snapGrid = (v: number) => Math.round(v / GRID) * GRID

function projectPointToSegment(
  px: number, py: number,
  ax: number, ay: number,
  bx: number, by: number
): { x: number; y: number; distance: number } {
  const abx = bx - ax
  const aby = by - ay
  const apx = px - ax
  const apy = py - ay

  const abLenSq = abx * abx + aby * aby
  if (abLenSq === 0) {
    const dx = px - ax
    const dy = py - ay
    return { x: ax, y: ay, distance: Math.sqrt(dx * dx + dy * dy) }
  }

  let t = (apx * abx + apy * aby) / abLenSq
  t = Math.max(0, Math.min(1, t))

  const projX = ax + t * abx
  const projY = ay + t * aby

  const dx = px - projX
  const dy = py - projY
  const distance = Math.sqrt(dx * dx + dy * dy)

  return { x: projX, y: projY, distance }
}

export default function GridCanvas() {
  const tool = useCanvasStore((s) => s.tool)
  const paths = useCanvasStore((s) => s.paths)
  const currentPoints = useCanvasStore((s) => s.currentPoints)
  const rulerVisible = useCanvasStore((s) => s.rulerVisible)
  const rulerPos = useCanvasStore((s) => s.rulerPos)
  const rulerLength = useCanvasStore((s) => s.rulerLength)
  const setRulerLength = useCanvasStore((s) => s.setRulerLength)
  const rulerRotation = useCanvasStore((s) => s.rulerRotation)
  const setRulerRotation = useCanvasStore((s) => s.setRulerRotation)

  const [previewPos, setPreviewPos] = useState<{ x: number; y: number } | null>(null)
  const [resizeLen, setResizeLen] = useState<number | null>(null)
  const [resizeStart, setResizeStart] = useState<{ clientX: number; clientY: number; length: number; rulerX: number } | null>(null)
  const [dragStart, setDragStart] = useState<{ clientX: number; clientY: number; rulerX: number; rulerY: number } | null>(null)
  const [rotationStart, setRotationStart] = useState<{ startMouseAngle: number; startRotation: number; clientCenterX: number; clientCenterY: number } | null>(null)
  const lastClick = useRef(0)
  const freehand = useRef(false)
  const rulerGroupRef = useRef<Konva.Group>(null)

  const effectiveLen = resizeLen ?? rulerLength

  const getSnappedPosition = useCallback((mx: number, my: number) => {
    if (rulerVisible) {
      const theta = (rulerRotation * Math.PI) / 180
      const cos = Math.cos(theta)
      const sin = Math.sin(theta)
      const rx = rulerPos.x + RULER
      const ry = rulerPos.y

      const tl = { x: rx, y: ry }
      const tr = { x: rx + effectiveLen * cos, y: ry + effectiveLen * sin }
      const bl = { x: rx - RULER_H * sin, y: ry + RULER_H * cos }
      const br = { x: rx + effectiveLen * cos - RULER_H * sin, y: ry + effectiveLen * sin + RULER_H * cos }

      const edges = [
        projectPointToSegment(mx, my, tl.x, tl.y, tr.x, tr.y),
        projectPointToSegment(mx, my, bl.x, bl.y, br.x, br.y),
        projectPointToSegment(mx, my, tl.x, tl.y, bl.x, bl.y),
        projectPointToSegment(mx, my, tr.x, tr.y, br.x, br.y),
      ]

      let bestEdge = edges[0]
      for (let i = 1; i < edges.length; i++) {
        if (edges[i].distance < bestEdge.distance) {
          bestEdge = edges[i]
        }
      }

      if (bestEdge.distance < 25) {
        return { x: bestEdge.x, y: bestEdge.y }
      }
    }

    return { x: snapGrid(mx), y: snapGrid(my) }
  }, [rulerVisible, rulerRotation, rulerPos, effectiveLen])

  const gridLines = useMemo(() => {
    const minor: number[][] = []
    const major: number[][] = []
    const ext = 200
    for (let x = -ext; x <= WIDTH + ext; x += GRID) {
      const arr = x % (GRID * 10) === 0 ? major : minor
      arr.push([x + RULER, -ext, x + RULER, HEIGHT + ext])
    }
    for (let y = -ext; y <= HEIGHT + ext; y += GRID) {
      const arr = y % (GRID * 10) === 0 ? major : minor
      arr.push([-ext + RULER, y, WIDTH + ext + RULER, y])
    }
    return { minor, major }
  }, [])

  const axisRulers = useMemo(() => {
    const els: React.ReactNode[] = []
    const tc = '#555'

    for (let gx = 0; gx <= WIDTH; gx += GRID) {
      const sx = gx + RULER
      const cm = gx % (GRID * 10) === 0
      const len = cm ? 10 : 5
      els.push(<Line key={`br-${gx}`} points={[sx, HEIGHT, sx, HEIGHT + len]} stroke={tc} strokeWidth={cm ? 1 : 0.5} listening={false} />)
      if (cm) {
        const l = `${gx / 100}`
        els.push(<Text key={`bl-${gx}`} x={sx - l.length * 3} y={HEIGHT + 12} text={l} fontSize={9} fill={tc} fontFamily="monospace" listening={false} />)
      }
    }

    for (let gy = 0; gy <= HEIGHT; gy += GRID) {
      const sy = gy
      const cm = gy % (GRID * 10) === 0
      const len = cm ? 10 : 5
      els.push(<Line key={`lr-${gy}`} points={[RULER, sy, RULER - len, sy]} stroke={tc} strokeWidth={cm ? 1 : 0.5} listening={false} />)
      if (cm) {
        const l = `${(HEIGHT - gy) / 100}`
        els.push(<Text key={`ll-${gy}`} x={RULER - 16} y={sy - 4} text={l} fontSize={9} fill={tc} fontFamily="monospace" listening={false} />)
      }
    }

    return els
  }, [])

  const rulerContent = useMemo(() => {
    const ticks: React.ReactNode[] = []
    const labels: React.ReactNode[] = []
    for (let x = 0; x <= effectiveLen; x += GRID) {
      const cm = x % 100 === 0
      ticks.push(<Line key={`dt-${x}`} points={[x, 0, x, cm ? RULER_H : RULER_H / 2]} stroke="#333" strokeWidth={cm ? 1 : 0.5} listening={false} />)
    }
    for (let i = 0; i <= effectiveLen / 100; i++) {
      const l = `${i}`
      labels.push(<Text key={`dl-${i}`} x={i * 100 - l.length * 3} y={3} text={l} fontSize={9} fill="#333" fontFamily="monospace" listening={false} />)
    }
    return { ticks, labels }
  }, [effectiveLen])

  const cancelBubble = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    e.cancelBubble = true
  }, [])

  const finalizePoly = useCallback(() => {
    const st = useCanvasStore.getState()
    if (st.currentPoints.length >= 2) {
      st.addPath({ points: [...st.currentPoints], color: '#1a1a1a', strokeWidth: 1.5 })
    }
    st.clearCurrent()
  }, [])

  const handleMouseDown = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    if (e.evt.button !== 0) return
    // Ignore if clicking on ruler elements
    if (e.target !== e.target.getStage()) return
    const st = useCanvasStore.getState()
    if (st.tool !== 'freehand') return

    const pos = e.target.getStage()?.getPointerPosition()
    if (!pos) return

    freehand.current = true
    const snapped = getSnappedPosition(pos.x, pos.y)
    st.addPointToCurrent([snapped.x - RULER, snapped.y])
  }, [getSnappedPosition])

  const handleClick = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    if (e.evt.button !== 0) return
    // Ignore if clicking on ruler elements
    if (e.target !== e.target.getStage()) return
    const st = useCanvasStore.getState()
    if (st.tool !== 'polyline') return

    const now = Date.now()
    if (now - lastClick.current < 300) {
      lastClick.current = 0
      finalizePoly()
      return
    }
    lastClick.current = now

    const pos = e.target.getStage()?.getPointerPosition()
    if (!pos) return
    const snapped = getSnappedPosition(pos.x, pos.y)
    st.addPointToCurrent([snapped.x - RULER, snapped.y])
  }, [finalizePoly, getSnappedPosition])

  const handleDblClick = useCallback(() => {
    const st = useCanvasStore.getState()
    if (st.tool !== 'polyline') return
    finalizePoly()
  }, [finalizePoly])

  const handleContextMenu = useCallback((e: Konva.KonvaEventObject<PointerEvent>) => {
    e.evt.preventDefault()
    const st = useCanvasStore.getState()
    if (st.tool !== 'polyline' || st.currentPoints.length === 0) return
    st.removeLastPoint()
  }, [])

  const handleMouseMove = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {

    if (freehand.current) {
      const pos = e.target.getStage()?.getPointerPosition()
      if (!pos) return
      const snapped = getSnappedPosition(pos.x, pos.y)
      const sx = snapped.x - RULER
      const sy = snapped.y
      const st = useCanvasStore.getState()
      const pts = st.currentPoints
      if (pts.length >= 2 && sx === pts[pts.length - 2] && sy === pts[pts.length - 1]) return
      st.addPointToCurrent([sx, sy])
      return
    }

    const st = useCanvasStore.getState()
    if (st.tool === 'polyline') {
      const pos = e.target.getStage()?.getPointerPosition()
      if (!pos) { setPreviewPos(null); return }
      const snapped = getSnappedPosition(pos.x, pos.y)
      setPreviewPos({ x: snapped.x - RULER, y: snapped.y })
    } else {
      setPreviewPos(null)
    }
  }, [getSnappedPosition])


  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Enter') finalizePoly()
      if (e.key === 'Escape') useCanvasStore.getState().clearCurrent()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [finalizePoly])

  useEffect(() => {
    const handler = () => {
      if (freehand.current) {
        freehand.current = false
        const st = useCanvasStore.getState()
        if (st.currentPoints.length >= 2) {
          st.addPath({ points: [...st.currentPoints], color: '#1a1a1a', strokeWidth: 1.5 })
        }
        st.clearCurrent()
      }

      setResizeLen((prev) => {
        if (prev !== null) {
          setRulerLength(prev)
        }
        return null
      })
      setResizeStart(null)
      setDragStart(null)
      setRotationStart(null)
    }
    document.addEventListener('mouseup', handler)
    return () => document.removeEventListener('mouseup', handler)
  }, [setRulerLength, setResizeLen, setResizeStart, setDragStart, setRotationStart])

  useEffect(() => {
    if (!resizeStart && !dragStart && !rotationStart) return

    const handleWindowMouseMove = (e: MouseEvent) => {
      if (resizeStart) {
        const theta = (rulerRotation * Math.PI) / 180
        const deltaX = e.clientX - resizeStart.clientX
        const deltaY = e.clientY - resizeStart.clientY
        const projectedDelta = deltaX * Math.cos(theta) + deltaY * Math.sin(theta)
        const newLen = snapGrid(resizeStart.length + projectedDelta)
        const clampedLen = Math.max(RULER_MIN, Math.min(RULER_MAX, newLen))

        let newRulerX = resizeStart.rulerX
        const rightEdge = newRulerX + RULER + clampedLen
        if (rightEdge > RULER + WIDTH) {
          newRulerX = RULER + WIDTH - clampedLen - RULER
        }
        newRulerX = Math.max(0, newRulerX)

        setResizeLen(clampedLen)
        useCanvasStore.getState().setRulerPos({ x: newRulerX, y: rulerPos.y })
      } else if (dragStart) {
        const deltaX = e.clientX - dragStart.clientX
        const deltaY = e.clientY - dragStart.clientY

        let newRulerX = snapGrid(dragStart.rulerX + deltaX)
        let newRulerY = snapGrid(dragStart.rulerY + deltaY)

        newRulerX = Math.max(0, Math.min(WIDTH - effectiveLen, newRulerX))
        newRulerY = Math.max(0, Math.min(HEIGHT - RULER_H, newRulerY))

        useCanvasStore.getState().setRulerPos({ x: newRulerX, y: newRulerY })
      } else if (rotationStart) {
        const stage = rulerGroupRef.current?.getStage()
        const rect = stage?.container().getBoundingClientRect()
        if (rect) {
          const stageX = e.clientX - rect.left
          const stageY = e.clientY - rect.top
          const insideCanvas = stageX >= RULER && stageX <= RULER + WIDTH && stageY >= 0 && stageY <= HEIGHT
          if (!insideCanvas) return
        }

        const currentMouseAngle = Math.atan2(e.clientY - rotationStart.clientCenterY, e.clientX - rotationStart.clientCenterX)
        const deltaAngleRad = currentMouseAngle - rotationStart.startMouseAngle
        const deltaAngleDeg = deltaAngleRad * (180 / Math.PI)

        let newRotation = (rotationStart.startRotation + deltaAngleDeg) % 360
        if (newRotation < 0) newRotation += 360

        newRotation = Math.round(newRotation)
        setRulerRotation(newRotation)
      }
    }

    window.addEventListener('mousemove', handleWindowMouseMove)
    return () => window.removeEventListener('mousemove', handleWindowMouseMove)
  }, [resizeStart, dragStart, rotationStart, rulerPos.y, effectiveLen, rulerRotation, setRulerRotation])

  const previewLine =
    tool === 'polyline' && currentPoints.length >= 2 && previewPos
      ? [
          currentPoints[currentPoints.length - 2] + RULER,
          currentPoints[currentPoints.length - 1],
          previewPos.x + RULER,
          previewPos.y,
        ]
      : null

  return (
    <Stage
      width={STAGE_W}
      height={STAGE_H}
      onMouseDown={handleMouseDown}
      onClick={handleClick}
      onDblClick={handleDblClick}
      onContextMenu={handleContextMenu}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setPreviewPos(null)}
    >
      <Layer>
        <Rect x={0} y={0} width={RULER} height={HEIGHT} fill="#f0f0f0" listening={false} />
        <Rect x={RULER} y={HEIGHT} width={WIDTH} height={RULER} fill="#f0f0f0" listening={false} />
      </Layer>

      <Layer clip={{ x: RULER, y: 0, width: WIDTH, height: HEIGHT }}>
        <Rect x={RULER} y={0} width={WIDTH} height={HEIGHT} fill="white" listening={false} />
        {gridLines.minor.map((p, i) => (
          <Line key={`mi-${i}`} points={p} stroke="#e8e8e8" strokeWidth={0.5} listening={false} />
        ))}
        {gridLines.major.map((p, i) => (
          <Line key={`ma-${i}`} points={p} stroke="#b0b0b0" strokeWidth={1.5} listening={false} />
        ))}
      </Layer>

      <Layer>{axisRulers}</Layer>

      <Layer clip={{ x: RULER, y: 0, width: WIDTH, height: HEIGHT }}>
        {paths.map((path, i) => (
          <Line
            key={`p-${i}`}
            points={path.points.reduce<number[]>((a, v, j) => (a.push(j % 2 === 0 ? v + RULER : v), a), [])}
            stroke={path.color}
            strokeWidth={path.strokeWidth}
            lineCap="round"
            lineJoin="round"
            listening={false}
          />
        ))}
        {currentPoints.length >= 2 && (
          <Line
            points={currentPoints.reduce<number[]>((a, v, i) => (a.push(i % 2 === 0 ? v + RULER : v), a), [])}
            stroke="#2563eb"
            strokeWidth={1.5}
            lineCap="round"
            lineJoin="round"
            listening={false}
          />
        )}
        {previewLine && (
          <Line points={previewLine} stroke="#2563eb" strokeWidth={1.5} dash={[6, 4]} listening={false} />
        )}
        {tool === 'polyline' && previewPos && (
          <Circle x={previewPos.x + RULER} y={previewPos.y} radius={3} fill="#2563eb" opacity={0.6} listening={false} />
        )}
      </Layer>

      {rulerVisible && (
        <Layer clip={{ x: RULER, y: 0, width: WIDTH, height: HEIGHT }}>
          <Group
            ref={rulerGroupRef}
            x={rulerPos.x + RULER}
            y={rulerPos.y}
            rotation={rulerRotation}
            onClick={cancelBubble}
            onDblClick={cancelBubble}
          >
            <Rect width={effectiveLen} height={RULER_H} fill="#ffd700" opacity={0.25} stroke="#b8960f" strokeWidth={1} cornerRadius={2} />
            {rulerContent.ticks}
            {rulerContent.labels}

            {/* Central move handle */}
            <Group
              x={effectiveLen / 2}
              y={RULER_H / 2}
              onClick={cancelBubble}
              onDblClick={cancelBubble}
              onMouseDown={(e) => {
                e.cancelBubble = true
                setDragStart({
                  clientX: e.evt.clientX,
                  clientY: e.evt.clientY,
                  rulerX: rulerPos.x,
                  rulerY: rulerPos.y,
                })
              }}
              onMouseEnter={(e) => {
                const stage = e.target.getStage()
                if (stage) stage.container().style.cursor = 'move'
              }}
              onMouseLeave={(e) => {
                const stage = e.target.getStage()
                if (stage) stage.container().style.cursor = 'default'
              }}
            >
              <Circle radius={5} fill="#b8960f" stroke="#8a720c" strokeWidth={1} />
            </Group>

            {/* Connecting line for rotation handle */}
            <Line
              points={[effectiveLen / 2, RULER_H / 2, effectiveLen / 2, -15]}
              stroke="#b8960f"
              strokeWidth={1}
              dash={[2, 2]}
            />

            {/* Rotation handle */}
            <Group
              x={effectiveLen / 2}
              y={-15}
              onClick={cancelBubble}
              onDblClick={cancelBubble}
              onMouseDown={(e) => {
                e.cancelBubble = true
                const rect = e.target.getStage()?.container().getBoundingClientRect()
                if (rect) {
                  const clientCenterX = rect.left + rulerPos.x + RULER
                  const clientCenterY = rect.top + rulerPos.y
                  const currentMouseAngle = Math.atan2(e.evt.clientY - clientCenterY, e.evt.clientX - clientCenterX)
                  setRotationStart({
                    startMouseAngle: currentMouseAngle,
                    startRotation: rulerRotation,
                    clientCenterX,
                    clientCenterY,
                  })
                }
              }}
              onMouseEnter={(e) => {
                const stage = e.target.getStage()
                if (stage) stage.container().style.cursor = 'pointer'
              }}
              onMouseLeave={(e) => {
                const stage = e.target.getStage()
                if (stage) stage.container().style.cursor = 'default'
              }}
            >
              <Circle radius={5} fill="#b8960f" stroke="#8a720c" strokeWidth={1} />
            </Group>

            {/* Rotation label */}
            <Text
              x={effectiveLen / 2 - 20}
              y={-32}
              width={40}
              text={`${rulerRotation}°`}
              fontSize={10}
              fontFamily="monospace"
              fill="#8a720c"
              align="center"
            />

            {/* Right resize handle */}
            <Group
              x={effectiveLen}
              y={RULER_H / 2}
              onClick={cancelBubble}
              onDblClick={cancelBubble}
              onMouseDown={(e) => {
                e.cancelBubble = true
                setResizeStart({
                  clientX: e.evt.clientX,
                  clientY: e.evt.clientY,
                  length: rulerLength,
                  rulerX: rulerPos.x,
                })
                setResizeLen(rulerLength)
              }}
              onMouseEnter={(e) => {
                const stage = e.target.getStage()
                if (stage) stage.container().style.cursor = 'ew-resize'
              }}
              onMouseLeave={(e) => {
                const stage = e.target.getStage()
                if (stage) stage.container().style.cursor = 'default'
              }}
            >
              <Circle radius={5} fill="#b8960f" stroke="#8a720c" strokeWidth={1} />
            </Group>
          </Group>
        </Layer>
      )}
    </Stage>
  )
}
