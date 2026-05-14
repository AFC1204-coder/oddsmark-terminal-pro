export interface Bet {
  id: string
  date: string
  time?: string
  event: string
  league: string
  sport: string
  market: string
  odds: number
  stake: number
  status: "pending" | "won" | "lost"
  bookie?: string
  isLive?: boolean
  strategies?: string[]
  comments?: string
  tipster?: string
  fairOdd?: number
  isCashout?: boolean
  cashoutValue?: number
}

export interface Strategy {
  id: string
  name: string
  color: string
}

export interface Settings {
  unitValue: number
  initialCapital: number
  targetCapital: number
  currency: "EUR" | "USD"
  apiKey?: string
}
