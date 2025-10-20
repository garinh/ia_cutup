"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { BookOpen, Loader2, RefreshCw } from "lucide-react"
import { SentenceDisplay } from "@/components/sentence-display"
import { SearchInfo } from "@/components/search-info"

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
  bookDetails: Array<{
    title: string
    author: string
    iaId: string
    status: 'success' | 'failed' | 'no_sentences'
    sentencesFound: number
    textLength?: number
    positionInBook?: string
  }>
}

export default function Home() {
  const [sentences, setSentences] = useState<Array<{ text: string; book: string; author: string }>>([])
  const [searchMetadata, setSearchMetadata] = useState<SearchMetadata | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchRandomSentences = async () => {
    setLoading(true)
    setError(null)
    setSentences([])
    setSearchMetadata(null)

    try {
      const response = await fetch("/api/random-sentences")
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch sentences")
      }

      setSentences(data.sentences)
      setSearchMetadata(data.searchMetadata)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-12 max-w-4xl">
        <header className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-4">
            <BookOpen className="w-10 h-10 text-primary" />
            <h1 className="text-4xl font-bold text-balance text-foreground">Literary Fragments</h1>
          </div>
          <p className="text-lg text-muted-foreground text-pretty max-w-2xl mx-auto">
            Discover random sentences from books in the Internet Archive. Each click reveals twelve unique fragments
            from six different works.
          </p>
        </header>

        <div className="flex justify-center mb-8">
          <Button onClick={fetchRandomSentences} disabled={loading} size="lg" className="gap-2">
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Discovering...
              </>
            ) : (
              <>
                <RefreshCw className="w-5 h-5" />
                Discover Sentences
              </>
            )}
          </Button>
        </div>

        {error && (
          <Card className="p-6 mb-8 border-destructive bg-destructive/10">
            <p className="text-destructive text-center">{error}</p>
          </Card>
        )}

        {searchMetadata && <SearchInfo searchMetadata={searchMetadata} />}

        {sentences.length > 0 && <SentenceDisplay sentences={sentences} />}

        {!loading && sentences.length === 0 && !error && (
          <Card className="p-12 text-center bg-muted/30">
            <BookOpen className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground text-lg">
              Click the button above to discover random sentences from classic literature
            </p>
          </Card>
        )}
      </div>
    </main>
  )
}
