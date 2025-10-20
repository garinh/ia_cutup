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
    "css",
    "html",
    "style",
    "display",
    "margin",
    "padding",
    "border",
    "webkit",
    "mozilla",
    "shadow dom",
    "shady dom",
    "web component",
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

      // Filter out CSS/HTML formatting patterns
      if (s.match(/\.(media|button|label|web|menu|nav|header|footer|container|wrapper)\s+(button|label|display|none|flex|grid|style)/i)) return false
      if (s.match(/\d+px|\d+em|\d+rem|rgba?\(|#[0-9a-fA-F]{3,6}/)) return false
      if (s.match(/\{[\s\S]*\}/)) return false // Contains curly braces (likely CSS)
      if (s.match(/display\s+(none|block|flex|grid|inline)/i)) return false
      if (s.includes('.') && s.split('.').length > 5) return false // Too many dots (likely CSS classes chained)
      
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
    .filter((line) => {
      const trimmed = line.trim()
      
      // Filter out CSS and HTML formatting lines
      if (trimmed.match(/^(\.|\#)[a-zA-Z0-9_\-]+(\s+\{|\s+[a-zA-Z0-9_\-]+\s*\{|$)/)) return false // CSS selectors
      if (trimmed.match(/^\.([\w\-]+\s*)+(\{|\:|$)/)) return false // CSS class definitions
      if (trimmed.match(/^(display|margin|padding|border|background|color|font|width|height|position|flex|grid)/i)) return false // CSS properties
      if (trimmed.match(/^(button|label|div|span|style|class|id)\s*(\.|\#|\{|\:)/i)) return false // HTML/CSS mixed
      if (trimmed.match(/^<[^>]+>|<\/[^>]+>$/)) return false // HTML tags
      if (trimmed.match(/^\{[\s\S]*\}$/)) return false // Curly brace blocks (CSS)
      if (trimmed.match(/^(Shady DOM|Shadow DOM|Web Component)/i)) return false // Web component mentions
      if (trimmed.match(/^(style|styles)\s+(for|in|of)\s+/i)) return false // Style references
      if (trimmed.includes('webkit') || trimmed.includes('mozilla') || trimmed.includes('moz-')) return false // Browser prefixes
      if (trimmed.match(/^(true|false|null|undefined|var|let|const|function)\s*[\{\(\=\;]/)) return false // JavaScript code
      if (trimmed.match(/\:\s*\d+px|\:\s*#[0-9a-fA-F]{3,6}|\:\s*rgba?\(/)) return false // CSS values
      if (trimmed.match(/^[\{\}\[\]\(\)\;]+$/)) return false // Just brackets/punctuation
      if (trimmed.match(/^\d+\s*\{/)) return false // Line numbers with brackets
      
      return true
    })

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

    // Filter books that have Internet Archive IDs and are in English
    const booksWithIA = searchData.docs.filter((book) => {
      // Must have Internet Archive ID
      if (!book.ia || book.ia.length === 0) return false
      
      // STRICT: Only include books that explicitly list English as a language
      // If no language metadata, skip it (to be safe)
      if (!book.language || book.language.length === 0) return false
      
      // Check if English is explicitly listed
      const hasEnglish = book.language.some(lang => {
        const lowerLang = lang.toLowerCase()
        return lowerLang === 'eng' || 
               lowerLang === 'en' || 
               lowerLang === 'english' ||
               lowerLang.includes('eng')
      })
      
      if (!hasEnglish) return false
      
      // Also check for common non-English languages and exclude if found
      const hasNonEnglish = book.language.some(lang => {
        const lowerLang = lang.toLowerCase()
        return lowerLang.includes('rus') || lowerLang.includes('russian') ||
               lowerLang.includes('ger') || lowerLang.includes('german') ||
               lowerLang.includes('fre') || lowerLang.includes('french') ||
               lowerLang.includes('spa') || lowerLang.includes('spanish') ||
               lowerLang.includes('ita') || lowerLang.includes('italian') ||
               lowerLang.includes('por') || lowerLang.includes('portuguese') ||
               lowerLang.includes('dut') || lowerLang.includes('dutch') ||
               lowerLang.includes('pol') || lowerLang.includes('polish') ||
               lowerLang.includes('chi') || lowerLang.includes('chinese') ||
               lowerLang.includes('jap') || lowerLang.includes('japanese') ||
               lowerLang.includes('ara') || lowerLang.includes('arabic') ||
               lowerLang.includes('lat') || lowerLang.includes('latin')
      })
      
      if (hasNonEnglish) return false
      
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
        // Take a sample from the middle of the book (skip front matter)
        const sampleStart = Math.floor(fullText.length * 0.2)
        const sampleEnd = Math.floor(fullText.length * 0.3)
        const sampleText = fullText.slice(sampleStart, sampleEnd)
        
        // Clean the sample text to remove common OCR artifacts and metadata
        const cleanedText = sampleText
          .replace(/\d+/g, '') // Remove numbers
          .replace(/[^\w\s]/g, ' ') // Replace punctuation with spaces
          .replace(/\s+/g, ' ') // Normalize whitespace
          .trim()
        
        const englishCharCount = (cleanedText.match(/[a-zA-Z]/g) || []).length
        const totalCharCount = cleanedText.length
        
        // Only check if we have enough text to analyze
        if (totalCharCount > 100) {
          const englishRatio = englishCharCount / totalCharCount
          
          // Stricter check: If less than 60% English characters in the cleaned text, skip this book
          if (englishRatio < 0.6) {
            console.log(`[v0] Skipping ${book.title} - text appears to be non-English (${Math.round(englishRatio * 100)}% English chars in sample)`)
            searchMetadata.booksFailed++
            bookDetail.status = 'no_sentences'
            searchMetadata.bookDetails.push(bookDetail)
            continue
          }
          
          // Additional check: Look for common English words
          const commonEnglishWords = ['the', 'and', 'is', 'in', 'to', 'of', 'a', 'that', 'it', 'was', 'for', 'on', 'with', 'as', 'be']
          const lowerSample = cleanedText.toLowerCase()
          const englishWordCount = commonEnglishWords.filter(word => 
            lowerSample.includes(` ${word} `)
          ).length
          
          // Should have at least 5 of these common English words
          if (englishWordCount < 5) {
            console.log(`[v0] Skipping ${book.title} - lacks common English words (found ${englishWordCount}/15)`)
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
