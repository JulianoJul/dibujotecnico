
import { Group, Circle, RegularPolygon } from 'react-konva'
import { COLORS, SIZES } from '../constants/theme'
import type { KonvaEventObject } from 'konva/lib/Node'

interface InteractiveHandleProps {
  x: number
  y: number
  radius?: number
  cursorType?: 'pointer' | 'move' | 'ew-resize' | 'ns-resize' | 'text' | 'default' | 'rotate'
  isActive?: boolean
  fill?: string
  stroke?: string
  strokeWidth?: number
  isPolygon?: boolean
  sides?: number
  rotation?: number
  onClick?: (e: KonvaEventObject<MouseEvent>) => void
  onDblClick?: (e: KonvaEventObject<MouseEvent>) => void
  onMouseDown?: (e: KonvaEventObject<MouseEvent>) => void
}

export default function InteractiveHandle({
  x,
  y,
  radius = SIZES.handleRadiusStandard,
  cursorType = 'pointer',
  isActive = false,
  fill,
  stroke,
  strokeWidth = SIZES.strokeRegular,
  isPolygon = false,
  sides = 4,
  rotation = 0,
  onClick,
  onDblClick,
  onMouseDown,
}: InteractiveHandleProps) {
  
  const handleMouseEnter = (e: KonvaEventObject<MouseEvent>) => {
    const stage = e.target.getStage()
    if (stage) {
      if (cursorType === 'rotate') {
        stage.container().style.cursor = 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'18\' height=\'18\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%23000000\' stroke-width=\'3\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3E%3Cpath d=\'M21.5 2v6h-6\'/%3E%3Cpath d=\'M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67\'/%3E%3C/svg%3E") 9 9, auto'
      } else {
        stage.container().style.cursor = cursorType
      }
    }
  }

  const handleMouseLeave = (e: KonvaEventObject<MouseEvent>) => {
    if (e.evt && e.evt.buttons === 1) return // Keep cursor during drag
    const stage = e.target.getStage()
    if (stage) stage.container().style.cursor = 'default'
  }

  const handleMouseDown = (e: KonvaEventObject<MouseEvent>) => {
    e.cancelBubble = true // Stop propagation to stage
    if (onMouseDown) {
      onMouseDown(e)
    }
  }

  const handleClick = (e: KonvaEventObject<MouseEvent>) => {
    e.cancelBubble = true
    if (onClick) {
      onClick(e)
    }
  }

  const handleDblClick = (e: KonvaEventObject<MouseEvent>) => {
    e.cancelBubble = true
    if (onDblClick) {
      onDblClick(e)
    }
  }

  let defaultFill = COLORS.handleFillIdle
  let defaultStroke = COLORS.handleStrokeIdle

  if (isActive) {
    defaultFill = COLORS.handleFillActive
    defaultStroke = COLORS.primaryBlue
  } else if (cursorType === 'move') {
    defaultFill = COLORS.handleMoveFill
    defaultStroke = COLORS.handleMoveStroke
  } else if (cursorType === 'ew-resize') {
    defaultFill = COLORS.handleResizeFill
    defaultStroke = COLORS.handleResizeStroke
  } else if (cursorType === 'rotate') {
    defaultFill = COLORS.handleRotateFill
    defaultStroke = COLORS.handleRotateStroke
  } else if (cursorType === 'pointer') {
    defaultFill = COLORS.handleRotateFill
    defaultStroke = COLORS.handleRotateStroke
  }

  return (
    <Group
      x={x}
      y={y}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onMouseDown={handleMouseDown}
      onClick={handleClick}
      onDblClick={handleDblClick}
    >
      {isPolygon ? (
        <RegularPolygon
          name="handle"
          sides={sides}
          radius={radius}
          rotation={rotation}
          fill={fill || defaultFill}
          stroke={stroke || defaultStroke}
          strokeWidth={strokeWidth}
        />
      ) : (
        <Circle
          name="handle"
          radius={radius}
          fill={fill || defaultFill}
          stroke={stroke || defaultStroke}
          strokeWidth={strokeWidth}
        />
      )}
    </Group>
  )
}
