import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { BookOpen, CheckCircle, XCircle, AlertCircle, BarChart3 } from "lucide-react"

interface BookDetail {
  title: string
  author: string
  iaId: string
  status: 'success' | 'failed' | 'no_sentences'
  sentencesFound: number
  textLength?: number
  positionInBook?: string
}

interface SearchMetadata {
  subject: string
  totalBooksAvailable: number
  totalBooksFound: number
  booksWithInternetArchive: number
  booksSelected: number
  booksProcessed: number
  booksSuccessful: number
  booksFailed: number
  totalSentencesExtracted: number
  bookDetails: BookDetail[]
}

interface SearchInfoProps {
  searchMetadata: SearchMetadata
}

export function SearchInfo({ searchMetadata }: SearchInfoProps) {
  const successRate = searchMetadata.booksProcessed > 0 
    ? Math.round((searchMetadata.booksSuccessful / searchMetadata.booksProcessed) * 100)
    : 0

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-500" />
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-500" />
      case 'no_sentences':
        return <AlertCircle className="w-4 h-4 text-yellow-500" />
      default:
        return <AlertCircle className="w-4 h-4 text-gray-500" />
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'success':
        return 'Success'
      case 'failed':
        return 'Failed to fetch'
      case 'no_sentences':
        return 'No sentences found'
      default:
        return 'Unknown'
    }
  }

  return (
    <Card className="p-6 mb-8 bg-muted/30 border-muted">
      <div className="space-y-6">
        {/* Header with main stats */}
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="w-5 h-5 text-primary" />
          <h2 className="text-xl font-semibold">Search Information</h2>
        </div>

        {/* Main statistics grid */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="text-center p-3 bg-background rounded-lg">
            <div className="text-2xl font-bold text-primary">{searchMetadata.totalBooksAvailable.toLocaleString()}</div>
            <div className="text-sm text-muted-foreground">Total Available</div>
          </div>
          <div className="text-center p-3 bg-background rounded-lg">
            <div className="text-2xl font-bold text-primary">{searchMetadata.totalBooksFound}</div>
            <div className="text-sm text-muted-foreground">In This Search</div>
          </div>
          <div className="text-center p-3 bg-background rounded-lg">
            <div className="text-2xl font-bold text-primary">{searchMetadata.booksWithInternetArchive}</div>
            <div className="text-sm text-muted-foreground">With Full Text</div>
          </div>
          <div className="text-center p-3 bg-background rounded-lg">
            <div className="text-2xl font-bold text-primary">{searchMetadata.booksSelected}</div>
            <div className="text-sm text-muted-foreground">Selected</div>
          </div>
          <div className="text-center p-3 bg-background rounded-lg">
            <div className="text-2xl font-bold text-primary">{searchMetadata.totalSentencesExtracted}</div>
            <div className="text-sm text-muted-foreground">Sentences Found</div>
          </div>
        </div>

        {/* Search details */}
        <div className="flex flex-wrap gap-2 items-center text-sm text-muted-foreground">
          <span>Searching in: <Badge variant="secondary">{searchMetadata.subject}</Badge></span>
          <span>•</span>
          <span>Success rate: <span className="font-medium text-foreground">{successRate}%</span></span>
          <span>•</span>
          <span>Successful: <span className="font-medium text-green-600">{searchMetadata.booksSuccessful}</span></span>
          <span>•</span>
          <span>Failed: <span className="font-medium text-red-600">{searchMetadata.booksFailed}</span></span>
        </div>

        {/* Book details table */}
        <div className="space-y-3">
          <h3 className="text-lg font-medium flex items-center gap-2">
            <BookOpen className="w-4 h-4" />
            Book Processing Details
          </h3>
          <div className="space-y-2">
            {searchMetadata.bookDetails.map((book, index) => (
              <div 
                key={index} 
                className="flex items-center justify-between p-3 bg-background rounded-lg border"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {getStatusIcon(book.status)}
                    <a
                      href={`https://archive.org/details/${book.iaId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-sm truncate hover:text-primary hover:underline transition-colors"
                    >
                      {book.title}
                    </a>
                    <Badge variant="outline" className="text-xs">
                      {getStatusText(book.status)}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    by {book.author}
                    {book.textLength && (
                      <span> • {Math.round(book.textLength / 1000)}k characters</span>
                    )}
                    {book.positionInBook && book.status === 'success' && (
                      <span> • {book.positionInBook}</span>
                    )}
                    {book.sentencesFound > 0 && (
                      <span> • {book.sentencesFound} sentences extracted</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  )
}
