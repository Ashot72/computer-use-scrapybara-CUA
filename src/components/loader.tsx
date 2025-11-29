"use client"

import { useEffect, useState } from "react"

interface LoaderProps {
  className?: string
  variant?: "primary" | "foreground"
}

const POSITIONS = [
  "top-[15%] left-[15%]",
  "top-[15%] right-[15%]",
  "bottom-[15%] right-[15%]",
  "bottom-[15%] left-[15%]",
] as const

export const Loader = ({ className, variant = "primary" }: LoaderProps) => {
  const [position, setPosition] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setPosition(prev => (prev + 1) % 4)
    }, 100)

    return () => clearInterval(interval)
  }, [])

  const borderClass =
    variant === "primary" ? "border-primary" : "border-foreground"
  const bgClass = variant === "primary" ? "bg-primary" : "bg-foreground"

  return (
    <div
      className={`relative w-6 h-6 font-mono inline-block ${className || ""}`}
    >
      <div className={`absolute inset-0 border rounded-xs ${borderClass}`} />
      <div
        className={`absolute w-[25%] h-[25%] transition-all duration-15 rounded-xs ${bgClass} ${POSITIONS[position]}`}
      />
    </div>
  )
}

export default Loader
