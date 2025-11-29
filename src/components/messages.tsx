import { useEffect, useRef } from "react"
import type { Scrapybara } from "scrapybara"
import { Message } from "./message"

interface MessagesProps {
  messages: Scrapybara.Message[]
}

const SCROLLBAR_STYLES: React.CSSProperties = {
  scrollbarWidth: "thin",
  scrollbarColor: "rgba(155, 155, 155, 0.3) transparent",
  msOverflowStyle: "none",
  WebkitOverflowScrolling: "touch",
  transition: "scrollbar-color 0.3s ease",
}

export function Messages({ messages }: MessagesProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  if (messages.length === 0) {
    return null
  }

  const handleMouseEnter = (e: React.MouseEvent<HTMLDivElement>) => {
    e.currentTarget.style.scrollbarColor =
      "rgba(155, 155, 155, 0.3) transparent"
  }

  const handleMouseLeave = (e: React.MouseEvent<HTMLDivElement>) => {
    e.currentTarget.style.scrollbarColor = "rgba(155, 155, 155, 0) transparent"
  }

  return (
    <div
      className="flex-1 overflow-y-auto -mx-4 px-4"
      style={SCROLLBAR_STYLES}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className="flex flex-col gap-4 py-8">
        {messages.map((message, index) => (
          <Message
            key={index}
            message={message}
            isLastMessage={index === messages.length - 1}
          />
        ))}
        <div ref={messagesEndRef} />
      </div>
    </div>
  )
}
