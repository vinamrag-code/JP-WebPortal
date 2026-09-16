import { createContext, useContext, useState } from 'react'
import { loadSavedTheme, applyTheme, saveTheme } from '@/lib/theme'
import { NOCTURNE_PRESET } from '@/lib/nocturneTheme'

function initializeTheme() {
    const saved = loadSavedTheme()
    if(saved){
        applyTheme(saved)
        return saved
    } else {
        // New installs default to Nocturne (the owner's Claude Design canvas). Existing users who already
        // saved a theme are unaffected — this only applies before any theme has ever been chosen.
        applyTheme(NOCTURNE_PRESET)
        return NOCTURNE_PRESET
    }
}

export const ThemeContext = createContext({
    themeMode: 'dark',
    darkTheme: ()=>{},
    lightTheme: ()=>{}
})

export function ThemeProvider({ children }){
    const initialTheme = initializeTheme()
    const [themeMode, setThemeMode] = useState(initialTheme.mode === 'dark' ? 'dark' : 'light')

    function darkTheme(){
        const cur = loadSavedTheme() || {}
        cur.mode = 'dark'
        saveTheme(cur)
        applyTheme(cur, 'dark') // Pass explicit mode here
        setThemeMode('dark')
    }

    function lightTheme(){
        const cur = loadSavedTheme() || {}
        cur.mode = 'light'
        saveTheme(cur)
        applyTheme(cur, 'light') // Pass explicit mode here
        setThemeMode('light')
    }

    return (
        <ThemeContext.Provider value={{ themeMode, darkTheme, lightTheme }}>
            {children}
        </ThemeContext.Provider>
    )
}

export default function useTheme(){
    return useContext(ThemeContext)
}