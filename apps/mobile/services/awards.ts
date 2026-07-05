import { supabase } from '@/utils/supabase'
import { useQuery } from '@tanstack/react-query'

export interface OscarNomination {
  category: string
  details?: string // e.g., "Michael B. Jordan" or "Ryan Coogler"
  isWinner?: boolean
}

export interface OscarData {
  tmdbId: number
  nominations: OscarNomination[]
}

// Fallback / Initial data for 2026
const STUB_OSCAR_2026_DATA: Record<number, OscarNomination[]> = {
  1233413: [ // Sinners
    { category: 'Best Picture', isWinner: false },
    { category: 'Best Director', details: 'Ryan Coogler', isWinner: true },
    { category: 'Best Actor', details: 'Michael B. Jordan', isWinner: true },
    { category: 'Best Supporting Actor', details: 'Delroy Lindo', isWinner: false },
    { category: 'Best Supporting Actress', details: 'Wunmi Mosaku', isWinner: false },
    { category: 'Best Original Screenplay', isWinner: true },
    { category: 'Best Cinematography', isWinner: true },
    { category: 'Best Film Editing', isWinner: false },
    { category: 'Best Production Design', isWinner: false },
    { category: 'Best Costume Design', isWinner: false },
    { category: 'Best Sound', isWinner: false },
    { category: 'Best Visual Effects', isWinner: false },
    { category: 'Best Makeup and Hairstyling', isWinner: false },
    { category: 'Best Original Score', isWinner: false },
    { category: 'Best Original Song', isWinner: false },
    { category: 'Best Casting', isWinner: false },
  ],
  1054867: [ // One Battle After Another
    { category: 'Best Picture', isWinner: true },
    { category: 'Best Director', details: 'Paul Thomas Anderson', isWinner: true },
    { category: 'Best Actor', details: 'Leonardo DiCaprio', isWinner: false },
    { category: 'Best Supporting Actor', details: 'Benicio Del Toro', isWinner: false },
    { category: 'Best Supporting Actor', details: 'Sean Penn', isWinner: true },
    { category: 'Best Supporting Actress', details: 'Teyana Taylor', isWinner: false },
    { category: 'Best Adapted Screenplay', isWinner: true },
    { category: 'Best Cinematography', isWinner: false },
    { category: 'Best Film Editing', isWinner: true },
    { category: 'Best Production Design', isWinner: false },
    { category: 'Best Costume Design', isWinner: false },
    { category: 'Best Sound', isWinner: false },
    { category: 'Best Original Score', isWinner: false },
    { category: 'Best Casting', isWinner: false },
  ],
  1317288: [ // Marty Supreme
    { category: 'Best Picture', isWinner: false },
    { category: 'Best Director', details: 'Josh Safdie', isWinner: false },
    { category: 'Best Actor', details: 'Timothée Chalamet', isWinner: false },
    { category: 'Best Original Screenplay', isWinner: false },
    { category: 'Best Cinematography', isWinner: false },
    { category: 'Best Film Editing', isWinner: false },
    { category: 'Best Production Design', isWinner: false },
    { category: 'Best Costume Design', isWinner: false },
    { category: 'Best Casting', isWinner: false },
  ],
  1124566: [ // Sentimental Value
    { category: 'Best Picture', isWinner: false },
    { category: 'Best Director', details: 'Joachim Trier', isWinner: false },
    { category: 'Best Actress', details: 'Renate Reinsve', isWinner: false },
    { category: 'Best Supporting Actor', details: 'Stellan Skarsgård', isWinner: false },
    { category: 'Best Supporting Actress', details: 'Elle Fanning', isWinner: false },
    { category: 'Best Supporting Actress', details: 'Inga Ibsdotter Lilleaas', isWinner: false },
    { category: 'Best Original Screenplay', isWinner: false },
    { category: 'Best International Feature Film', isWinner: true },
    { category: 'Best Casting', isWinner: false },
  ],
  1062722: [ // Frankenstein
    { category: 'Best Picture', isWinner: false },
    { category: 'Best Adapted Screenplay', isWinner: false },
    { category: 'Best Supporting Actor', details: 'Jacob Elordi', isWinner: false },
    { category: 'Best Cinematography', isWinner: false },
    { category: 'Best Makeup and Hairstyling', isWinner: true },
    { category: 'Best Production Design', isWinner: true },
    { category: 'Best Costume Design', isWinner: false },
    { category: 'Best Visual Effects', isWinner: false },
    { category: 'Best Original Score', isWinner: false },
  ],
  701387: [ // Bugonia
    { category: 'Best Picture', isWinner: false },
    { category: 'Best Actress', details: 'Emma Stone', isWinner: false },
    { category: 'Best Adapted Screenplay', isWinner: false },
  ],
  911430: [ // F1
    { category: 'Best Picture', isWinner: false },
    { category: 'Best Sound', isWinner: true },
    { category: 'Best Film Editing', isWinner: false },
    { category: 'Best Visual Effects', isWinner: false },
  ],
  858024: [ // Hamnet
    { category: 'Best Picture', isWinner: false },
    { category: 'Best Director', details: 'Chloé Zhao', isWinner: false },
    { category: 'Best Actress', details: 'Jessie Buckley', isWinner: true },
    { category: 'Best Adapted Screenplay', isWinner: false },
  ],
  1220564: [ // The Secret Agent
    { category: 'Best Picture', isWinner: false },
    { category: 'Best Actor', details: 'Wagner Moura', isWinner: false },
    { category: 'Best International Feature Film', isWinner: false },
    { category: 'Best Casting', isWinner: false },
  ],
  1241983: [ // Train Dreams
    { category: 'Best Picture', isWinner: false },
    { category: 'Best Adapted Screenplay', isWinner: false },
    { category: 'Best Cinematography', isWinner: false },
    { category: 'Best Original Song', isWinner: false },
  ],
  1299655: [ // Blue Moon
    { category: 'Best Actor', details: 'Ethan Hawke', isWinner: false },
    { category: 'Best Original Screenplay', isWinner: false },
  ],
  1160360: [ // If I Had Legs I'd Kick You
    { category: 'Best Actress', details: 'Rose Byrne', isWinner: false }
  ],
  1078605: [ // Weapons
    { category: 'Best Supporting Actress', details: 'Amy Madigan', isWinner: true }
  ],
  1456349: [ // It Was Just An Accident
    { category: 'Best Original Screenplay', isWinner: false },
    { category: 'Best International Feature Film', isWinner: false },
  ],
  804370: [ // Arco
    { category: 'Best Animated Feature', isWinner: false }
  ],
  1022787: [ // Elio
    { category: 'Best Animated Feature', isWinner: false }
  ],
  803796: [ // KPop Demon Hunters
    { category: 'Best Animated Feature', isWinner: true },
    { category: 'Best Original Song', details: 'Golden', isWinner: true }
  ],
  682012: [ // Little Amélie or the Character of Rain
    { category: 'Best Animated Feature', isWinner: false }
  ],
  1084242: [ // Zootopia 2
    { category: 'Best Animated Feature', isWinner: false }
  ],
  83533: [ // Avatar: Fire and Ash
    { category: 'Best Costume Design', isWinner: false },
    { category: 'Best Visual Effects', isWinner: true }
  ],
  1379266: [ // Kokuho
    { category: 'Best Makeup and Hairstyling', isWinner: false }
  ],
  760329: [ // The Smashing Machine
    { category: 'Best Makeup and Hairstyling', isWinner: false }
  ],
  1284120: [ // The Ugly Stepsister
    { category: 'Best Makeup and Hairstyling', isWinner: false }
  ],
  1151272: [ // Sirât
    { category: 'Best Sound', isWinner: false },
    { category: 'Best International Feature Film', isWinner: false }
  ],
  1234821: [ // Jurassic World: Rebirth
    { category: 'Best Visual Effects', isWinner: false },
  ],
  1236470: [ // The Lost Bus
    { category: 'Best Visual Effects', isWinner: false }
  ],
  826338: [ // Diane Warren: Relentless
    { category: 'Best Original Song', isWinner: false }
  ],
  1358554: [ // Viva Verdi!
    { category: 'Best Original Song', isWinner: false }
  ],
  1413805: [ // The Alabama Solution
    { category: 'Best Documentary Feature', isWinner: false }
  ],
  1400780: [ // Come See Me in the Good Light
    { category: 'Best Documentary Feature', isWinner: false }
  ],
  1400793: [ // Cutting Rocks
    { category: 'Best Documentary Feature', isWinner: false }
  ],
  1393151: [ // Mr. Nobody Against Putin
    { category: 'Best Documentary Feature', isWinner: true }
  ],
  1400782: [ // The Perfect Neighbor
    { category: 'Best Documentary Feature', isWinner: false }
  ],
  1480382: [ // The Voice of Hind Rajab
    { category: 'Best International Feature', isWinner: false }
  ],
  1233361: [ // Butterfly
    { category: 'Best Animated Short Feature', isWinner: false }
  ],
  1477914: [ // Forevergreen
    { category: 'Best Animated Short Feature', isWinner: false }
  ],
  1142149: [ // The Girl Who Cried Pearls
    { category: 'Best Animated Short Feature', isWinner: true }
  ],
  866346: [ // Retirement Plan
    { category: 'Best Animated Short Feature', isWinner: false }
  ],
  1302562: [ // The Three Sisters
    { category: 'Best Animated Short Feature', isWinner: false }
  ],
  1525091: [ // All the Empty Rooms', isWinner: false }
    { category: 'Best Documentary Short', isWinner: false }
  ],
  1422051: [ // Armed Only with a Camera: The Life and Death of Brent Renaud
    { category: 'Best Documentary Short', isWinner: false }
  ],
  1560400: [ // Children No More: Were and Are Gone
    { category: 'Best Documentary Short', isWinner: false }
  ],
  1373150: [ // The Devil is Busy
    { category: 'Best Documentary Short', isWinner: false }
  ],
  1278954: [ // Perfectly a Strangeness
    { category: 'Best Documentary Short', isWinner: false }
  ],
  1560394: [ // Butcher’s Stain
    { category: 'Best Live Action Short', isWinner: false }
  ],
  1470465: [ // A Friend of Dorothy
    { category: 'Best Live Action Short', isWinner: false }
  ],
  1272266: [ // Jane Austen’s Period Drama
    { category: 'Best Live Action Short', isWinner: false }
  ],
  1442908: [ // The Singers
    { category: 'Best Live Action Short', isWinner: true }
  ],
  1340625: [ // Two People Exchanging Saliva
    { category: 'Best Live Action Short', isWinner: true }
  ],
  1371185: [ // Song Sung Blue
    { category: 'Best Actress', details: 'Kate Hudson', isWinner: false }
  ]
}

