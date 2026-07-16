
import { Group, Circle, RegularPolygon } from 'react-konva'
import { COLORS, SIZES } from '../constants/theme'
import type { KonvaEventObject } from 'konva/lib/Node'

interface InteractiveHandleProps {
  x: number
  y: number
  radius?: number
  cursorType?: 'pointer' | 'move' | 'ew-resize' | 'ns-resize' | 'text' | 'default'
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
    if (stage) stage.container().style.cursor = cursorType
  }

  const handleMouseLeave = (e: KonvaEventObject<MouseEvent>) => {
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

  const defaultFill = isActive ? COLORS.handleFillActive : COLORS.handleFillIdle
  const defaultStroke = isActive ? COLORS.primaryBlue : COLORS.handleStrokeIdle

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
          sides={sides}
          radius={radius}
          rotation={rotation}
          fill={fill || defaultFill}
          stroke={stroke || defaultStroke}
          strokeWidth={strokeWidth}
        />
      ) : (
        <Circle
          radius={radius}
          fill={fill || defaultFill}
          stroke={stroke || defaultStroke}
          strokeWidth={strokeWidth}
        />
      )}
    </Group>
  )
}
