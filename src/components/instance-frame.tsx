import { FaSquare, FaChrome } from "react-icons/fa6"
import { useEffect, useState } from "react"
import type { Scrapybara } from "scrapybara"

import TerminalLoader, { Loader } from "./loader"
import { DEFAULT_INSTANCE_TYPE } from "@/lib/constants"

interface InstanceFrameProps {
  instanceId: string | null
  streamUrl: string | null
  isStarting: boolean
  isStopping: boolean
  selectedInstanceType: typeof DEFAULT_INSTANCE_TYPE
  handleStop: () => Promise<void>
  isMockMode?: boolean
  messages?: Scrapybara.Message[]
}

export function InstanceFrame({
  instanceId,
  streamUrl,
  isStarting,
  isStopping,
  selectedInstanceType,
  handleStop,
  isMockMode = false,
  messages = [],
}: InstanceFrameProps) {
  const [elapsedTime, setElapsedTime] = useState(0)

  useEffect(() => {
    if (!instanceId || isStarting || isStopping) {
      setElapsedTime(0)
      return
    }

    const interval = setInterval(() => {
      setElapsedTime(prev => prev + 1)
    }, 1000)

    return () => clearInterval(interval)
  }, [instanceId, isStarting, isStopping])

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
      .toString()
      .padStart(2, "0")
    const secs = (seconds % 60).toString().padStart(2, "0")
    return `${mins}:${secs}`
  }

  const getLatestScreenshot = (): string | null => {
    if (messages.length === 0) return null

    // Get latest screenshot from messages (works for both mock mode and loaded chats)
    for (let i = messages.length - 1; i >= 0; i--) {
      const message = messages[i]
      if (message.role === "tool" && message.content) {
        for (const part of message.content) {
          if (part.type === "tool-result" && part.result) {
            const result = part.result as { base64Image?: string }
            if (result.base64Image) {
              return result.base64Image
            }
          }
        }
      }
    }
    return null
  }

  return (
    <div className="justify-center flex flex-col w-full md:w-1/2 transition-all duration-500 ease-in-out">
      <div className="flex items-center justify-between bg-muted p-2 rounded-t-lg">
        <div className="flex items-center gap-2">
          <span className="ml-2 text-sm text-muted-foreground">
            <FaChrome className="inline mr-2" />
            {instanceId || `${selectedInstanceType} Instance`}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {instanceId && !isStarting && !isStopping && (
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-primary animate-pulse flex-shrink-0"></div>
              <div className="flex items-baseline">
                <span className="text-sm tabular-nums w-10 inline-block">
                  {formatTime(elapsedTime)}
                </span>
                <span className="text-xs text-muted-foreground">/60:00</span>
              </div>
            </div>
          )}
          <button
            className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] bg-destructive text-white shadow-xs hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60 h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5"
            onClick={handleStop}
            disabled={isStarting || isStopping || !instanceId}
          >
            {isStopping ? (
              <>Stopping</>
            ) : (
              <>
                <FaSquare size={16} />
                Stop
              </>
            )}
          </button>
        </div>
      </div>
      <div className="w-full aspect-[4/3] rounded-b-lg overflow-hidden">
        {isStarting && (
          <div className="w-full h-full flex items-center justify-center bg-muted">
            <div className="flex flex-col items-center gap-4">
              <Loader />
              <p className="text-lg animate-pulse">
                Starting {selectedInstanceType} instance...
              </p>
            </div>
          </div>
        )}
        {isStopping && (
          <div className="w-full h-full flex items-center justify-center bg-muted">
            <div className="flex flex-col items-center gap-4">
              <TerminalLoader />
              <p className="text-lg animate-pulse">Stopping {instanceId}...</p>
            </div>
          </div>
        )}
        {streamUrl && !isMockMode && !isStarting && !isStopping && (
          <iframe
            src={streamUrl}
            className="w-full h-full"
            allow="clipboard-write"
          />
        )}
        {(!streamUrl || isMockMode) &&
          instanceId &&
          !isStarting &&
          !isStopping &&
          (() => {
            const latestScreenshot = getLatestScreenshot()
            return latestScreenshot ? (
              <img
                src={`data:image/png;base64,${latestScreenshot}`}
                alt="Latest screenshot from chat"
                className="w-full h-full object-cover"
                style={{ imageRendering: "auto" }}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-muted">
                <p className="text-muted-foreground">No screenshot available</p>
              </div>
            )
          })()}
      </div>
    </div>
  )
}
