import { useEffect, useRef, useState } from "react"
import { useIdentity } from "../lib/identityContext"
import { CreditsBadge } from "../lib/credits/CreditsBadge"
import { UserCircleIcon } from "./UserCircleIcon"

interface UserMenuProps {
  onPastReading: () => void
  onCredits: () => void
}

export function UserMenu({ onPastReading, onCredits }: UserMenuProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const { isSignedIn, userLabel, signIn, signOut } = useIdentity()

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false)
      }
    }
    if (menuOpen) {
      document.addEventListener("mousedown", handleClickOutside)
      return () => document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [menuOpen])

  const handleLoginRegister = () => {
    setMenuOpen(false)
    signIn()
  }

  const handleSignOut = () => {
    setMenuOpen(false)
    void signOut()
  }

  const handlePastReading = () => {
    setMenuOpen(false)
    onPastReading()
  }

  const handleCredits = () => {
    setMenuOpen(false)
    onCredits()
  }

  return (
    <div className="user-menu" ref={menuRef}>
      <button
        type="button"
        className={`user-menu__trigger${isSignedIn ? " user-menu__trigger--signed-in" : ""}`}
        onClick={() => setMenuOpen((prev) => !prev)}
        aria-label={isSignedIn ? "Account menu" : "User menu"}
        aria-expanded={menuOpen}
      >
        <UserCircleIcon className="user-menu__icon" />
      </button>
      {menuOpen && (
        <div className="user-menu__dropdown">
          {isSignedIn && userLabel ? (
            <p className="user-menu__label" title={userLabel}>
              {userLabel}
            </p>
          ) : null}
          {isSignedIn ? (
            <p className="user-menu__credits">
              <CreditsBadge />
            </p>
          ) : null}
          <button
            type="button"
            className="user-menu__item"
            onClick={handlePastReading}
          >
            Past Readings
          </button>
          <button
            type="button"
            className="user-menu__item"
            onClick={handleCredits}
          >
            Credits
          </button>
          {!isSignedIn ? (
            <button
              type="button"
              className="user-menu__item"
              onClick={handleLoginRegister}
            >
              Login/Register
            </button>
          ) : (
            <button
              type="button"
              className="user-menu__item user-menu__item--sign-out"
              onClick={handleSignOut}
            >
              Sign out
            </button>
          )}
        </div>
      )}
    </div>
  )
}
