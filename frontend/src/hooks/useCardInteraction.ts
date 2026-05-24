import { useState, useRef, useEffect, useCallback, type RefObject } from "react"

const MAX_TILT = 20
const SWAY_SPEED = 0.3

export function useCardInteraction(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  isReversedRef: RefObject<boolean>
) {
  const [isDragging, setIsDragging] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const glossPosRef = useRef({ x: 0.5, y: 0.5 })

  const dragRotationRef = useRef({ x: 0, y: 0 })
  const swayRef = useRef(0)
  const swayPhaseRef = useRef(0)
  const lastPointerRef = useRef({ x: 0, y: 0 })
  const isDraggingRef = useRef(false)
  const startTimeRef = useRef(0)

  const handlePointerEnter = useCallback(() => {
    setIsHovered(true)
  }, [])

  const handlePointerLeave = useCallback(() => {
    setIsHovered(false)
  }, [])

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    glossPosRef.current = {
      x: Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height)),
    }
  }, [canvasRef])

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    isDraggingRef.current = true
    setIsDragging(true)
    lastPointerRef.current = { x: e.clientX, y: e.clientY }
  }, [])

  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      if (!isDraggingRef.current) return

      const dx = e.clientX - lastPointerRef.current.x
      const dy = e.clientY - lastPointerRef.current.y
      lastPointerRef.current = { x: e.clientX, y: e.clientY }

      const rot = dragRotationRef.current
      dragRotationRef.current = {
        x: Math.max(-MAX_TILT, Math.min(MAX_TILT, rot.x + dy * 0.4)),
        y: Math.max(-MAX_TILT, Math.min(MAX_TILT, rot.y + dx * 0.4)),
      }
    }

    const handlePointerUp = () => {
      isDraggingRef.current = false
      setIsDragging(false)
    }

    window.addEventListener("pointermove", handlePointerMove)
    window.addEventListener("pointerup", handlePointerUp)
    window.addEventListener("pointercancel", handlePointerUp)

    return () => {
      window.removeEventListener("pointermove", handlePointerMove)
      window.removeEventListener("pointerup", handlePointerUp)
      window.removeEventListener("pointercancel", handlePointerUp)
    }
  }, [])

  const resetRotation = useCallback(() => {
    dragRotationRef.current = {
      x: (Math.random() - 0.5) * 6,
      y: 0,
    }
    // Start leaned fully left or right, then sway between extremes
    swayPhaseRef.current = Math.random() < 0.5 ? Math.PI / 2 : -Math.PI / 2
    swayRef.current = 0
    startTimeRef.current = Date.now()
  }, [])

  useEffect(() => {
    let rafId: number

    const tick = () => {
      const canvas = canvasRef.current
      if (canvas && canvas.isConnected) {
        const elapsed = (Date.now() - startTimeRef.current) / 1000
        swayRef.current =
          Math.sin(elapsed * SWAY_SPEED + swayPhaseRef.current) * MAX_TILT

        const base = dragRotationRef.current
        const displayY = Math.max(
          -MAX_TILT,
          Math.min(MAX_TILT, base.y + swayRef.current)
        )

        const rev = isReversedRef.current ? " rotate(180deg)" : ""
        canvas.style.transform = `translateZ(0) rotateX(${base.x}deg) rotateY(${displayY}deg)${rev}`
      }

      rafId = requestAnimationFrame(tick)
    }

    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [canvasRef, isReversedRef])

  return { isDragging, isHovered, glossPosRef, handlePointerEnter, handlePointerLeave, handlePointerMove, handlePointerDown, resetRotation }
}
