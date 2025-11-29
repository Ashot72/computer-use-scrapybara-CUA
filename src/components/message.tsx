import { FaComputer } from "react-icons/fa6"
import Markdown from "react-markdown"
import remarkGfm from "remark-gfm"
import type { Scrapybara } from "scrapybara"
import { motion } from "motion/react"
import Loader from "./loader"
import { CollapsibleScreenshot } from "./collapsible-screenshot"

interface MessageProps {
  message: Scrapybara.Message
  isLastMessage?: boolean
}

const markdownComponents = {
  ul: ({ children }: any) => (
    <ul className="list-disc pl-4 py-4">{children}</ul>
  ),
  ol: ({ children }: any) => (
    <ol className="list-decimal pl-6 py-4">{children}</ol>
  ),
}

interface ToolResultTextProps {
  children: string
  variant?: "default" | "error"
}

const ToolResultText = ({
  children,
  variant = "default",
}: ToolResultTextProps) => {
  const className =
    variant === "error"
      ? "font-mono text-sm whitespace-pre-wrap break-all text-destructive border border-destructive rounded-lg p-2 px-4"
      : "font-mono text-sm whitespace-pre-wrap break-all border rounded-lg p-2 px-4"

  return <p className={className}>{children}</p>
}

export function Message({ message, isLastMessage = false }: MessageProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className={`flex w-max max-w-[86.9%] flex-col gap-4 py-2.5 ${message.role === "user" ? "ml-auto bg-primary text-primary-foreground px-4 rounded-lg" : ""}`}
    >
      {message.content && (
        <>
          {message.role === "user" && (
            <p className="whitespace-pre-wrap">
              {message.content
                .filter(
                  (part): part is { type: "text"; text: string } =>
                    part.type === "text"
                )
                .map(part => part.text)
                .join("")}
            </p>
          )}
          {message.role === "assistant" && (
            <>
              {message.content.map((part, i) => {
                if (part.type === "reasoning") {
                  if (!part.reasoning) return null
                  return (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.1, duration: 0.4 }}
                      className="text-muted-foreground my-4"
                    >
                      <Markdown
                        remarkPlugins={[remarkGfm]}
                        components={markdownComponents}
                      >
                        {part.reasoning}
                      </Markdown>
                    </motion.div>
                  )
                }
                if (part.type === "text") {
                  if (!part.text) return null
                  return (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.1, duration: 0.4 }}
                      className="my-4"
                    >
                      <Markdown
                        remarkPlugins={[remarkGfm]}
                        components={markdownComponents}
                      >
                        {part.text}
                      </Markdown>
                    </motion.div>
                  )
                }
                if (part.type === "tool-call") {
                  return (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: i * 0.1, duration: 0.3 }}
                      className="flex flex-col gap-2 font-mono border border-primary rounded-lg py-2.5 px-4 text-sm relative"
                    >
                      {isLastMessage && message.role === "assistant" && (
                        <div className="absolute top-1.5 right-1.5">
                          <Loader className="w-3 h-3" />
                        </div>
                      )}
                      <div className="relative flex items-center gap-2 font-medium text-primary">
                        {part.toolName === "computer" && (
                          <FaComputer size={12} />
                        )}
                        {part.toolName}
                      </div>
                      <p className="whitespace-pre-wrap break-all">
                        {Object.entries(part.args)
                          .map(([Key, value]) => `${Key}: ${String(value)}`)
                          .join("\n")}
                      </p>
                    </motion.div>
                  )
                }
                return null
              })}
            </>
          )}
          {message.role === "tool" && (
            <>
              {message.content.map((part, i) => {
                if (!part.result || typeof part.result !== "object") return null

                const result = part.result as {
                  output?: string
                  system?: string
                  error?: string
                  base64Image?: string
                }

                if (
                  !result.output &&
                  !result.system &&
                  !result.error &&
                  !result.base64Image
                )
                  return null

                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2, duration: 0.4 }}
                  >
                    {result.output && (
                      <ToolResultText>{result.output}</ToolResultText>
                    )}
                    {result.system && (
                      <ToolResultText>{result.system}</ToolResultText>
                    )}
                    {result.error && (
                      <ToolResultText variant="error">
                        {result.error}
                      </ToolResultText>
                    )}
                    {result.base64Image && (
                      <CollapsibleScreenshot base64Image={result.base64Image} />
                    )}
                  </motion.div>
                )
              })}
            </>
          )}
        </>
      )}
    </motion.div>
  )
}
