import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { Stage, Layer, Line, Rect, Circle, Text, Group, Arc } from 'react-konva'
import type Konva from 'konva'
import { useCanvasStore } from '../store/useCanvasStore'

const WIDTH = 800
const HEIGHT = 600
const GRID = 10
const RULER = 30
const RULER_H = 40
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

function isRulerInsideCanvas(rulerX: number, rulerY: number, length: number, rotation: number): boolean {
  const theta = (rotation * Math.PI) / 180
  const cos = Math.cos(theta)
  const sin = Math.sin(theta)
  const rx = rulerX + RULER
  const ry = rulerY

  const corners = [
    { x: rx, y: ry },
    { x: rx + length * cos, y: ry + length * sin },
    { x: rx - RULER_H * sin, y: ry + RULER_H * cos },
    { x: rx + length * cos - RULER_H * sin, y: ry + length * sin + RULER_H * cos }
  ]

  const EPS = 0.01
  return corners.every(c => c.x >= RULER - EPS && c.x <= RULER + WIDTH + EPS && c.y >= -EPS && c.y <= HEIGHT + EPS)
}

function isCompassInsideCanvas(cx: number, cy: number, length: number, rotation: number): boolean {
  const theta = (rotation * Math.PI) / 180
  const cosRot = Math.cos(theta)
  const sinRot = Math.sin(theta)

  const center = { x: cx, y: cy }
  const leftTip = { x: cx - length, y: cy }
  const rightTip = { x: cx + length * cosRot, y: cy + length * sinRot }

  const vertices = [center, leftTip, rightTip]
  const EPS = 0.01
  return vertices.every(v => v.x >= RULER - EPS && v.x <= RULER + WIDTH + EPS && v.y >= -EPS && v.y <= HEIGHT + EPS)
}

