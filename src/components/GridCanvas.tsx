import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { Stage, Layer, Line, Rect, Circle, Text, Group, Arc } from 'react-konva'
import type Konva from 'konva'
import { useCanvasStore } from '../store/useCanvasStore'
import InteractiveHandle from './InteractiveHandle'
import { COLORS, SIZES, LIMITS } from '../constants/theme'
import { degToRad, getMouseAngleRelativeTo, isPointInsideCanvas, projectPointToSegment, getDistance, calculatePathLength, findAllIntersections } from '../utils/math'

const GRID = 10
const RULER = 30
const RULER_H = 40

const snapGrid = (v: number, enabled: boolean) => {
  if (!enabled) return v
  const rounded = Math.round(v / GRID) * GRID
  return Math.abs(v - rounded) < 3.5 ? rounded : v
}

function isRulerInsideCanvas(rulerX: number, rulerY: number, length: number, rotation: number, canvasWidth: number, canvasHeight: number): boolean {
  const theta = degToRad(rotation)
  const cos = Math.cos(theta)
  const sin = Math.sin(theta)
  const rx = rulerX + RULER
  const ry = rulerY

  // Center handle position
  const cx = rx + (length / 2) * cos - (RULER_H / 2) * sin
  const cy = ry + (length / 2) * sin + (RULER_H / 2) * cos

  return isPointInsideCanvas(cx, cy, RULER, canvasWidth, canvasHeight)
}

function isCompassInsideCanvas(cx: number, cy: number, _length: number, _rotation: number, canvasWidth: number, canvasHeight: number): boolean {
  return isPointInsideCanvas(cx, cy, RULER, canvasWidth, canvasHeight)
}

