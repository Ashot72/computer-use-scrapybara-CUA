import { useState } from "react"
import { FaChevronDown, FaChevronUp } from "react-icons/fa6"

export function CollapsibleScreenshot({
  base64Image,
}: {
  base64Image: string
}) {
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <div className="-mt-5 rounded-lg border border-primary overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between gap-2 p-2 hover:bg-muted/50 transition-colors"
      >
        <span className="text-sm font-medium">Screenshot</span>
        {isExpanded ? <FaChevronUp size={16} /> : <FaChevronDown size={16} />}
      </button>
      {isExpanded && (
        <div className="border-t">
          <img
            src={`data:image/png;base64,${base64Image}`}
            alt="Tool screenshot"
            className="w-full h-auto"
          />
        </div>
      )}
    </div>
  )
}
