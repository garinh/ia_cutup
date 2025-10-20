import { Card } from "@/components/ui/card"
import { Quote } from "lucide-react"

interface Sentence {
  text: string
  book: string
  author: string
  iaId: string
}

interface SentenceDisplayProps {
  sentences: Sentence[]
}

export function SentenceDisplay({ sentences }: SentenceDisplayProps) {
  return (
    <div className="space-y-6">
      {sentences.map((sentence, index) => (
        <Card key={index} className="p-6 hover:shadow-lg transition-shadow duration-300 bg-card">
          <div className="flex gap-4">
            <Quote className="w-6 h-6 text-primary flex-shrink-0 mt-1" />
            <div className="flex-1">
              <p className="text-lg leading-relaxed text-foreground mb-4 text-pretty">{sentence.text}</p>
              <div className="flex flex-col gap-1 text-sm text-muted-foreground">
                <p className="font-medium text-foreground">
                  <a
                    href={`https://archive.org/details/${sentence.iaId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-primary hover:underline transition-colors"
                  >
                    {sentence.book}
                  </a>
                </p>
                {sentence.author && <p className="italic">by {sentence.author}</p>}
              </div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}
