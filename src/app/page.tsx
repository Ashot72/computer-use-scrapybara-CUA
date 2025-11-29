"use client"

import { useRef, useState, useEffect } from "react"

import { FaArrowUp } from "react-icons/fa6"
import Textarea from "react-textarea-autosize"
import type { Scrapybara } from "scrapybara"
import { toast } from "sonner"

import { filterImages } from "@/lib/utils"
import { DEFAULT_MODEL, DEFAULT_INSTANCE_TYPE } from "@/lib/constants"
import { startInstance, stopInstance } from "@/server/actions"
import { loadMessages, saveMessages, listChats } from "@/server/messages"
import { Messages } from "@/components/messages"
import { InstanceFrame } from "@/components/instance-frame"
import { Loader } from "@/components/loader"

const IS_MOCK_MODE = process.env.NEXT_PUBLIC_USE_MOCK === "true"

export default function Chat() {
  const [instanceId, setInstanceId] = useState<string | null>(null)
  const [streamUrl, setStreamUrl] = useState<string | null>(null)
  const [isLoadedChat, setIsLoadedChat] = useState(false) // Track if viewing a loaded/old chat

  const [input, setInput] = useState("")
  const [messages, setMessages] = useState<Scrapybara.Message[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [isStarting, setIsStarting] = useState(false)
  const [isStopping, setIsStopping] = useState(false)
  const [chats, setChats] = useState<
    Array<{ id: string; instanceId: string; preview: string }>
  >([])
  const abortedController = useRef<AbortController | null>(null)
  const isTransitioningFromLoadedChat = useRef<boolean>(false) // Track if transitioning from loaded chat
  const oldInstanceIdRef = useRef<string | null>(null) // Track old instanceId to prevent overwriting

  // Load messages when instanceId is set
  useEffect(() => {
    // Skip reloading if we're transitioning from a loaded chat (preserve existing messages)
    if (isTransitioningFromLoadedChat.current) {
      isTransitioningFromLoadedChat.current = false
      return
    }

    if (instanceId) {
      loadMessages(instanceId)
        .then(setMessages)
        .catch(error => {
          console.error("Failed to load messages:", error)
        })
    } else {
      setMessages([])
      setIsLoadedChat(false) // Reset when no instanceId
    }
  }, [instanceId])

  // Load chats list on mount and when instanceId changes (to show new chats)
  useEffect(() => {
    listChats()
      .then(setChats)
      .catch(error => {
        console.error("Failed to load chats:", error)
      })
  }, [instanceId])

  // Save messages to file whenever messages or instanceId changes
  useEffect(() => {
    if (!instanceId || messages.length === 0) {
      return
    }

    // Don't save mock-instance conversations, only real-time conversations
    if (instanceId.startsWith("mock-instance-")) {
      return // Skip saving mock instances
    }

    // Don't save to old instanceId when transitioning to a new one
    if (oldInstanceIdRef.current && instanceId === oldInstanceIdRef.current) {
      // This is the old instanceId, skip saving to prevent overwriting
      return
    }

    // Clear the old instanceId ref after we've moved past it
    if (oldInstanceIdRef.current && instanceId !== oldInstanceIdRef.current) {
      oldInstanceIdRef.current = null
    }

    // Save messages to JSON file (only for real-time conversations)
    saveMessages(messages, instanceId).catch(error => {
      console.error("Failed to save messages:", error)
    })
  }, [messages, instanceId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (isStreaming) return

    // Start new instance if: no instanceId OR viewing loaded chat in non-mock mode
    const needsNewInstance = !instanceId || (!IS_MOCK_MODE && isLoadedChat)

    // Store old instanceId BEFORE updating messages to prevent overwriting it
    if (needsNewInstance && instanceId) {
      oldInstanceIdRef.current = instanceId
    }

    const newMessages: Scrapybara.Message[] = [
      ...messages,
      { role: "user", content: [{ type: "text", text: input }] },
    ]

    setIsStreaming(true)
    setMessages(newMessages)
    setInput("")
    abortedController.current = new AbortController()

    let instanceIdToUse = instanceId

    if (needsNewInstance) {
      if (IS_MOCK_MODE) {
        instanceIdToUse =
          process.env.NEXT_PUBLIC_MOCK_INSTANCE_ID || "mock-instance-12345"
        setInstanceId(instanceIdToUse)
        setStreamUrl("mock")
        setIsLoadedChat(false)
      } else {
        setIsStarting(true)
        try {
          const response = await startInstance({})
          const parsedResponse = JSON.parse(response)

          if (parsedResponse.error) {
            throw new Error(parsedResponse.error)
          }

          const { instanceId: newInstanceId, streamUrl } = parsedResponse as {
            instanceId: string
            streamUrl: string
          }

          instanceIdToUse = newInstanceId
          isTransitioningFromLoadedChat.current = true
          setInstanceId(newInstanceId)
          setStreamUrl(streamUrl)
          setIsLoadedChat(false)
        } catch (error) {
          toast.error("Failed to start instance", {
            description: error instanceof Error && error.message,
          })
          setIsStreaming(false)
          setIsStarting(false)
          return
        }
        setIsStarting(false)
      }
    } else {
      oldInstanceIdRef.current = null
    }

    const response = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        instanceId: instanceIdToUse!,
        instanceType: DEFAULT_INSTANCE_TYPE,
        modelName: DEFAULT_MODEL,
        messages: newMessages,
      }),
    })

    if (!response.ok) {
      setIsStreaming(false)
      return
    }

    const reader = response.body?.getReader()
    if (!reader) {
      setIsStreaming(false)
      return
    }

    try {
      let buffer = ""
      while (true) {
        try {
          const { done, value } = await reader.read()

          if (done || abortedController.current?.signal.aborted) break

          const text = new TextDecoder().decode(value)
          buffer += text

          const messages = buffer.split("\n")
          buffer = messages.pop() || ""

          for (const message of messages.filter(Boolean)) {
            if (message.startsWith(": flush")) continue

            try {
              const data = JSON.parse(message) as Scrapybara.Message

              if ("error" in data && typeof data.error === "string") {
                if (data.error.includes("agent credits")) {
                  toast.error("Not enough agent credits")
                } else {
                  toast.error("Server error", {
                    description: data.error,
                  })
                }
                continue
              }

              if (data.role === "assistant" || data.role === "tool") {
                setMessages(prev => filterImages([...prev, data], 4))
              }
            } catch (error) {
              toast.error("Failed to parse message", {
                description:
                  error instanceof Error ? error.message : "Unknown error",
              })
            }
          }
        } catch (error) {
          if (error instanceof Error) {
            if (IS_MOCK_MODE) break
            toast.error("Error reading stream", {
              description: error.message,
            })
          }
          break
        }
      }
    } finally {
      setIsStreaming(false)
      reader.releaseLock()
      abortedController.current = null
    }
  }

  const resetInstanceState = () => {
    setInstanceId(null)
    setStreamUrl(null)
    setMessages([])
    setIsLoadedChat(false)
    oldInstanceIdRef.current = null
    setIsStopping(false)
    setIsStreaming(false)
  }

  const handleStop = async () => {
    if (!instanceId) return

    setIsStopping(true)
    abortedController.current?.abort()

    if (IS_MOCK_MODE) {
      resetInstanceState()
      return
    }

    try {
      const response = await stopInstance({ instanceId })
      const parsedResponse = JSON.parse(response)

      if (parsedResponse.error) {
        throw new Error(parsedResponse.error)
      }

      resetInstanceState()
    } catch (error) {
      toast.error("Failed to stop instance", {
        description: error instanceof Error && error.message,
      })
      setIsStopping(false)
    }
  }

  const handleChatSelect = (selectedInstanceId: string) => {
    setInstanceId(selectedInstanceId)
    setIsLoadedChat(!IS_MOCK_MODE)
    setStreamUrl(IS_MOCK_MODE ? "mock" : null)
  }

  return (
    <div className="w-full h-full p-4 md:p-8">
      <header className="absolute top-4 right-4 left-4 flex items-center justify-center z-10">
        <div
          className={`flex items-center gap-3 transition-transform ${chats.length > 0 ? "translate-x-[125px]" : ""}`}
          style={{ marginTop: "7px" }}
        >
          <svg
            className="w-6 h-6"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <rect
              x="2"
              y="4"
              width="20"
              height="14"
              rx="2"
              stroke="currentColor"
              strokeWidth="2"
            />
            <path
              d="M8 20h8M12 20v-4"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <circle cx="7" cy="9" r="1.5" fill="currentColor" />
            <circle cx="12" cy="9" r="1.5" fill="currentColor" />
            <circle cx="17" cy="9" r="1.5" fill="currentColor" />
            <path
              d="M6 14h12"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
          <h1 className="text-lg font-semibold">
            Computer Use and Activity History
          </h1>
        </div>
      </header>

      <div className="w-full h-full flex flex-col-reverse md:flex-row transition-all duration-500 ease-in-out md:gap-8 pt-16">
        <div
          className={`relative flex flex-col h-full transition-all duration-500 ease-in-out ${streamUrl || isStarting || isStopping || instanceId ? "w-full md:w-1/2" : "w-full"}`}
        >
          <div className="max-w-3xl w-full mx-auto flex flex-col h-full">
            {chats.length > 0 && (
              <div className="mb-4 z-50 ml-0" style={{ marginTop: "-76px" }}>
                <select
                  value={instanceId || ""}
                  onChange={e => handleChatSelect(e.target.value)}
                  className="px-3 py-2 rounded-md border border-primary bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary w-[320px] max-w-[320px] text-sm z-50 relative"
                >
                  <option value="">Select a chat...</option>
                  {chats.slice(0, 50).map(chat => (
                    <option key={chat.id} value={chat.instanceId}>
                      {chat.preview}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {messages.length > 0 && <Messages messages={messages} />}

            <div className="mt-auto pt-4">
              <form
                onSubmit={handleSubmit}
                className={`relative flex w-full flex-col rounded-lg border transition-all duration-300 ease-in-out ${isStreaming ? "border-primary" : ""}`}
              >
                <Textarea
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault()
                      if (!input.trim()) return
                      void handleSubmit(e)
                    }
                  }}
                  placeholder="Type your message here"
                  className="flex h-14 min-h-14 w-full resize-none rounded-lg p-4 transition-colors placeholder:text-muted-foreground focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                  style={{ scrollbarWidth: "none" }}
                  minRows={1}
                  maxRows={4}
                  autoFocus
                />
                <div className="flex absolute bottom-2.5 right-2.5 gap-2">
                  <button
                    type="submit"
                    disabled={
                      (!input.trim() && !isStreaming) ||
                      isStarting ||
                      isStopping ||
                      isStreaming
                    }
                    className="flex-shrink-0 inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 size-9"
                  >
                    {isStreaming ? (
                      <Loader className="w-4 h-4" variant="foreground" />
                    ) : (
                      <FaArrowUp size={16} />
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>

        {(streamUrl || isStarting || isStopping || instanceId) && (
          <InstanceFrame
            instanceId={instanceId}
            streamUrl={streamUrl}
            isStarting={isStarting}
            isStopping={isStopping}
            selectedInstanceType={DEFAULT_INSTANCE_TYPE}
            handleStop={handleStop}
            isMockMode={IS_MOCK_MODE}
            messages={messages}
          />
        )}
      </div>
    </div>
  )
}
