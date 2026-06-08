import { useEffect, useRef, useState } from "react"
import { buildIdentitySignInUrl } from "../lib/identity"
import { UserCircleIcon } from "./UserCircleIcon"

interface UserMenuProps {
  onPastReading: () => void
}

export function UserMenu({ onPastReading }: UserMenuProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

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
    window.location.href = buildIdentitySignInUrl()
  }

  const handlePastReading = () => {
    setMenuOpen(false)
    onPastReading()
  }

  return (
    <div className="user-menu" ref={menuRef}>
      <button
        type="button"
        className="chrome-btn user-menu__trigger"
        onClick={() => setMenuOpen((prev) => !prev)}
        aria-label="User menu"
        aria-expanded={menuOpen}
      >
        <UserCircleIcon className="chrome-icon" />
      </button>
      {menuOpen && (
        <div className="user-menu__dropdown">
          <button
            type="button"
            className="user-menu__item"
            onClick={handleLoginRegister}
          >
            Login/Register
          </button>
          <button
            type="button"
            className="user-menu__item"
            onClick={handlePastReading}
          >
            Past Readings
          </button>
        </div>
      )}
    </div>
  )
}
