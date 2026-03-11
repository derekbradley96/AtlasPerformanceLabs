import * as React from "react"

const MOBILE_BREAKPOINT = 768
const MOBILE_SHELL_BREAKPOINT = 1024

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState(undefined)

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }
    mql.addEventListener("change", onChange)
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    return () => mql.removeEventListener("change", onChange);
  }, [])

  return !!isMobile
}

/** True when width < 1024px — use MobileShell instead of desktop sidebar layout */
export function useIsMobileLayout() {
  const [isMobileLayout, setIsMobileLayout] = React.useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < MOBILE_SHELL_BREAKPOINT : false
  )

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_SHELL_BREAKPOINT - 1}px)`)
    const onChange = (e) => setIsMobileLayout(e.matches)
    mql.addEventListener("change", onChange)
    setIsMobileLayout(mql.matches)
    return () => mql.removeEventListener("change", onChange)
  }, [])

  return isMobileLayout
}
