import { NextResponse } from "next/server"

interface BookResult {
  key: string
  title: string
  author_name?: string[]
  ia?: string[]
  language?: string[]
  first_sentence?: string[]
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
    "page",
    "chapter",
    "table of contents",
    "index",
  ]

  // Clean the text more aggressively for OCR artifacts
  const cleanedText = mainContent
    .replace(/\n+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/[^\w\s.!?]/g, " ") // Remove special characters except basic punctuation
    .replace(/\s+/g, " ")
    .trim()

  // Split by sentence-ending punctuation followed by space and capital letter
  // Also handle cases where there might be OCR artifacts
  const sentences = cleanedText
    .split(/(?<=[.!?])\s+(?=[A-Z])/)
    .map((s) => s.trim())
    .filter((s) => {
      // Filter by length
      if (s.length < 15 || s.length > 600) return false

      // Filter out sentences containing license-related keywords
      const lowerSentence = s.toLowerCase()
      const hasExcludedKeyword = excludeKeywords.some((keyword) => lowerSentence.includes(keyword.toLowerCase()))

      if (hasExcludedKeyword) return false

      // Ensure sentence has some alphabetic content and isn't just numbers/symbols
      const hasLetters = /[a-zA-Z]{3,}/.test(s)
      
      // Check that it's not mostly numbers or special characters
      const letterCount = (s.match(/[a-zA-Z]/g) || []).length
      const totalCount = s.length
      const letterRatio = letterCount / totalCount

      return hasLetters && letterRatio > 0.3
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
    const subjects = ["fiction", "poetry", "adventure", "mystery", "drama"]
    const randomSubject = subjects[Math.floor(Math.random() * subjects.length)]

    // Get a random offset to sample from different parts of the results
    const maxOffset = Math.max(0, Math.floor(Math.random() * 1000)) // Random offset up to 1000
    const searchUrl = `https://openlibrary.org/search.json?subject=${randomSubject}&has_fulltext=true&language=eng&limit=200&offset=${maxOffset}`

    const searchResponse = await fetch(searchUrl)
    const searchData: SearchResponse = await searchResponse.json()

    // Filter books that have Internet Archive IDs
    const booksWithIA = searchData.docs.filter((book) => {
      // Must have Internet Archive ID
      if (!book.ia || book.ia.length === 0) return false
      
      // If language is specified, prefer English but don't exclude others yet
      // We'll do more thorough checking when we fetch the actual text
      if (book.language && book.language.length > 0) {
        const hasEnglish = book.language.some(lang => 
          lang.toLowerCase().includes('eng') || 
          lang.toLowerCase().includes('english') ||
          lang.toLowerCase() === 'en'
        )
        // If it explicitly has a non-English language, skip it
        if (!hasEnglish && book.language.some(lang => 
          lang.toLowerCase().includes('rus') || 
          lang.toLowerCase().includes('russian') ||
          lang.toLowerCase().includes('ger') ||
          lang.toLowerCase().includes('german') ||
          lang.toLowerCase().includes('fre') ||
          lang.toLowerCase().includes('french') ||
          lang.toLowerCase().includes('spa') ||
          lang.toLowerCase().includes('spanish')
        )) {
          return false
        }
      }
      
      return true
    })

    if (booksWithIA.length === 0) {
      return NextResponse.json({ error: "No books with full text found" }, { status: 404 })
    }

    // Select 6 random books
    const selectedBooks = getRandomItems(booksWithIA, Math.min(6, booksWithIA.length))

    const sentences: Array<{ text: string; book: string; author: string; iaId: string }> = []
    const searchMetadata = {
      subject: randomSubject,
      totalBooksAvailable: searchData.numFound || searchData.num_found || 0,
      totalBooksFound: searchData.docs.length,
      booksWithInternetArchive: booksWithIA.length,
      booksSelected: selectedBooks.length,
      booksProcessed: 0,
      booksSuccessful: 0,
      booksFailed: 0,
      totalSentencesExtracted: 0,
      bookDetails: [] as Array<{
        title: string
        author: string
        iaId: string
        status: 'success' | 'failed' | 'no_sentences'
        sentencesFound: number
        textLength?: number
        positionInBook?: string
      }>
    }

    // Fetch text from each book and extract sentences
    for (const book of selectedBooks) {
      searchMetadata.booksProcessed++
      const bookDetail = {
        title: book.title,
        author: book.author_name?.[0] || "Unknown Author",
        iaId: book.ia[0],
        status: 'failed' as const,
        sentencesFound: 0,
        textLength: 0,
        positionInBook: 'Unknown'
      }

      try {
        const iaId = book.ia[0]

        // Fetch text from Internet Archive
        // Using the djvu.txt format which is plain text
        const textUrl = `https://archive.org/stream/${iaId}/${iaId}_djvu.txt`

        const textResponse = await fetch(textUrl)

        if (!textResponse.ok) {
          console.log(`[v0] Failed to fetch text for ${book.title}`)
          searchMetadata.booksFailed++
          bookDetail.status = 'failed'
          searchMetadata.bookDetails.push(bookDetail)
          continue
        }

        const fullText = await textResponse.text()
        bookDetail.textLength = fullText.length

        // Additional English language check on the actual text content
        // First, clean the text to remove common OCR artifacts and metadata
        const cleanedText = fullText
          .replace(/\d+/g, '') // Remove numbers
          .replace(/[^\w\s]/g, ' ') // Replace punctuation with spaces
          .replace(/\s+/g, ' ') // Normalize whitespace
          .trim()
        
        const englishCharCount = (cleanedText.match(/[a-zA-Z]/g) || []).length
        const totalCharCount = cleanedText.length
        
        // Only check if we have enough text to analyze
        if (totalCharCount > 100) {
          const englishRatio = englishCharCount / totalCharCount
          
          // If less than 30% English characters in the cleaned text, skip this book
          // This is much more lenient since OCR text often has many artifacts
          if (englishRatio < 0.3) {
            console.log(`[v0] Skipping ${book.title} - text appears to be non-English (${Math.round(englishRatio * 100)}% English chars)`)
            searchMetadata.booksFailed++
            bookDetail.status = 'no_sentences'
            searchMetadata.bookDetails.push(bookDetail)
            continue
          }
        }

        // Extract sentences
        const bookSentences = extractSentences(fullText)

        if (bookSentences.length === 0) {
          console.log(`[v0] No sentences extracted from ${book.title}`)
          searchMetadata.booksFailed++
          bookDetail.status = 'no_sentences'
          searchMetadata.bookDetails.push(bookDetail)
          continue
        }

        // Calculate approximate position in book (based on text length)
        const avgSentenceLength = fullText.length / bookSentences.length
        const sentencesPerPage = 20 // rough estimate
        const estimatedPages = Math.ceil(bookSentences.length / sentencesPerPage)
        const randomPage = Math.floor(Math.random() * estimatedPages) + 1
        bookDetail.positionInBook = `Page ${randomPage} of ~${estimatedPages}`

        // Get 2 random sentences from this book
        const randomSentences = getRandomItems(bookSentences, 2)
        bookDetail.sentencesFound = randomSentences.length
        bookDetail.status = 'success'

        searchMetadata.booksSuccessful++
        searchMetadata.totalSentencesExtracted += randomSentences.length

        randomSentences.forEach((sentence) => {
          sentences.push({
            text: sentence,
            book: book.title,
            author: book.author_name?.[0] || "Unknown Author",
            iaId: iaId,
          })
        })

        searchMetadata.bookDetails.push(bookDetail)
      } catch (error) {
        console.log(`[v0] Error processing book ${book.title}:`, error)
        searchMetadata.booksFailed++
        bookDetail.status = 'failed'
        searchMetadata.bookDetails.push(bookDetail)
        continue
      }
    }

    if (sentences.length === 0) {
      return NextResponse.json({ error: "Could not extract sentences from books" }, { status: 500 })
    }

    return NextResponse.json({ 
      sentences,
      searchMetadata 
    })
  } catch (error) {
    console.error("[v0] Error in random-sentences API:", error)
    return NextResponse.json({ error: "Failed to fetch random sentences" }, { status: 500 })
  }
}
