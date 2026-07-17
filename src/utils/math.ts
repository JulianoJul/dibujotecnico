export const degToRad = (deg: number) => (deg * Math.PI) / 180
export const radToDeg = (rad: number) => (rad * 180) / Math.PI

export const getMouseAngleRelativeTo = (
  e: MouseEvent | import('konva/lib/Node').KonvaEventObject<MouseEvent>,
  centerPos: { x: number; y: number },
  stage: import('konva/lib/Stage').Stage | null
) => {
  const rect = stage?.container().getBoundingClientRect()
  if (!rect) return 0
  
  // Type assertion or checking since React-Konva events have 'evt' and native ones don't
  const clientY = 'evt' in e ? (e as any).evt.clientY : (e as MouseEvent).clientY
  const clientX = 'evt' in e ? (e as any).evt.clientX : (e as MouseEvent).clientX

  const clientCenterX = rect.left + centerPos.x
  const clientCenterY = rect.top + centerPos.y
  
  return Math.atan2(clientY - clientCenterY, clientX - clientCenterX)
}

export const isPointInsideCanvas = (
  x: number,
  y: number,
  rulerOffset: number,
  canvasWidth: number,
  canvasHeight: number,
  eps: number = 0.01
) => {
  return x >= rulerOffset - eps && x <= rulerOffset + canvasWidth + eps && y >= -eps && y <= canvasHeight + eps
}

export const isToolInsideCanvas = (
  x: number,
  y: number,
  rulerOffset: number,
  canvasWidth: number,
  canvasHeight: number
) => {
  return isPointInsideCanvas(x, y, rulerOffset, canvasWidth, canvasHeight)
}

export const projectPointToSegment = (
  px: number, py: number,
  ax: number, ay: number,
  bx: number, by: number
): { x: number; y: number; distance: number } => {
  const abx = bx - ax
  const aby = by - ay
  const apx = px - ax
  const apy = py - ay

  const ab2 = abx * abx + aby * aby
  if (ab2 === 0) {
    const dx = px - ax
    const dy = py - ay
    return { x: ax, y: ay, distance: Math.sqrt(dx * dx + dy * dy) }
  }

  let t = (apx * abx + apy * aby) / ab2
  t = Math.max(0, Math.min(1, t))

  const closestX = ax + t * abx
  const closestY = ay + t * aby
  const dx = px - closestX
  const dy = py - closestY

  return { x: closestX, y: closestY, distance: Math.sqrt(dx * dx + dy * dy) }
}

export const getDistance = (x1: number, y1: number, x2: number, y2: number): number => {
  const dx = x2 - x1
  const dy = y2 - y1
  return Math.sqrt(dx * dx + dy * dy)
}

export const calculatePathLength = (points: number[]): number => {
  let len = 0
  for (let i = 2; i < points.length; i += 2) {
    len += getDistance(points[i - 2], points[i - 1], points[i], points[i + 1])
  }
  return len
}

export const createCrossMarkPath = (x: number, y: number, size: number): number[] => {
  return [
    x - size, y,
    x + size, y,
    x, y,
    x, y - size,
    x, y + size
  ]
}

export interface Point2D {
  x: number
  y: number
}

export const getSegmentIntersection = (
  ax: number, ay: number, bx: number, by: number,
  cx: number, cy: number, dx: number, dy: number
): Point2D | null => {
  const denom = (bx - ax) * (dy - cy) - (by - ay) * (dx - cx)
  if (denom === 0) return null // Parallel

  const t = ((cx - ax) * (dy - cy) - (cy - ay) * (dx - cx)) / denom
  const u = ((cx - ax) * (by - ay) - (cy - ay) * (bx - ax)) / denom

  if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
    return {
      x: ax + t * (bx - ax),
      y: ay + t * (by - ay)
    }
  }
  return null
}

export const findAllIntersections = (
  paths: { points: number[] }[],
  currentPoints: number[]
): Point2D[] => {
  const segments: { pathId: number; segIdx: number; ax: number; ay: number; bx: number; by: number }[] = []

  const addPathSegments = (points: number[], pathId: number) => {
    if (points.length < 4) return
    // For long paths (freehand), downsample segment checks to keep it fast
    const step = points.length > 30 ? 6 : 2
    let segIdx = 0
    for (let i = 0; i < points.length - 2; i += step) {
      const nextIdx = Math.min(i + step, points.length - 2)
      segments.push({
        pathId,
        segIdx: segIdx++,
        ax: points[i],
        ay: points[i + 1],
        bx: points[nextIdx],
        by: points[nextIdx + 1]
      })
    }
  }

  // Gather segments from all saved paths
  for (let i = 0; i < paths.length; i++) {
    addPathSegments(paths[i].points, i)
  }
  // Gather segments from the current active path (use pathId = -1)
  addPathSegments(currentPoints, -1)

  const intersections: Point2D[] = []
  const maxIntersections = 50 // Limit to prevent performance issues

  for (let i = 0; i < segments.length; i++) {
    for (let j = i + 1; j < segments.length; j++) {
      const seg1 = segments[i]
      const seg2 = segments[j]
      
      // Completely ignore self-intersections within the same path.
      // This prevents thousands of false-positive intersections when a compass or freehand
      // trace doubles back on itself due to floating point curve approximation.
      if (seg1.pathId === seg2.pathId) {
        continue
      }

      const pt = getSegmentIntersection(
        seg1.ax, seg1.ay, seg1.bx, seg1.by,
        seg2.ax, seg2.ay, seg2.bx, seg2.by
      )
      if (pt) {
        // Avoid duplicate intersection points that are very close to each other
        const isDuplicate = intersections.some(
          existing => getDistance(existing.x, existing.y, pt.x, pt.y) < 1.5
        )
        if (!isDuplicate) {
          intersections.push(pt)
          if (intersections.length >= maxIntersections) {
            return intersections
          }
        }
      }
    }
  }

  return intersections
}