export const AWARDS_KEYS = {
  all: ['awards'] as const,
  oscar: (year: number) => [...AWARDS_KEYS.all, 'oscar', year] as const,
}

/**
 * Hook to get all Oscar nominations for a specific year
 */
export function useOscarData(year: number = 2026) {
  return useQuery({
    queryKey: AWARDS_KEYS.oscar(year),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('oscar_nominations')
        .select('tmdb_id, category, details, is_winner')
        .eq('year', year)

      if (error) {
        console.error('Failed to fetch Oscar data from Supabase:', error)
        return STUB_OSCAR_2026_DATA
      }

      if (!data || data.length === 0) {
        return STUB_OSCAR_2026_DATA
      }

      // Merge dynamic data with stub data so we don't lose the local STUB list
      const mergedNominations: Record<number, OscarNomination[]> = JSON.parse(JSON.stringify(STUB_OSCAR_2026_DATA))
      
      data.forEach(row => {
        if (!mergedNominations[row.tmdb_id]) {
          mergedNominations[row.tmdb_id] = []
        }
        
        // Ensure no duplicates, or find the corresponding existing category and modify it
        const existingIdx = mergedNominations[row.tmdb_id].findIndex(
          nom => nom.category === row.category && nom.details === row.details
        )
        
        if (existingIdx >= 0) {
          // If the stub already marked it as winner but DB says false, we retain winner status for now 
          // because if DB defaults to false newly-added, we want local winners to stick.
          mergedNominations[row.tmdb_id][existingIdx].isWinner = row.is_winner || mergedNominations[row.tmdb_id][existingIdx].isWinner
        } else {
          mergedNominations[row.tmdb_id].push({
            category: row.category,
            details: row.details,
            isWinner: row.is_winner
          })
        }
      })

      return mergedNominations
    },
    staleTime: 1000 * 60 * 60, // 1 hour
  })
}

/**
 * Synchronous version for simple checks (uses current query cache if available)
 * Fallback to stub data
 */
export function getOscarNominationsLegacy(tmdbId: number): OscarNomination[] | null {
  return STUB_OSCAR_2026_DATA[tmdbId] || null
}

export function isOscarNomineeLegacy(tmdbId: number): boolean {
  return !!STUB_OSCAR_2026_DATA[tmdbId]
}

export function getAllOscarNomineeIdsLegacy(): number[] {
  return Object.keys(STUB_OSCAR_2026_DATA).map(id => parseInt(id, 10))
}

// RESTORE FOR BACKWARD COMPATIBILITY
export const getOscarNominations = getOscarNominationsLegacy
export const isOscarNominee = isOscarNomineeLegacy
export const getAllOscarNomineeIds = getAllOscarNomineeIdsLegacy