function isProtractorInsideCanvas(cx: number, cy: number, radius: number, rotation: number): boolean {
  const theta = (rotation * Math.PI) / 180
  const cosRot = Math.cos(theta)
  const sinRot = Math.sin(theta)

  // Local right tip: (radius, 0), Left tip: (-radius, 0), Top tip: (0, -radius)
  const center = { x: cx, y: cy }
  const rightTip = {
    x: cx + radius * cosRot,
    y: cy + radius * sinRot
  }
  const leftTip = {
    x: cx - radius * cosRot,
    y: cy - radius * sinRot
  }
  const topTip = {
    x: cx + radius * Math.cos(theta - Math.PI / 2),
    y: cy + radius * Math.sin(theta - Math.PI / 2)
  }

  const vertices = [center, rightTip, leftTip, topTip]
  const EPS = 0.01
  return vertices.every(v => v.x >= RULER - EPS && v.x <= RULER + WIDTH + EPS && v.y >= -EPS && v.y <= HEIGHT + EPS)
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
  const compassVisible = useCanvasStore((s) => s.compassVisible)
  const compassPos = useCanvasStore((s) => s.compassPos)
  const compassDrawingMode = useCanvasStore((s) => s.compassDrawingMode)
  const compassRotation = useCanvasStore((s) => s.compassRotation)
  const compassLegLength = useCanvasStore((s) => s.compassLegLength)

  const protractorVisible = useCanvasStore((s) => s.protractorVisible)
  const protractorPos = useCanvasStore((s) => s.protractorPos)
  const protractorRadius = useCanvasStore((s) => s.protractorRadius)
  const protractorRotation = useCanvasStore((s) => s.protractorRotation)
  const protractorAngle = useCanvasStore((s) => s.protractorAngle)
  const setProtractorRotation = useCanvasStore((s) => s.setProtractorRotation)

  const [previewPos, setPreviewPos] = useState<{ x: number; y: number } | null>(null)
  const [resizeLen, setResizeLen] = useState<number | null>(null)
  const [resizeStart, setResizeStart] = useState<{ clientX: number; clientY: number; length: number; rulerX: number } | null>(null)
  const [dragStart, setDragStart] = useState<{ clientX: number; clientY: number; rulerX: number; rulerY: number } | null>(null)
  const [rotationStart, setRotationStart] = useState<{ startMouseAngle: number; startRotation: number; clientCenterX: number; clientCenterY: number } | null>(null)
  const [compassRadiusStart, setCompassRadiusStart] = useState<{ clientX: number; startRadius: number; compassX: number } | null>(null)
  const [compassDragStart, setCompassDragStart] = useState<{ clientX: number; clientY: number; compassX: number; compassY: number } | null>(null)
  const [compassRotationStart, setCompassRotationStart] = useState<{ startMouseAngle: number; startRotation: number; clientCenterX: number; clientCenterY: number } | null>(null)
  
  const [protractorDragStart, setProtractorDragStart] = useState<{ clientX: number; clientY: number; px: number; py: number } | null>(null)
  const [protractorRotationStart, setProtractorRotationStart] = useState<{ startMouseAngle: number; startRotation: number; clientCenterX: number; clientCenterY: number } | null>(null)
  const [protractorRadiusStart, setProtractorRadiusStart] = useState<{ clientX: number; startRadius: number } | null>(null)
  const [protractorAngleStart, setProtractorAngleStart] = useState<{ startAngle: number; clientCenterX: number; clientCenterY: number } | null>(null)
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
      setCompassRadiusStart(null)
      setCompassDragStart(null)
      setCompassRotationStart(null)
      setProtractorDragStart(null)
      setProtractorRotationStart(null)
      setProtractorRadiusStart(null)
      setProtractorAngleStart(null)

      // Finalize compass drawing if active
      if (compassDrawingMode) {
        const st = useCanvasStore.getState()
        if (st.currentPoints.length >= 2) {
          st.addPath({ points: [...st.currentPoints], color: '#1a1a1a', strokeWidth: 1.5 })
        }
        st.clearCurrent()
      }
    }
    document.addEventListener('mouseup', handler)
    return () => document.removeEventListener('mouseup', handler)
  }, [setRulerLength, setResizeLen, setResizeStart, setDragStart, setRotationStart, setCompassRadiusStart, setCompassDragStart, setCompassRotationStart, compassDrawingMode, setProtractorDragStart, setProtractorRotationStart, setProtractorRadiusStart, setProtractorAngleStart])

  useEffect(() => {
    if (!resizeStart && !dragStart && !rotationStart && !compassRadiusStart && !compassDragStart && !compassRotationStart && !protractorDragStart && !protractorRotationStart && !protractorRadiusStart && !protractorAngleStart) return

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

        if (isRulerInsideCanvas(newRulerX, rulerPos.y, clampedLen, rulerRotation)) {
          setResizeLen(clampedLen)
          useCanvasStore.getState().setRulerPos({ x: newRulerX, y: rulerPos.y })
        }
      } else if (dragStart) {
        const deltaX = e.clientX - dragStart.clientX
        const deltaY = e.clientY - dragStart.clientY

        const newRulerX = snapGrid(dragStart.rulerX + deltaX)
        const newRulerY = snapGrid(dragStart.rulerY + deltaY)

        if (isRulerInsideCanvas(newRulerX, newRulerY, effectiveLen, rulerRotation)) {
          useCanvasStore.getState().setRulerPos({ x: newRulerX, y: newRulerY })
        }
      } else if (rotationStart) {
        const currentMouseAngle = Math.atan2(e.clientY - rotationStart.clientCenterY, e.clientX - rotationStart.clientCenterX)
        const deltaAngleRad = currentMouseAngle - rotationStart.startMouseAngle
        const deltaAngleDeg = deltaAngleRad * (180 / Math.PI)

        let newRotation = (rotationStart.startRotation + deltaAngleDeg) % 360
        if (newRotation < 0) newRotation += 360

        newRotation = Math.round(newRotation)
        if (isRulerInsideCanvas(rulerPos.x, rulerPos.y, effectiveLen, newRotation)) {
          setRulerRotation(newRotation)
        }
      } else if (compassRadiusStart) {
        const deltaX = compassRadiusStart.clientX - e.clientX
        const newRadius = Math.max(20, compassRadiusStart.startRadius + deltaX)
        if (isCompassInsideCanvas(compassPos.x, compassPos.y, newRadius, compassRotation)) {
          useCanvasStore.getState().setCompassLegLength(newRadius)
        }
      } else if (compassDragStart) {
        const deltaX = e.clientX - compassDragStart.clientX
        const deltaY = e.clientY - compassDragStart.clientY

        const newCompassX = snapGrid(compassDragStart.compassX + deltaX)
        const newCompassY = snapGrid(compassDragStart.compassY + deltaY)

        if (isCompassInsideCanvas(newCompassX, newCompassY, compassLegLength, compassRotation)) {
          useCanvasStore.getState().setCompassPos({ x: newCompassX, y: newCompassY })
        }
      } else if (compassRotationStart) {
        const currentMouseAngle = Math.atan2(e.clientY - compassRotationStart.clientCenterY, e.clientX - compassRotationStart.clientCenterX)
        const deltaAngleRad = currentMouseAngle - compassRotationStart.startMouseAngle
        const deltaAngleDeg = deltaAngleRad * (180 / Math.PI)

        let newRotation = (compassRotationStart.startRotation + deltaAngleDeg) % 360
        if (newRotation < 0) newRotation += 360

        newRotation = Math.round(newRotation)
        if (isCompassInsideCanvas(compassPos.x, compassPos.y, compassLegLength, newRotation)) {
          const st = useCanvasStore.getState()
          if (compassDrawingMode) {
            const prevRot = st.compassRotation
            let diff = newRotation - prevRot
            if (diff > 180) diff -= 360
            if (diff < -180) diff += 360
            
            const steps = Math.max(1, Math.abs(diff))
            const pts: number[] = []
            for (let i = 1; i <= steps; i++) {
              const ang = prevRot + (diff * i) / steps
              const rad = (ang * Math.PI) / 180
              pts.push(compassPos.x + compassLegLength * Math.cos(rad) - RULER)
              pts.push(compassPos.y + compassLegLength * Math.sin(rad))
            }
            if (pts.length > 0) {
              st.addPointToCurrent(pts as any)
            }
          }
          st.setCompassRotation(newRotation)
        }
      } else if (protractorDragStart) {
        const deltaX = e.clientX - protractorDragStart.clientX
        const deltaY = e.clientY - protractorDragStart.clientY

        const newX = snapGrid(protractorDragStart.px + deltaX)
        const newY = snapGrid(protractorDragStart.py + deltaY)

        if (isProtractorInsideCanvas(newX, newY, protractorRadius, protractorRotation)) {
          useCanvasStore.getState().setProtractorPos({ x: newX, y: newY })
        }
      } else if (protractorRotationStart) {
        const currentMouseAngle = Math.atan2(e.clientY - protractorRotationStart.clientCenterY, e.clientX - protractorRotationStart.clientCenterX)
        const deltaAngleRad = currentMouseAngle - protractorRotationStart.startMouseAngle
        const deltaAngleDeg = deltaAngleRad * (180 / Math.PI)

        let newRotation = (protractorRotationStart.startRotation + deltaAngleDeg) % 360
        if (newRotation < 0) newRotation += 360

        newRotation = Math.round(newRotation)
        if (isProtractorInsideCanvas(protractorPos.x, protractorPos.y, protractorRadius, newRotation)) {
          setProtractorRotation(newRotation)
        }
      } else if (protractorRadiusStart) {
        const deltaX = protractorRadiusStart.clientX - e.clientX
        const newRadius = Math.max(50, protractorRadiusStart.startRadius + deltaX)
        if (isProtractorInsideCanvas(protractorPos.x, protractorPos.y, newRadius, protractorRotation)) {
          useCanvasStore.getState().setProtractorRadius(newRadius)
        }
      } else if (protractorAngleStart) {
        let mouseAngleRad = Math.atan2(e.clientY - protractorAngleStart.clientCenterY, e.clientX - protractorAngleStart.clientCenterX)
        let mouseAngleDeg = mouseAngleRad * (180 / Math.PI)

        let localAngle = (protractorRotation - mouseAngleDeg) % 360
        if (localAngle < 0) localAngle += 360

        localAngle = Math.max(0, Math.min(180, localAngle))
        useCanvasStore.getState().setProtractorAngle(Math.round(localAngle))
      }
    }

    window.addEventListener('mousemove', handleWindowMouseMove)
    return () => window.removeEventListener('mousemove', handleWindowMouseMove)
  }, [resizeStart, dragStart, rotationStart, compassRadiusStart, compassDragStart, compassRotationStart, protractorDragStart, protractorRotationStart, protractorRadiusStart, protractorAngleStart, rulerPos.x, rulerPos.y, compassPos.x, compassPos.y, protractorPos.x, protractorPos.y, effectiveLen, rulerRotation, setRulerRotation, compassRotation, compassLegLength, compassDrawingMode, protractorRadius, protractorRotation, setProtractorRotation])

  const previewLine =
    tool === 'polyline' && currentPoints.length >= 2 && previewPos && !resizeStart && !dragStart && !rotationStart
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
        {tool === 'polyline' && previewPos && !resizeStart && !dragStart && !rotationStart && (
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
      {compassVisible && (
        <Layer clip={{ x: RULER, y: 0, width: WIDTH, height: HEIGHT }}>
          <Group
            x={compassPos.x}
            y={compassPos.y}
            onClick={cancelBubble}
            onDblClick={cancelBubble}
          >
            {/* Left leg (fixed radius indicator) */}
            <Line
              points={[0, 0, -compassLegLength, 0]}
              stroke="#555"
              strokeWidth={3}
              lineCap="round"
            />

            {/* Right leg (rotatable drawing line) */}
            <Line
              points={[
                0,
                0,
                compassLegLength * Math.cos((compassRotation * Math.PI) / 180),
                compassLegLength * Math.sin((compassRotation * Math.PI) / 180),
              ]}
              stroke="#555"
              strokeWidth={3}
              lineCap="round"
            />

            {/* Left Handle (Radius resizing) */}
            <Group
              x={-compassLegLength}
              y={0}
              onClick={cancelBubble}
              onDblClick={cancelBubble}
              onMouseDown={(e) => {
                e.cancelBubble = true
                setCompassRadiusStart({
                  clientX: e.evt.clientX,
                  startRadius: compassLegLength,
                  compassX: compassPos.x,
                })
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
              <Circle radius={6} fill="#b8960f" stroke="#8a720c" strokeWidth={1} />
            </Group>

            {/* Center Handle (Move & Toggle Drawing Mode) */}
            <Group
              onClick={cancelBubble}
              onDblClick={(e) => {
                e.cancelBubble = true
                useCanvasStore.getState().setCompassDrawingMode(!compassDrawingMode)
              }}
              onMouseDown={(e) => {
                e.cancelBubble = true
                setCompassDragStart({
                  clientX: e.evt.clientX,
                  clientY: e.evt.clientY,
                  compassX: compassPos.x,
                  compassY: compassPos.y,
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
              <Circle radius={7} fill={compassDrawingMode ? '#3b82f6' : '#555'} stroke="#333" strokeWidth={1} />
            </Group>

            {/* Right Handle (Rotation & Drawing) */}
            <Group
              x={compassLegLength * Math.cos((compassRotation * Math.PI) / 180)}
              y={compassLegLength * Math.sin((compassRotation * Math.PI) / 180)}
              onClick={cancelBubble}
              onDblClick={cancelBubble}
              onMouseDown={(e) => {
                e.cancelBubble = true
                const rect = e.target.getStage()?.container().getBoundingClientRect()
                if (rect) {
                  const clientCenterX = rect.left + compassPos.x
                  const clientCenterY = rect.top + compassPos.y
                  const currentMouseAngle = Math.atan2(e.evt.clientY - clientCenterY, e.evt.clientX - clientCenterX)
                  
                  // Initialize a new current path for drawing if drawing mode is active
                  if (compassDrawingMode) {
                    useCanvasStore.getState().addPointToCurrent([
                      compassPos.x + compassLegLength * Math.cos((compassRotation * Math.PI) / 180) - RULER,
                      compassPos.y + compassLegLength * Math.sin((compassRotation * Math.PI) / 180)
                    ])
                  }

                  setCompassRotationStart({
                    startMouseAngle: currentMouseAngle,
                    startRotation: compassRotation,
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
              <Circle radius={6} fill="#b8960f" stroke="#8a720c" strokeWidth={1} />
            </Group>
          </Group>
        </Layer>
      )}
      {protractorVisible && (
        <Layer clip={{ x: RULER, y: 0, width: WIDTH, height: HEIGHT }}>
          <Group
            x={protractorPos.x}
            y={protractorPos.y}
            rotation={protractorRotation}
            onClick={cancelBubble}
            onDblClick={cancelBubble}
          >
            {/* Semicircle Glassmorphism fill */}
            <Arc
              innerRadius={0}
              outerRadius={protractorRadius}
              angle={180}
              rotation={180}
              fill="rgba(255, 255, 255, 0.4)"
              stroke="#555"
              strokeWidth={1}
            />
            
            {/* Baseline Bar */}
            <Line
              points={[-protractorRadius, 0, protractorRadius, 0]}
              stroke="#333"
              strokeWidth={2}
            />

            {/* Center crosshair */}
            <Line points={[-8, 0, 8, 0]} stroke="#333" strokeWidth={0.8} />
            <Line points={[0, -8, 0, 8]} stroke="#333" strokeWidth={0.8} />
            <Circle radius={2} fill="#333" />

            {/* Graduation Ticks & Labels */}
            {(() => {
              const elements: React.ReactNode[] = []
              for (let i = 0; i <= 180; i += 5) {
                const rad = ((180 + i) * Math.PI) / 180
                const cos = Math.cos(rad)
                const sin = Math.sin(rad)
                const isMajor = i % 10 === 0
                const isSuper = i % 30 === 0 || i === 45 || i === 135
                const len = isSuper ? 12 : (isMajor ? 8 : 4)

                // Draw tick line
                elements.push(
                  <Line
                    key={`ptick-${i}`}
                    points={[
                      protractorRadius * cos,
                      protractorRadius * sin,
                      (protractorRadius - len) * cos,
                      (protractorRadius - len) * sin,
                    ]}
                    stroke="#333"
                    strokeWidth={isMajor ? 1 : 0.5}
                  />
                )

                // Draw labels for super ticks
                if (isSuper) {
                  const labelRadius = protractorRadius - 22
                  const lx = labelRadius * cos
                  const ly = labelRadius * sin
                  elements.push(
                    <Text
                      key={`plabel-${i}`}
                      x={lx - 8}
                      y={ly - 5}
                      text={`${i}`}
                      fontSize={8}
                      fill="#111"
                      fontFamily="monospace"
                      align="center"
                      verticalAlign="middle"
                    />
                  )
                }
              }
              return elements
            })()}

            {/* Angle Indicator Line & Value */}
            {(() => {
              const rad = ((180 + protractorAngle) * Math.PI) / 180
              const tx = protractorRadius * Math.cos(rad)
              const ty = protractorRadius * Math.sin(rad)
              return (
                <Group>
                  <Line
                    points={[0, 0, tx, ty]}
                    stroke="#3b82f6"
                    strokeWidth={1.5}
                    dash={[4, 2]}
                  />
                  <Text
                    x={tx * 0.5 - 12}
                    y={ty * 0.5 - 12}
                    text={`${protractorAngle}°`}
                    fontSize={11}
                    fontStyle="bold"
                    fill="#1e3a8a"
                    fontFamily="monospace"
                    backgroundColor="white"
                  />
                </Group>
              )
            })()}

            {/* Left Handle (Radius resizing) */}
            <Group
              x={-protractorRadius}
              y={0}
              onClick={cancelBubble}
              onDblClick={cancelBubble}
              onMouseDown={(e) => {
                e.cancelBubble = true
                setProtractorRadiusStart({
                  clientX: e.evt.clientX,
                  startRadius: protractorRadius,
                })
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
              <Circle radius={6} fill="#b8960f" stroke="#8a720c" strokeWidth={1} />
            </Group>

            {/* Center Handle (Move) */}
            <Group
              onClick={cancelBubble}
              onDblClick={cancelBubble}
              onMouseDown={(e) => {
                e.cancelBubble = true
                setProtractorDragStart({
                  clientX: e.evt.clientX,
                  clientY: e.evt.clientY,
                  px: protractorPos.x,
                  py: protractorPos.y,
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
              <Circle radius={7} fill="#555" stroke="#333" strokeWidth={1} />
            </Group>

            {/* Right Handle (Rotation) */}
            <Group
              x={protractorRadius}
              y={0}
              onClick={cancelBubble}
              onDblClick={cancelBubble}
              onMouseDown={(e) => {
                e.cancelBubble = true
                const rect = e.target.getStage()?.container().getBoundingClientRect()
                if (rect) {
                  const clientCenterX = rect.left + protractorPos.x
                  const clientCenterY = rect.top + protractorPos.y
                  const currentMouseAngle = Math.atan2(e.evt.clientY - clientCenterY, e.evt.clientX - clientCenterX)
                  setProtractorRotationStart({
                    startMouseAngle: currentMouseAngle,
                    startRotation: protractorRotation,
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
              <Circle radius={6} fill="#b8960f" stroke="#8a720c" strokeWidth={1} />
            </Group>

            {/* Angle Selector Handle (Slides on Arc & double click draws mark) */}
            {(() => {
              const rad = ((180 + protractorAngle) * Math.PI) / 180
              const hx = protractorRadius * Math.cos(rad)
              const hy = protractorRadius * Math.sin(rad)
              return (
                <Group
                  x={hx}
                  y={hy}
                  onClick={cancelBubble}
                  onDblClick={(e) => {
                    e.cancelBubble = true
                    const rotRad = (protractorRotation * Math.PI) / 180
                    const px = protractorPos.x + hx * Math.cos(rotRad) - hy * Math.sin(rotRad)
                    const py = protractorPos.y + hx * Math.sin(rotRad) + hy * Math.cos(rotRad)
                    
                    const mx = px - RULER
                    const my = py
                    const size = 5
                    
                    useCanvasStore.getState().addPath({
                      points: [
                        mx - size, my,
                        mx + size, my,
                        mx, my,
                        mx, my - size,
                        mx, my + size
                      ],
                      color: '#1a1a1a',
                      strokeWidth: 1.5
                    })
                  }}
                  onMouseDown={(e) => {
                    e.cancelBubble = true
                    const rect = e.target.getStage()?.container().getBoundingClientRect()
                    if (rect) {
                      setProtractorAngleStart({
                        startAngle: protractorAngle,
                        clientCenterX: rect.left + protractorPos.x,
                        clientCenterY: rect.top + protractorPos.y,
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
                  <Circle radius={6} fill="#3b82f6" stroke="#1d4ed8" strokeWidth={1} />
                </Group>
              )
            })()}
          </Group>
        </Layer>
      )}
    </Stage>
  )
}
