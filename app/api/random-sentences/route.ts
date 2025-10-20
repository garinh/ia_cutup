import { NextResponse } from "next/server"

interface BookResult {
  key: string
  title: string
  author_name?: string[]
  ia?: string[]
}

interface SearchResponse {
  docs: BookResult[]
}

// Helper function to extract sentences from text
function extractSentences(text: string): string[] {
  // First, filter to get main content only
  const mainContent = filterMainContent(text)

  // Keywords that indicate license or metadata text
  const excludeKeywords = [
    "GNU",
    "GPL",
    "license",
    "copyright",
    "gutenberg",
    "warranty",
    "redistribution",
    "permission",
    "terms and conditions",
    "free software foundation",
    "all rights reserved",
  ]

  // Split by sentence-ending punctuation followed by space and capital letter
  const sentences = mainContent
    .replace(/\n+/g, " ")
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+(?=[A-Z])/)
    .map((s) => s.trim())
    .filter((s) => {
      // Filter by length
      if (s.length < 20 || s.length > 500) return false

      // Filter out sentences containing license-related keywords
      const lowerSentence = s.toLowerCase()
      const hasExcludedKeyword = excludeKeywords.some((keyword) => lowerSentence.includes(keyword.toLowerCase()))

      if (hasExcludedKeyword) return false

      // Ensure sentence has some alphabetic content and isn't just numbers/symbols
      const hasLetters = /[a-zA-Z]{3,}/.test(s)

      return hasLetters
    })

  return sentences
}

// Helper function to get random items from array
function getRandomItems<T>(array: T[], count: number): T[] {
  const shuffled = [...array].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, count)
}

function filterMainContent(text: string): string {
  // Common license and front matter indicators to skip
  const skipPatterns = [
    /GNU GENERAL PUBLIC LICENSE/i,
    /Project Gutenberg/i,
    /END OF.*LICENSE/i,
    /START OF.*PROJECT/i,
    /Table of Contents/i,
    /TERMS AND CONDITIONS/i,
    /Copyright/i,
    /All rights reserved/i,
    /Permission is granted/i,
    /This eBook is for the use/i,
  ]

  // Split text into lines
  const lines = text.split("\n")

  // Find where the main content likely starts (after licenses and front matter)
  // Look for the first substantial paragraph after skipping the first 15% of the document
  const skipLines = Math.floor(lines.length * 0.15)
  const contentLines = lines.slice(skipLines)

  return contentLines.join("\n")
}

export async function GET() {
  try {
    // Search for books with full text available in Internet Archive
    // Using a random subject to get variety
    const subjects = ["fiction", "science", "history", "philosophy", "adventure", "mystery", "poetry", "drama"]
    const randomSubject = subjects[Math.floor(Math.random() * subjects.length)]

    const searchUrl = `https://openlibrary.org/search.json?subject=${randomSubject}&has_fulltext=true&language=eng&limit=50`

    const searchResponse = await fetch(searchUrl)
    const searchData: SearchResponse = await searchResponse.json()

    // Filter books that have Internet Archive IDs
    const booksWithIA = searchData.docs.filter((book) => book.ia && book.ia.length > 0)

    if (booksWithIA.length === 0) {
      return NextResponse.json({ error: "No books with full text found" }, { status: 404 })
    }

    // Select 6 random books
    const selectedBooks = getRandomItems(booksWithIA, Math.min(6, booksWithIA.length))

    const sentences: Array<{ text: string; book: string; author: string; iaId: string }> = []

    // Fetch text from each book and extract sentences
    for (const book of selectedBooks) {
      try {
        const iaId = book.ia[0]

        // Fetch text from Internet Archive
        // Using the djvu.txt format which is plain text
        const textUrl = `https://archive.org/stream/${iaId}/${iaId}_djvu.txt`

        const textResponse = await fetch(textUrl)

        if (!textResponse.ok) {
          console.log(`[v0] Failed to fetch text for ${book.title}`)
          continue
        }

        const fullText = await textResponse.text()

        // Extract sentences
        const bookSentences = extractSentences(fullText)

        if (bookSentences.length === 0) {
          console.log(`[v0] No sentences extracted from ${book.title}`)
          continue
        }

        // Get 2 random sentences from this book
        const randomSentences = getRandomItems(bookSentences, 2)

        randomSentences.forEach((sentence) => {
          sentences.push({
            text: sentence,
            book: book.title,
            author: book.author_name?.[0] || "Unknown Author",
            iaId: iaId,
          })
        })
      } catch (error) {
        console.log(`[v0] Error processing book ${book.title}:`, error)
        continue
      }
    }

    if (sentences.length === 0) {
      return NextResponse.json({ error: "Could not extract sentences from books" }, { status: 500 })
    }

    return NextResponse.json({ sentences })
  } catch (error) {
    console.error("[v0] Error in random-sentences API:", error)
    return NextResponse.json({ error: "Failed to fetch random sentences" }, { status: 500 })
  }
}
