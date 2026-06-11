export function generateId(prefix: string = ''): string {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substring(2, 8)
  return `${prefix}${timestamp}${random}`
}

export function generateBatchNo(category: string): string {
  const date = new Date()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0')
  const prefix = category === 'food' ? 'SP' : category === 'clothing' ? 'YZ' : 'RY'
  return `${prefix}${year}${month}${day}${random}`
}