function isProtractorInsideCanvas(cx: number, cy: number, _radius: number, _rotation: number, canvasWidth: number, canvasHeight: number): boolean {
  return isPointInsideCanvas(cx, cy, RULER, canvasWidth, canvasHeight)
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
  const canvasWidth = useCanvasStore((s) => s.canvasWidth)
  const canvasHeight = useCanvasStore((s) => s.canvasHeight)
  const gridSnapEnabled = useCanvasStore((s) => s.gridSnapEnabled)
  const isExporting = useCanvasStore((s) => s.isExporting)

  const STAGE_W = canvasWidth + RULER
  const STAGE_H = canvasHeight + RULER

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
  const stageRef = useRef<any>(null)
  
  const setStageRef = useCanvasStore((s) => s.setStageRef)
  useEffect(() => {
    setStageRef(stageRef.current)
    return () => setStageRef(null)
  }, [setStageRef])

  const effectiveLen = resizeLen ?? rulerLength

  const intersections = useMemo(() => {
    const list = findAllIntersections(paths, currentPoints)
    // Add centers of cross marks (Point tool and Protractor marks) as snapping anchors
    for (const path of paths) {
      if (path.points.length === 10) {
        const pts = path.points
        const isCross = 
          pts[1] === pts[3] && 
          pts[3] === pts[5] && 
          pts[4] === pts[6] && 
          pts[6] === pts[8]
        if (isCross) {
          list.push({ x: pts[4], y: pts[5] })
        }
      }
    }
    return list
  }, [paths, currentPoints])

  const isCloseToAnyHandle = useCallback((mx: number, my: number) => {
    const checkDist = (hx: number, hy: number) => getDistance(mx, my, hx, hy) < 15

    if (rulerVisible) {
      const theta = degToRad(rulerRotation)
      const cos = Math.cos(theta)
      const sin = Math.sin(theta)
      const rx = rulerPos.x + RULER
      const ry = rulerPos.y
      
      if (checkDist(rx + (effectiveLen / 2) * cos - (RULER_H / 2) * sin, ry + (effectiveLen / 2) * sin + (RULER_H / 2) * cos)) return true
      if (checkDist(rx + (effectiveLen / 2) * cos - (-15) * sin, ry + (effectiveLen / 2) * sin + (-15) * cos)) return true
      if (checkDist(rx + effectiveLen * cos - (RULER_H / 2) * sin, ry + effectiveLen * sin + (RULER_H / 2) * cos)) return true
    }

    if (compassVisible) {
      const theta = degToRad(compassRotation)
      const cos = Math.cos(theta)
      const sin = Math.sin(theta)
      if (checkDist(compassPos.x, compassPos.y)) return true
      if (checkDist(compassPos.x - compassLegLength, compassPos.y)) return true
      if (checkDist(compassPos.x + compassLegLength * cos, compassPos.y + compassLegLength * sin)) return true
    }

    if (protractorVisible) {
      const theta = degToRad(protractorRotation)
      const cos = Math.cos(theta)
      const sin = Math.sin(theta)
      if (checkDist(protractorPos.x, protractorPos.y)) return true
      if (checkDist(protractorPos.x - protractorRadius * cos, protractorPos.y - protractorRadius * sin)) return true
      if (checkDist(protractorPos.x + protractorRadius * cos, protractorPos.y + protractorRadius * sin)) return true

      const rad = degToRad(180 + protractorAngle)
      const hx = protractorRadius * Math.cos(rad)
      const hy = protractorRadius * Math.sin(rad)
      const px = protractorPos.x + hx * cos - hy * sin
      const py = protractorPos.y + hx * sin + hy * cos
      if (checkDist(px, py)) return true
    }

    return false
  }, [rulerVisible, rulerPos, rulerRotation, effectiveLen, compassVisible, compassPos, compassRotation, compassLegLength, protractorVisible, protractorPos, protractorRotation, protractorRadius, protractorAngle])

  const getSnappedPosition = useCallback((mx: number, my: number) => {
    // 1. Prioritize line intersections (Euclidea magnet)
    if (gridSnapEnabled) {
      let bestIntersection = null
      let bestIntersectionDist = 8 // Snap radius of 8px
      for (const pt of intersections) {
        const ptGlobalX = pt.x + RULER
        const ptGlobalY = pt.y
        const dist = getDistance(mx, my, ptGlobalX, ptGlobalY)
        if (dist < bestIntersectionDist) {
          bestIntersectionDist = dist
          bestIntersection = { x: ptGlobalX, y: ptGlobalY }
        }
      }
      if (bestIntersection) {
        return bestIntersection
      }
    }

    // 2. Snap to Ruler top or bottom drawing edge if near or inside its body
    if (rulerVisible) {
      const theta = degToRad(rulerRotation)
      const cos = Math.cos(theta)
      const sin = Math.sin(theta)
      const rx = rulerPos.x + RULER
      const ry = rulerPos.y

      // Top edge
      const tl = { x: rx, y: ry }
      const tr = { x: rx + effectiveLen * cos, y: ry + effectiveLen * sin }
      
      // Bottom edge
      const bl = { x: rx - RULER_H * sin, y: ry + RULER_H * cos }
      const br = { x: rx + effectiveLen * cos - RULER_H * sin, y: ry + effectiveLen * sin + RULER_H * cos }

      const dx = mx - tl.x
      const dy = my - tl.y
      
      // Local Y coordinate (distance from top edge along the perpendicular direction, downwards)
      const localY = dx * (-sin) + dy * cos
      // Local X coordinate (distance along the top edge)
      const localX = dx * cos + dy * sin
      
      const isInsideOrNearBody = localX >= -20 && localX <= effectiveLen + 20 && localY >= -20 && localY <= RULER_H + 20

      if (isInsideOrNearBody) {
        if (localY <= RULER_H / 2) {
          // Snap to top edge
          const proj = projectPointToSegment(mx, my, tl.x, tl.y, tr.x, tr.y)
          return { x: proj.x, y: proj.y }
        } else {
          // Snap to bottom edge
          const proj = projectPointToSegment(mx, my, bl.x, bl.y, br.x, br.y)
          return { x: proj.x, y: proj.y }
        }
      }
    }

    // 3. Snap to Protractor baseline if close or inside the bottom half
    if (protractorVisible) {
      const theta = degToRad(protractorRotation)
      const cos = Math.cos(theta)
      const sin = Math.sin(theta)

      const blX = protractorPos.x - protractorRadius * cos
      const blY = protractorPos.y - protractorRadius * sin
      const brX = protractorPos.x + protractorRadius * cos
      const brY = protractorPos.y + protractorRadius * sin

      const proj = projectPointToSegment(mx, my, blX, blY, brX, brY)
      // Allow snapping if cursor is within 40px of the baseline (easy to grab)
      if (proj.distance < 40) {
        return { x: proj.x, y: proj.y }
      }
    }

    // 4. Default magnetic grid snap
    return { x: snapGrid(mx, gridSnapEnabled), y: snapGrid(my, gridSnapEnabled) }
  }, [rulerVisible, rulerRotation, rulerPos, effectiveLen, gridSnapEnabled, intersections, protractorVisible, protractorPos, protractorRadius, protractorRotation])

  const gridLines = useMemo(() => {
    const minor: number[][] = []
    const major: number[][] = []
    const ext = 200
    for (let x = -ext; x <= canvasWidth + ext; x += GRID) {
      const arr = x % (GRID * 10) === 0 ? major : minor
      arr.push([x + RULER, -ext, x + RULER, canvasHeight + ext])
    }
    for (let y = -ext; y <= canvasHeight + ext; y += GRID) {
      const arr = y % (GRID * 10) === 0 ? major : minor
      arr.push([-ext + RULER, y, canvasWidth + ext + RULER, y])
    }
    return { minor, major }
  }, [canvasWidth, canvasHeight])

  const axisRulers = useMemo(() => {
    const els: React.ReactNode[] = []
    const tc = '#555'

    for (let gx = 0; gx <= canvasWidth; gx += GRID) {
      const sx = gx + RULER
      const cm = gx % (GRID * 10) === 0
      const len = cm ? 10 : 5
      els.push(<Line key={`br-${gx}`} points={[sx, canvasHeight, sx, canvasHeight + len]} stroke={tc} strokeWidth={cm ? 1 : 0.5} listening={false} />)
      if (cm) {
        const l = `${gx / 100}`
        els.push(<Text key={`bl-${gx}`} x={sx - l.length * 3} y={canvasHeight + 12} text={l} fontSize={9} fill={tc} fontFamily="monospace" listening={false} />)
      }
    }

    for (let gy = 0; gy <= canvasHeight; gy += GRID) {
      const sy = gy
      const cm = gy % (GRID * 10) === 0
      const len = cm ? 10 : 5
      els.push(<Line key={`lr-${gy}`} points={[RULER, sy, RULER - len, sy]} stroke={tc} strokeWidth={cm ? 1 : 0.5} listening={false} />)
      if (cm) {
        const l = `${(canvasHeight - gy) / 100}`
        els.push(<Text key={`ll-${gy}`} x={RULER - 16} y={sy - 4} text={l} fontSize={9} fill={tc} fontFamily="monospace" listening={false} />)
      }
    }

    return els
  }, [canvasWidth, canvasHeight])

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

  const finalizePoly = useCallback(() => {
    const st = useCanvasStore.getState()
    if (st.currentPoints.length >= 2) {
      st.addPath({ points: [...st.currentPoints], color: COLORS.black, strokeWidth: SIZES.strokeMedium })
    }
    st.clearCurrent()
  }, [])

  const handleMouseDown = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    if (e.evt.button !== 0) return
    if (e.target && e.target.name() === 'handle') return
    const st = useCanvasStore.getState()
    if (st.tool !== 'freehand') return

    const pos = e.target.getStage()?.getPointerPosition()
    if (!pos || isCloseToAnyHandle(pos.x, pos.y)) return

    freehand.current = true
    const snapped = getSnappedPosition(pos.x, pos.y)
    const sx = snapped.x - RULER
    const sy = snapped.y
    st.addPointToCurrent([sx, sy])
  }, [getSnappedPosition, isCloseToAnyHandle])

  const handleClick = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    if (e.evt.button !== 0) return
    if (e.target && e.target.name() === 'handle') return
    const st = useCanvasStore.getState()
    
    const pos = e.target.getStage()?.getPointerPosition()
    if (!pos || isCloseToAnyHandle(pos.x, pos.y)) return

    if (st.tool === 'polyline') {
      const now = Date.now()
      if (now - lastClick.current < 300) {
        lastClick.current = 0
        finalizePoly()
        return
      }
      lastClick.current = now

      const snapped = getSnappedPosition(pos.x, pos.y)
      st.addPointToCurrent([snapped.x - RULER, snapped.y])
    } else if (st.tool === 'point') {
      const snapped = getSnappedPosition(pos.x, pos.y)
      const mx = snapped.x - RULER
      const my = snapped.y
      const size = SIZES.crossMarkSize

      st.addPath({
        points: [
          mx - size, my,
          mx + size, my,
          mx, my,
          mx, my - size,
          mx, my + size
        ],
        color: COLORS.black,
        strokeWidth: SIZES.strokeMedium
      })
    }
  }, [finalizePoly, getSnappedPosition, isCloseToAnyHandle])

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
      if (!pos || isCloseToAnyHandle(pos.x, pos.y)) return
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
    if (st.tool === 'polyline' || st.tool === 'point' || st.tool === 'freehand') {
      const pos = e.target.getStage()?.getPointerPosition()
      if (!pos || isCloseToAnyHandle(pos.x, pos.y)) { setPreviewPos(null); return }
      const snapped = getSnappedPosition(pos.x, pos.y)
      setPreviewPos({ x: snapped.x - RULER, y: snapped.y })
    } else {
      setPreviewPos(null)
    }
  }, [getSnappedPosition, isCloseToAnyHandle])


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
          st.addPath({ points: [...st.currentPoints], color: COLORS.black, strokeWidth: SIZES.strokeMedium })
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
          st.addPath({ points: [...st.currentPoints], color: COLORS.black, strokeWidth: SIZES.strokeMedium })
        }
        st.clearCurrent()
      }

      // Revert cursor to default
      if (stageRef.current) {
        stageRef.current.container().style.cursor = 'default'
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
        const newLen = snapGrid(resizeStart.length + projectedDelta, gridSnapEnabled)
        const clampedLen = Math.max(LIMITS.rulerMinLength, Math.min(LIMITS.rulerMaxLength, newLen))

        let newRulerX = resizeStart.rulerX
        const rightEdge = newRulerX + RULER + clampedLen
        if (rightEdge > RULER + canvasWidth) {
          newRulerX = RULER + canvasWidth - clampedLen - RULER
        }
        newRulerX = Math.max(0, newRulerX)

        if (isRulerInsideCanvas(newRulerX, rulerPos.y, clampedLen, rulerRotation, canvasWidth, canvasHeight)) {
          setResizeLen(clampedLen)
          useCanvasStore.getState().setRulerPos({ x: newRulerX, y: rulerPos.y })
        }
      } else if (dragStart) {
        const deltaX = e.clientX - dragStart.clientX
        const deltaY = e.clientY - dragStart.clientY

        const newRulerX = snapGrid(dragStart.rulerX + deltaX, gridSnapEnabled)
        const newRulerY = snapGrid(dragStart.rulerY + deltaY, gridSnapEnabled)

        if (isRulerInsideCanvas(newRulerX, newRulerY, effectiveLen, rulerRotation, canvasWidth, canvasHeight)) {
          useCanvasStore.getState().setRulerPos({ x: newRulerX, y: newRulerY })
        }
      } else if (rotationStart) {
        const currentMouseAngle = Math.atan2(e.clientY - rotationStart.clientCenterY, e.clientX - rotationStart.clientCenterX)
        const deltaAngleRad = currentMouseAngle - rotationStart.startMouseAngle
        const deltaAngleDeg = deltaAngleRad * (180 / Math.PI)

        let newRotation = (rotationStart.startRotation + deltaAngleDeg) % 360
        if (newRotation < 0) newRotation += 360

        // Snap to cardinal angles (0, 90, 180, 270) when within 0.2 degrees
        const snapThreshold = 0.2
        const cardinalAngles = [0, 90, 180, 270, 360]
        for (const target of cardinalAngles) {
          if (Math.abs(newRotation - target) < snapThreshold) {
            newRotation = target % 360
            break
          }
        }

        newRotation = Math.round(newRotation * 10) / 10
        if (isRulerInsideCanvas(rulerPos.x, rulerPos.y, effectiveLen, newRotation, canvasWidth, canvasHeight)) {
          setRulerRotation(newRotation)
        }
      } else if (compassRadiusStart) {
        const deltaX = compassRadiusStart.clientX - e.clientX
        const newRadius = Math.max(LIMITS.compassMinRadius, compassRadiusStart.startRadius + deltaX)
        if (isCompassInsideCanvas(compassPos.x, compassPos.y, newRadius, compassRotation, canvasWidth, canvasHeight)) {
          useCanvasStore.getState().setCompassLegLength(newRadius)
        }
      } else if (compassDragStart) {
        const deltaX = e.clientX - compassDragStart.clientX
        const deltaY = e.clientY - compassDragStart.clientY

        const newCompassX = snapGrid(compassDragStart.compassX + deltaX, gridSnapEnabled)
        const newCompassY = snapGrid(compassDragStart.compassY + deltaY, gridSnapEnabled)

        if (isCompassInsideCanvas(newCompassX, newCompassY, compassLegLength, compassRotation, canvasWidth, canvasHeight)) {
          useCanvasStore.getState().setCompassPos({ x: newCompassX, y: newCompassY })
        }
      } else if (compassRotationStart) {
        const currentMouseAngle = Math.atan2(e.clientY - compassRotationStart.clientCenterY, e.clientX - compassRotationStart.clientCenterX)
        const deltaAngleRad = currentMouseAngle - compassRotationStart.startMouseAngle
        const deltaAngleDeg = deltaAngleRad * (180 / Math.PI)

        let newRotation = (compassRotationStart.startRotation + deltaAngleDeg) % 360
        if (newRotation < 0) newRotation += 360

        newRotation = Math.round(newRotation)
        if (isCompassInsideCanvas(compassPos.x, compassPos.y, compassLegLength, newRotation, canvasWidth, canvasHeight)) {
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

        const newX = snapGrid(protractorDragStart.px + deltaX, gridSnapEnabled)
        const newY = snapGrid(protractorDragStart.py + deltaY, gridSnapEnabled)

        if (isProtractorInsideCanvas(newX, newY, protractorRadius, protractorRotation, canvasWidth, canvasHeight)) {
          useCanvasStore.getState().setProtractorPos({ x: newX, y: newY })
        }
      } else if (protractorRotationStart) {
        const currentMouseAngle = Math.atan2(e.clientY - protractorRotationStart.clientCenterY, e.clientX - protractorRotationStart.clientCenterX)
        const deltaAngleRad = currentMouseAngle - protractorRotationStart.startMouseAngle
        const deltaAngleDeg = deltaAngleRad * (180 / Math.PI)

        let newRotation = (protractorRotationStart.startRotation + deltaAngleDeg) % 360
        if (newRotation < 0) newRotation += 360

        newRotation = Math.round(newRotation)
        if (isProtractorInsideCanvas(protractorPos.x, protractorPos.y, protractorRadius, newRotation, canvasWidth, canvasHeight)) {
          setProtractorRotation(newRotation)
        }
      } else if (protractorRadiusStart) {
        const deltaX = protractorRadiusStart.clientX - e.clientX
        const newRadius = Math.max(LIMITS.protractorMinRadius, protractorRadiusStart.startRadius + deltaX)
        if (isProtractorInsideCanvas(protractorPos.x, protractorPos.y, newRadius, protractorRotation, canvasWidth, canvasHeight)) {
          useCanvasStore.getState().setProtractorRadius(newRadius)
        }
      } else if (protractorAngleStart) {
        let mouseAngleRad = Math.atan2(e.clientY - protractorAngleStart.clientCenterY, e.clientX - protractorAngleStart.clientCenterX)
        let mouseAngleDeg = mouseAngleRad * (180 / Math.PI)

        // Normalize mouse angle to local coordinate system of the protractor
        let mouseAngleLocal = (mouseAngleDeg - protractorRotation) % 360
        if (mouseAngleLocal < 0) mouseAngleLocal += 360

        let localAngle: number
        if (mouseAngleLocal >= 180 && mouseAngleLocal <= 360) {
          // Upper half: Map 180 -> 0 (left) and 360 -> 180 (right)
          localAngle = mouseAngleLocal - 180
        } else {
          // Lower half: Clamp to nearest edge to prevent jumps
          if (mouseAngleLocal < 90) {
            localAngle = 180 // Clamp to right edge
          } else {
            localAngle = 0   // Clamp to left edge
          }
        }

        useCanvasStore.getState().setProtractorAngle(Math.round(localAngle))
      }
    }

    window.addEventListener('mousemove', handleWindowMouseMove)
    return () => window.removeEventListener('mousemove', handleWindowMouseMove)
  }, [resizeStart, dragStart, rotationStart, compassRadiusStart, compassDragStart, compassRotationStart, protractorDragStart, protractorRotationStart, protractorRadiusStart, protractorAngleStart, rulerPos.x, rulerPos.y, compassPos.x, compassPos.y, protractorPos.x, protractorPos.y, effectiveLen, rulerRotation, setRulerRotation, compassRotation, compassLegLength, compassDrawingMode, protractorRadius, protractorRotation, setProtractorRotation, canvasWidth, canvasHeight])

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
      ref={stageRef}
      width={STAGE_W}
      height={STAGE_H}
      onMouseDown={handleMouseDown}
      onClick={handleClick}
      onDblClick={handleDblClick}
      onContextMenu={handleContextMenu}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setPreviewPos(null)}
    >
      {!isExporting && (
        <Layer>
          <Rect x={0} y={0} width={RULER} height={canvasHeight} fill="#f0f0f0" listening={false} />
          <Rect x={RULER} y={canvasHeight} width={canvasWidth} height={RULER} fill="#f0f0f0" listening={false} />
        </Layer>
      )}

      <Layer clip={{ x: RULER, y: 0, width: canvasWidth, height: canvasHeight }}>
        <Rect x={RULER} y={0} width={canvasWidth} height={canvasHeight} fill="white" listening={false} />
        {!isExporting && gridLines.minor.map((p, i) => (
          <Line key={`mi-${i}`} points={p} stroke="#e8e8e8" strokeWidth={0.5} listening={false} />
        ))}
        {!isExporting && gridLines.major.map((p, i) => (
          <Line key={`ma-${i}`} points={p} stroke="#b0b0b0" strokeWidth={1.5} listening={false} />
        ))}
      </Layer>

      {!isExporting && <Layer>{axisRulers}</Layer>}

      <Layer clip={{ x: RULER, y: 0, width: canvasWidth, height: canvasHeight }}>
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
        {!isExporting && currentPoints.length >= 2 && (
          <Line
            points={currentPoints.reduce<number[]>((a, v, i) => (a.push(i % 2 === 0 ? v + RULER : v), a), [])}
            stroke="#2563eb"
            strokeWidth={1.5}
            lineCap="round"
            lineJoin="round"
            listening={false}
          />
        )}
        {!isExporting && previewLine && (
          <Line points={previewLine} stroke="#2563eb" strokeWidth={1.5} dash={[6, 4]} listening={false} />
        )}
        {!isExporting && (tool === 'polyline' || tool === 'freehand') && previewPos && !resizeStart && !dragStart && !rotationStart && (
          <Circle x={previewPos.x + RULER} y={previewPos.y} radius={3} fill="#2563eb" opacity={0.6} listening={false} />
        )}
        {!isExporting && tool === 'point' && previewPos && !resizeStart && !dragStart && !rotationStart && (
          <Group x={previewPos.x + RULER} y={previewPos.y} opacity={0.6} listening={false}>
            <Line points={[-SIZES.crossMarkSize, 0, SIZES.crossMarkSize, 0]} stroke="#2563eb" strokeWidth={1.5} />
            <Line points={[0, -SIZES.crossMarkSize, 0, SIZES.crossMarkSize]} stroke="#2563eb" strokeWidth={1.5} />
          </Group>
        )}

        {/* Magnetic intersection points visual indicator (Euclidea style) */}
        {!isExporting && gridSnapEnabled && intersections.map((pt, i) => (
          <Circle
            key={`int-${i}`}
            x={pt.x + RULER}
            y={pt.y}
            radius={2}
            fill="#3b82f6"
            stroke="#1d4ed8"
            strokeWidth={0.5}
            opacity={0.7}
            listening={false}
          />
        ))}

        {/* Tooltip measurements during drawing */}
        {(() => {
          if (isExporting) return null
          if (freehand.current && currentPoints.length >= 2) {
            const x = currentPoints[currentPoints.length - 2] + RULER
            const y = currentPoints[currentPoints.length - 1]
            const len = calculatePathLength(currentPoints) / 100
            return (
              <Group x={x + 12} y={y - 12} listening={false}>
                <Rect width={60} height={18} fill="rgba(0,0,0,0.6)" cornerRadius={3} />
                <Text text={`${len.toFixed(1)} cm`} fill="white" fontSize={10} fontFamily="monospace" x={6} y={4} />
              </Group>
            )
          }
          if (tool === 'polyline' && currentPoints.length >= 2 && previewPos) {
            const x = previewPos.x + RULER
            const y = previewPos.y
            const accumLen = calculatePathLength(currentPoints) / 100
            const segmentLen = getDistance(
              currentPoints[currentPoints.length - 2],
              currentPoints[currentPoints.length - 1],
              previewPos.x,
              previewPos.y
            ) / 100
            const totalLen = accumLen + segmentLen
            const txt = `Seg: ${segmentLen.toFixed(1)} cm\nTotal: ${totalLen.toFixed(1)} cm`
            return (
              <Group x={x + 12} y={y - 28} listening={false}>
                <Rect width={100} height={30} fill="rgba(0,0,0,0.6)" cornerRadius={3} />
                <Text text={txt} fill="white" fontSize={9} fontFamily="monospace" x={6} y={4} />
              </Group>
            )
          }
          return null
        })()}
      </Layer>

      {rulerVisible && !isExporting && (
        <Layer clip={{ x: RULER, y: 0, width: canvasWidth, height: canvasHeight }}>
          <Group
            ref={rulerGroupRef}
            x={rulerPos.x + RULER}
            y={rulerPos.y}
            rotation={rulerRotation}
          >
            <Rect width={effectiveLen} height={RULER_H} fill="#ffd700" opacity={0.25} stroke={COLORS.handleStrokeIdle} strokeWidth={1} cornerRadius={2} listening={false} />
            {rulerContent.ticks}
            {rulerContent.labels}

            {/* Total ruler length display */}
            <Text
              x={effectiveLen / 2 - 40}
              y={RULER_H - 14}
              width={80}
              text={`${(effectiveLen / 100).toFixed(1)} cm`}
              fontSize={10}
              fontStyle="bold"
              fontFamily="monospace"
              fill="#8a720c"
              align="center"
              listening={false}
            />

            {/* Central move handle */}
            <InteractiveHandle
              x={effectiveLen / 2}
              y={RULER_H / 2}
              cursorType="move"
              radius={SIZES.handleRadiusSmall}
              onMouseDown={(e) => {
                setDragStart({
                  clientX: e.evt.clientX,
                  clientY: e.evt.clientY,
                  rulerX: rulerPos.x,
                  rulerY: rulerPos.y,
                })
              }}
            />

            {/* Connecting line for rotation handle */}
            <Line
              points={[effectiveLen / 2, RULER_H / 2, effectiveLen / 2, -15]}
              stroke="#b8960f"
              strokeWidth={1}
              dash={[2, 2]}
            />

            {/* Rotation handle */}
            <InteractiveHandle
              x={effectiveLen / 2}
              y={-15}
              cursorType="rotate"
              radius={SIZES.handleRadiusSmall}
              onMouseDown={(e) => {
                const stage = e.target.getStage()
                setRotationStart({
                  startMouseAngle: getMouseAngleRelativeTo(e, { x: rulerPos.x + RULER, y: rulerPos.y }, stage),
                  startRotation: rulerRotation,
                  clientCenterX: stage?.container().getBoundingClientRect().left! + rulerPos.x + RULER,
                  clientCenterY: stage?.container().getBoundingClientRect().top! + rulerPos.y,
                })
              }}
            />

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
            <InteractiveHandle
              x={effectiveLen}
              y={RULER_H / 2}
              cursorType="ew-resize"
              radius={SIZES.handleRadiusSmall}
              onMouseDown={(e) => {
                setResizeStart({
                  clientX: e.evt.clientX,
                  clientY: e.evt.clientY,
                  length: rulerLength,
                  rulerX: rulerPos.x,
                })
                setResizeLen(rulerLength)
              }}
            />
          </Group>
        </Layer>
      )}
      {compassVisible && !isExporting && (
        <Layer clip={{ x: RULER, y: 0, width: canvasWidth, height: canvasHeight }}>
          <Group
            x={compassPos.x}
            y={compassPos.y}
          >
            {/* Left leg (fixed radius indicator) */}
            <Line
              points={[0, 0, -compassLegLength, 0]}
              stroke="#555"
              strokeWidth={3}
              lineCap="round"
              listening={false}
            />
            {/* Radius measurement on left leg */}
            <Text
              x={-compassLegLength + 10}
              y={-14}
              width={compassLegLength - 20}
              text={`${(compassLegLength / 100).toFixed(1)} cm`}
              fontSize={10}
              fontFamily="monospace"
              fill="#555"
              align="center"
              listening={false}
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
              listening={false}
            />

            {/* Left Handle (Radius resizing) */}
            <InteractiveHandle
              x={-compassLegLength}
              y={0}
              cursorType="ew-resize"
              radius={SIZES.handleRadiusStandard}
              onMouseDown={(e) => {
                setCompassRadiusStart({
                  clientX: e.evt.clientX,
                  startRadius: compassLegLength,
                  compassX: compassPos.x,
                })
              }}
            />

            {/* Center Handle (Move & Toggle Drawing Mode) */}
            <InteractiveHandle
              x={0}
              y={0}
              cursorType="move"
              radius={SIZES.handleRadiusCenter}
              isActive={compassDrawingMode}
              onDblClick={() => {
                useCanvasStore.getState().setCompassDrawingMode(!compassDrawingMode)
              }}
              onMouseDown={(e) => {
                setCompassDragStart({
                  clientX: e.evt.clientX,
                  clientY: e.evt.clientY,
                  compassX: compassPos.x,
                  compassY: compassPos.y,
                })
              }}
            />

            {/* Right Handle (Rotation & Drawing) */}
            <InteractiveHandle
              x={compassLegLength * Math.cos((compassRotation * Math.PI) / 180)}
              y={compassLegLength * Math.sin((compassRotation * Math.PI) / 180)}
              cursorType="rotate"
              radius={SIZES.handleRadiusStandard}
              onMouseDown={(e) => {
                const stage = e.target.getStage()
                const clientCenterX = stage?.container().getBoundingClientRect().left! + compassPos.x
                const clientCenterY = stage?.container().getBoundingClientRect().top! + compassPos.y
                const currentMouseAngle = getMouseAngleRelativeTo(e, compassPos, stage)
                
                if (compassDrawingMode) {
                  useCanvasStore.getState().addPointToCurrent([
                    compassPos.x + compassLegLength * Math.cos(degToRad(compassRotation)) - RULER,
                    compassPos.y + compassLegLength * Math.sin(degToRad(compassRotation))
                  ])
                }

                setCompassRotationStart({
                  startMouseAngle: currentMouseAngle,
                  startRotation: compassRotation,
                  clientCenterX,
                  clientCenterY,
                })
              }}
            />
          </Group>
        </Layer>
      )}
      {protractorVisible && !isExporting && (
        <Layer clip={{ x: RULER, y: 0, width: canvasWidth, height: canvasHeight }}>
          <Group
            x={protractorPos.x}
            y={protractorPos.y}
            rotation={protractorRotation}
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
              listening={false}
            />
            
            {/* Baseline Bar */}
            <Line
              points={[-protractorRadius, 0, protractorRadius, 0]}
              stroke="#333"
              strokeWidth={2}
              listening={false}
            />

            {/* Center crosshair */}
            <Line points={[-8, 0, 8, 0]} stroke="#333" strokeWidth={0.8} listening={false} />
            <Line points={[0, -8, 0, 8]} stroke="#333" strokeWidth={0.8} listening={false} />
            <Circle radius={2} fill="#333" listening={false} />

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
                    stroke="#22c55e"
                    strokeWidth={1.5}
                    dash={[4, 2]}
                  />
                  <Text
                    x={tx * 0.5 - 12}
                    y={ty * 0.5 - 12}
                    text={`${protractorAngle}°`}
                    fontSize={11}
                    fontStyle="bold"
                    fill="#15803d"
                    fontFamily="monospace"
                    backgroundColor="white"
                  />
                </Group>
              )
            })()}

            {/* Left Handle (Radius resizing) */}
            <Text
              x={-protractorRadius - 65}
              y={-5}
              width={60}
              text={`R: ${(protractorRadius / 100).toFixed(1)} cm`}
              fontSize={9}
              fontFamily="monospace"
              fill="#555"
              align="right"
              listening={false}
            />
            <InteractiveHandle
              x={-protractorRadius}
              y={0}
              cursorType="ew-resize"
              radius={SIZES.handleRadiusStandard}
              onMouseDown={(e) => {
                setProtractorRadiusStart({
                  clientX: e.evt.clientX,
                  startRadius: protractorRadius,
                })
              }}
            />

            {/* Center Handle (Move) */}
            <InteractiveHandle
              x={0}
              y={0}
              cursorType="move"
              radius={SIZES.handleRadiusCenter}
              onMouseDown={(e) => {
                setProtractorDragStart({
                  clientX: e.evt.clientX,
                  clientY: e.evt.clientY,
                  px: protractorPos.x,
                  py: protractorPos.y,
                })
              }}
            />

            {/* Right Handle (Rotation) */}
            <InteractiveHandle
              x={protractorRadius}
              y={0}
              cursorType="rotate"
              radius={SIZES.handleRadiusStandard}
              onMouseDown={(e) => {
                const stage = e.target.getStage()
                setProtractorRotationStart({
                  startMouseAngle: getMouseAngleRelativeTo(e, protractorPos, stage),
                  startRotation: protractorRotation,
                  clientCenterX: stage?.container().getBoundingClientRect().left! + protractorPos.x,
                  clientCenterY: stage?.container().getBoundingClientRect().top! + protractorPos.y,
                })
              }}
            />

            {/* Angle Selector Handle (Slides on Arc & double click draws mark) */}
            {(() => {
              const rad = degToRad(180 + protractorAngle)
              const hx = protractorRadius * Math.cos(rad)
              const hy = protractorRadius * Math.sin(rad)
              return (
                <InteractiveHandle
                  x={hx}
                  y={hy}
                  cursorType="rotate"
                  radius={SIZES.handleRadiusStandard}
                  fill="#22c55e"
                  stroke="#15803d"
                  onDblClick={() => {
                    const rotRad = degToRad(protractorRotation)
                    const px = protractorPos.x + hx * Math.cos(rotRad) - hy * Math.sin(rotRad)
                    const py = protractorPos.y + hx * Math.sin(rotRad) + hy * Math.cos(rotRad)
                    
                    const mx = px - RULER
                    const my = py
                    const size = SIZES.crossMarkSize
                    
                    useCanvasStore.getState().addPath({
                      points: [
                        mx - size, my,
                        mx + size, my,
                        mx, my,
                        mx, my - size,
                        mx, my + size
                      ],
                      color: COLORS.black,
                      strokeWidth: SIZES.strokeMedium
                    })
                  }}
                  onMouseDown={(e) => {
                    const stage = e.target.getStage()
                    setProtractorAngleStart({
                      startAngle: protractorAngle,
                      clientCenterX: stage?.container().getBoundingClientRect().left! + protractorPos.x,
                      clientCenterY: stage?.container().getBoundingClientRect().top! + protractorPos.y,
                    })
                  }}
                />
              )
            })()}
          </Group>
        </Layer>
      )}
    </Stage>
  )
}
