export function normalizeAssistantLines(content) {
  const sourceLines = content.split(/\r?\n/).filter((line) => (
    !/^\s*(?:[-*_]\s*){3,}$/.test(line)
    && !/^\s*(?:\*{1,2}|[-+])\s*$/.test(line)
  ))
  const normalized = []

  for (let index = 0; index < sourceLines.length;) {
    const line = sourceLines[index]

    if (/^\s*[A-Za-z]\s*$/.test(line)) {
      const letters = [line.trim()]
      let nextIndex = index + 1
      while (nextIndex < sourceLines.length) {
        if (!sourceLines[nextIndex].trim()) {
          nextIndex += 1
          continue
        }
        if (!/^\s*[A-Za-z]\s*$/.test(sourceLines[nextIndex])) break
        letters.push(sourceLines[nextIndex].trim())
        nextIndex += 1
      }
      index = nextIndex
      continue
    }

    normalized.push(line)
    index += 1
  }

  const isStandaloneHeading = (line) => {
    const boldHeading = line.match(/^\s*\*\*([^*]+)\*\*\s*$/)
    return Boolean(boldHeading && boldHeading[1].length < 70 && !/[：:₹\d]/.test(boldHeading[1]))
  }
  const nonEmptyLines = normalized.filter((line) => line.trim())
  return nonEmptyLines.filter((line, index) => {
    const markdownHeading = line.match(/^\s*#{1,6}\s+(.+)$/)
    if (markdownHeading) {
      if (/^\d+[.)]\s/.test(markdownHeading[1])) return true
      return index < nonEmptyLines.length - 1
        && !/^\s*(?:#{1,6}\s+.+|\*\*[^*]+\*\*)\s*$/.test(nonEmptyLines[index + 1])
    }
    if (!isStandaloneHeading(line)) return true
    const nextLine = nonEmptyLines[index + 1] || ''
    return index < nonEmptyLines.length - 1
      && !isStandaloneHeading(nextLine)
  })
}
