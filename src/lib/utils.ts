import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getMmToPx() {
  const div = document.createElement('div')
  div.style.width = '1mm'
  div.style.height = '1mm'
  div.style.position = 'absolute'
  document.body.appendChild(div)
  const rect = div.getBoundingClientRect()
  document.body.removeChild(div)
  return { mmX: rect.width, mmY: rect.height }
}
